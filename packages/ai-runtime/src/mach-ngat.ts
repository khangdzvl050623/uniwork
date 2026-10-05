import { APICallError, RetryError } from 'ai'
import { aiConfig } from './config.js'

/**
 * Mạch ngắt nhà cung cấp AI.
 *
 * ===========================================================================
 * VÌ SAO CẦN — VÀ THỨ BỊ ĐỐT KHÔNG PHẢI LƯỢT CỦA NGƯỜI DÙNG
 * ===========================================================================
 * Review 2026-10-05 viết "Gemini 429 là mọi người dùng cùng đốt lượt". Kiểm
 * lại thì không đúng hẳn: 429 tới trước chữ đầu tiên thì lượt được HOÀN.
 *
 * Thứ bị đốt thật là NGÂN SÁCH CHUNG của cả project. Không có mạch ngắt thì
 * khi Gemini đang trả 429, mọi người vẫn tiếp tục gọi — mỗi người chờ một
 * vòng rồi nhận lỗi — và chính những lời gọi đó giữ cho hạn mức của Google
 * cạn mãi. Sự cố một phút kéo thành mười phút.
 *
 * ===========================================================================
 * BA TRẠNG THÁI
 * ===========================================================================
 *   ĐÓNG    — gọi bình thường, đếm lỗi liên tiếp.
 *   MỞ      — đủ ngưỡng lỗi: từ chối NGAY, không giữ lượt, không gọi model.
 *   NỬA MỞ  — hết thời gian chờ: cho gọi thử. Thành công thì ĐÓNG lại, lỗi
 *             thì MỞ lại ngay với thời gian chờ mới.
 *
 * ---------------------------------------------------------------------------
 * NỬA MỞ KHÔNG KHOÁ "CHỈ MỘT LỜI GỌI THỬ" — CÓ CHỦ Ý
 * ---------------------------------------------------------------------------
 * Bản kinh điển chỉ cho đúng một lời gọi thử đi qua. Nhưng lời gọi đó có thể
 * bị chặn VÌ LÝ DO KHÁC trước khi tới model — hết lượt ngày, đang bận — và
 * không bao giờ báo kết quả. Mạch kẹt ở nửa mở với "đang có người thử" mãi
 * mãi, chặn tất cả.
 *
 * Ở quy mô này, vài lời gọi lọt qua cùng lúc trong nửa mở rẻ hơn nhiều so với
 * một mạch kẹt vĩnh viễn — đúng loại lỗi vòng đời vừa phải sửa ở lượt mồ côi.
 *
 * ---------------------------------------------------------------------------
 * TRẠNG THÁI TRONG BỘ NHỚ, KHÔNG TRONG DATABASE
 * ---------------------------------------------------------------------------
 * Thiết kế có bảng `AiCircuit`. Chưa cần: Render đang chạy MỘT instance, và
 * cửa sổ 429 tính bằng phút. Mất trạng thái khi khởi động lại chỉ có nghĩa là
 * mạch bắt đầu ở trạng thái đóng — tệ nhất là thêm ba lời gọi để học lại.
 * Khi có nhiều instance thì mỗi cái tự ngắt độc lập — vẫn đúng, chỉ chậm hơn.
 */

let soLoiLienTiep = 0
/** Thời điểm hết chờ. `0` = chưa từng mở kể từ lần thành công gần nhất. */
let moToi = 0
let dongHo: () => number = () => Date.now()

/** Trần thời gian chờ, kể cả khi nhà cung cấp đòi lâu hơn qua `retry-after`. */
const CHO_TOI_DA_MS = 10 * 60_000

export type KetQuaXinPhep = { duoc: true } | { duoc: false; thuLaiSauMs: number }

/** Hỏi TRƯỚC khi giữ lượt. Mạch mở thì đừng giữ lượt, đừng gọi model. */
export function machChoPhep(): KetQuaXinPhep {
  const conLai = moToi - dongHo()
  return conLai > 0 ? { duoc: false, thuLaiSauMs: conLai } : { duoc: true }
}

/** Model trả lời được — dù nội dung thế nào. Đóng mạch, xoá bộ đếm. */
export function ghiThanhCong(): void {
  soLoiLienTiep = 0
  moToi = 0
}

/**
 * Ghi một lượt hỏng. Trả `true` nếu lỗi được tính vào mạch.
 *
 * `nguoiDungHuy` lấy từ tín hiệu huỷ của CHÍNH người dùng (đóng tab). Lỗi đó
 * không nói gì về sức khoẻ của nhà cung cấp, nên không được tính.
 */
export function ghiLoi(e: unknown, nguoiDungHuy: boolean): boolean {
  if (nguoiDungHuy || !laLoiNhaCungCap(e)) return false

  soLoiLienTiep += 1
  const dangNuaMo = moToi !== 0

  if (dangNuaMo || soLoiLienTiep >= aiConfig.circuitFailures) {
    moToi = dongHo() + thoiGianCho(e)
  }
  return true
}

/**
 * Lỗi này do NHÀ CUNG CẤP, hay do code của ta?
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO PHẢI PHÂN BIỆT
 * ---------------------------------------------------------------------------
 * Mọi thứ ném ra trong một lượt đều đi qua cùng một `catch` — kể cả lỗi ghi
 * database sau khi model đã trả lời xong, hay `LoLotPII` do code của ta. Tính
 * cả những lỗi đó vào mạch thì một bug của ta làm "trợ lý đang quá tải" hiện
 * ra cho mọi người, trong khi Gemini hoàn toàn bình thường — và log thì chỉ
 * toàn câu đánh lạc hướng.
 *
 * Tính:
 *   `APICallError` — mọi phản hồi lỗi từ nhà cung cấp. Kể cả 401/403 (khoá
 *     sai): khi đó MỌI lời gọi đều hỏng, và từ chối nhanh vẫn hơn bắt từng
 *     người chờ một vòng rồi nhận lỗi.
 *   Hết thời gian chờ — nhà cung cấp treo, khi người dùng KHÔNG tự huỷ.
 *
 * Không tính: mọi thứ còn lại.
 */
export function laLoiNhaCungCap(e: unknown): boolean {
  const goc = RetryError.isInstance(e) ? e.lastError : e
  if (APICallError.isInstance(goc)) return true
  if (goc instanceof Error && (goc.name === 'TimeoutError' || goc.name === 'AbortError')) {
    return true
  }
  return false
}

/**
 * Chờ bao lâu. 429 kèm `retry-after` thì nghe theo nhà cung cấp — họ biết
 * cửa sổ hạn mức của họ còn bao lâu — nhưng không ngắn hơn mặc định và không
 * dài quá trần.
 */
function thoiGianCho(e: unknown): number {
  const goc = RetryError.isInstance(e) ? e.lastError : e
  const macDinh = aiConfig.circuitCooldownMs
  if (!APICallError.isInstance(goc) || goc.statusCode !== 429) return macDinh

  const giay = Number(goc.responseHeaders?.['retry-after'])
  if (!Number.isFinite(giay) || giay <= 0) return macDinh
  return Math.min(CHO_TOI_DA_MS, Math.max(macDinh, giay * 1000))
}

/** Chỉ dùng trong test — trả mạch về trạng thái đóng, và cho phép thay đồng hồ. */
export function _datLaiMach(dongHoGia?: () => number): void {
  soLoiLienTiep = 0
  moToi = 0
  dongHo = dongHoGia ?? (() => Date.now())
}
