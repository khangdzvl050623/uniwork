export type VaiNguoiNoi = 'toi' | 'ho' | 'ai' | 'he-thong'

/**
 * Nhãn người gửi mà server ghi vào tin nhắn — bản sao của `ChatSenderType`.
 *
 * Chép tay chứ không import từ `@prisma/client`: web không phụ thuộc Prisma,
 * và đây là hợp đồng JSON chứ không phải kiểu database.
 */
export type NguoiGui = 'STUDENT' | 'EMPLOYER' | 'ADMIN' | 'AI' | 'SYSTEM'

export interface TinNhanUI {
  id: string
  vai: VaiNguoiNoi
  noiDung: string
  /**
   * Số thứ tự do server cấp. `undefined` khi tin còn đang chảy dở.
   *
   * Đây là KHOÁ KHỬ TRÙNG — xem `gopLichSu`.
   */
  seq?: number
  /** AI đang viết dở tin này. */
  dangViet?: boolean
  /**
   * Thời điểm server ghi tin, dạng ISO. `undefined` khi tin còn đang chảy dở
   * — lúc đó nó chưa có trong database nên chưa có giờ nào là thật.
   *
   * Không tự đặt `new Date()` ở client để lấp chỗ trống: đồng hồ máy người
   * dùng lệch được hàng phút, và một giờ SAI trông y hệt một giờ đúng.
   */
  luc?: string
}

/**
 * Ghép một mẩu chữ vừa nhận vào danh sách tin nhắn.
 *
 * ===========================================================================
 * HÀM NÀY PHẢI THUẦN KHIẾT VÀ PHẢI LẶP LẠI ĐƯỢC
 * ===========================================================================
 * Nó chạy bên trong `setTinNhan(ds => …)`. React gọi hàm cập nhật **hai lần**
 * ở chế độ StrictMode (đang bật ở `main.tsx`) để lộ ra những hàm cập nhật
 * không thuần khiết. Gọi hai lần trên cùng đầu vào PHẢI ra cùng kết quả.
 *
 * ---------------------------------------------------------------------------
 * LỖI THẬT ĐÃ GẶP 2026-09-28 — CÂU TRẢ LỜI BIẾN MẤT KHỎI MÀN HÌNH
 * ---------------------------------------------------------------------------
 * Bản đầu giữ một biến `let daCoChu` bên ngoài rồi sửa nó BÊN TRONG hàm cập
 * nhật:
 *
 *   setTinNhan((ds) => {
 *     if (!daCoChu) { daCoChu = true; return [...ds, tinMoi] }
 *     return ds.map(...)            // ← nhánh cộng dồn
 *   })
 *
 * StrictMode gọi hai lần trên CÙNG một `ds`:
 *   lần 1 — `daCoChu` false → đặt thành true → trả về `[...ds, tinMoi]`
 *   lần 2 — `daCoChu` đã true → đi nhánh `map` trên `ds` GỐC, vốn chưa có tin
 *           đó → trả về `ds` y nguyên
 *
 * React giữ kết quả lần hai. Tin nhắn không bao giờ được thêm, và mọi mẩu chữ
 * sau đó cũng rơi vào nhánh `map` trên một danh sách không có nó — nên cả câu
 * trả lời biến mất.
 *
 * Triệu chứng đánh lừa: server hoàn toàn đúng — lượt `SUCCEEDED`, câu trả lời
 * nằm trong database, quota đã trừ. Chỉ màn hình là trống.
 *
 * Cách sửa không phải tắt StrictMode, mà là **suy trạng thái từ chính `ds`**.
 */
export function gopChu(ds: TinNhanUI[], idAi: string, chu: string): TinNhanUI[] {
  const viTri = ds.findIndex((t) => t.id === idAi)
  if (viTri === -1) {
    return [...ds, { id: idAi, vai: 'ai', noiDung: chu, dangViet: true }]
  }

  /*
   * Gọi lại với CÙNG `ds` phải ra CÙNG kết quả, nên phép cộng dồn tính từ
   * `ds[viTri].noiDung` chứ không từ giá trị mới nhất ở đâu khác.
   */
  return ds.map((t, i) => (i === viTri ? { ...t, noiDung: t.noiDung + chu } : t))
}

/** Đánh dấu tin AI đã viết xong. Thuần khiết, lặp lại được. */
export function danhDauXong(ds: TinNhanUI[], idAi: string): TinNhanUI[] {
  return ds.map((t) => (t.id === idAi ? { ...t, dangViet: false } : t))
}

export interface TinTuServer {
  id: string
  seq: number
  senderType: string
  body: string
  createdAt?: string
}

/**
 * Tin này của TÔI hay của người kia.
 *
 * ===========================================================================
 * PHẢI BIẾT "TÔI LÀ AI", KHÔNG SUY ĐƯỢC TỪ MỖI `senderType`
 * ===========================================================================
 * Bản trước viết: không phải AI, không phải SYSTEM → 'toi'. Đúng đúng một
 * trường hợp — sinh viên ngồi hỏi trợ lý, khi đó người thật duy nhất trong
 * phiên là chính họ.
 *
 * Từ lúc phiên chuyển sang nói với người thật thì có HAI người gửi. Sinh viên
 * mở màn hình lên thấy câu của nhà tuyển dụng nằm bên phải, nền xanh, y như
 * câu mình vừa gõ. Không có lỗi nào bắn ra; chỉ là cuộc trò chuyện đọc thành
 * một người tự nói với mình.
 *
 * Nên `toiLa` là THAM SỐ BẮT BUỘC. Quên truyền là lỗi biên dịch, không phải
 * một màn hình trông hơi lạ.
 */
const vaiTheoNguoiGui = (senderType: string, toiLa: NguoiGui): VaiNguoiNoi => {
  if (senderType === 'AI') return 'ai'
  if (senderType === 'SYSTEM') return 'he-thong'
  return senderType === toiLa ? 'toi' : 'ho'
}

/**
 * Ghép tin từ server (lịch sử, tải bù, hoặc `hoi-thoai:tin-moi`) vào danh sách.
 *
 * ===========================================================================
 * KHỬ TRÙNG THEO `seq`, KHÔNG THEO `id`
 * ===========================================================================
 * Một câu trả lời của AI đi tới màn hình bằng HAI đường:
 *
 *   SSE  — từng mẩu chữ, gom lại dưới một id tạm `ai-<clientMessageId>`
 *   Socket — `hoi-thoai:tin-moi` phát vào phòng của chủ phiên, mang id thật
 *
 * Cả hai đều cần: SSE cho tab đang hỏi, socket cho tab thứ hai của cùng người
 * dùng. Khử trùng theo `id` thì hai đường mang hai id khác nhau và tin hiện
 * hai lần.
 *
 * `seq` thì cả hai đường đều biết — SSE báo qua sự kiện `xong`, socket mang
 * sẵn trong tin. Nên nó là khoá đúng.
 *
 * Tin đang chảy dở chưa có `seq`; chúng giữ id tạm cho tới khi `xong` gán số.
 *
 * Thuần khiết và lặp lại được, cùng lý do với `gopChu`.
 */
export function gopLichSu(
  ds: TinNhanUI[],
  moi: TinTuServer[],
  toiLa: NguoiGui,
): TinNhanUI[] {
  let kq = ds

  for (const t of moi) {
    const viTri = kq.findIndex((c) => c.seq === t.seq)
    const thanh: TinNhanUI = {
      id: t.id,
      seq: t.seq,
      vai: vaiTheoNguoiGui(t.senderType, toiLa),
      noiDung: t.body,
      luc: t.createdAt,
    }
    kq = viTri === -1 ? [...kq, thanh] : kq.map((c, i) => (i === viTri ? thanh : c))
  }

  return sapTheoSeq(kq)
}

/**
 * Sắp theo `seq`; tin CHƯA có `seq` giữ nguyên thứ tự và đứng cuối.
 *
 * ===========================================================================
 * VÌ SAO PHẢI SẮP — TRƯỚC ĐÂY KHÔNG CẦN
 * ===========================================================================
 * Trước khi có phân trang, tin chỉ tới theo MỘT chiều: mới hơn. Nối vào cuối
 * là đủ đúng. Từ khi tải được trang CŨ HƠN thì tin tới theo cả hai chiều, và
 * nối vào cuối là đặt một trang tin từ tuần trước nằm dưới câu vừa nói.
 *
 * Sắp ở ĐÂY, một chỗ, thay vì bắt nơi gọi tự chọn "chèn đầu" hay "nối cuối":
 * tải bù sau khi mất mạng có thể chen giữa, và một tin tới qua socket có thể
 * tới trước một tin tới qua REST dù seq lớn hơn.
 *
 * ---------------------------------------------------------------------------
 * TIN CHƯA CÓ `seq` ĐỨNG CUỐI
 * ---------------------------------------------------------------------------
 * Đó là câu hỏi vừa gõ và câu trả lời AI đang chảy dở — luôn là thứ MỚI NHẤT.
 * Server chưa cấp số cho chúng; so sánh `undefined` với số là để chúng nhảy
 * loạn trong danh sách.
 *
 * `sort` của JS ổn định (ES2019), nên tin cùng nhóm giữ nguyên thứ tự cũ.
 */
function sapTheoSeq(ds: TinNhanUI[]): TinNhanUI[] {
  return [...ds].sort((a, b) => {
    if (a.seq === undefined && b.seq === undefined) return 0
    if (a.seq === undefined) return 1
    if (b.seq === undefined) return -1
    return a.seq - b.seq
  })
}

/** Gán `seq` cho một tin tạm, để lần phát qua socket sau đó không tạo bản sao. */
export function danhSoTin(ds: TinNhanUI[], id: string, seq: number): TinNhanUI[] {
  return ds.map((t) => (t.id === id ? { ...t, seq } : t))
}

/* ====================================================== mốc thời gian -- */

/** Khoảng lặng đủ dài để chèn một mốc thời gian. 20 phút. */
const KHE_MOC_MS = 20 * 60_000

export interface TinCoMoc {
  tin: TinNhanUI
  /** Dòng ngăn cách phía TRÊN tin này. `null` nếu không cần. */
  moc: string | null
  /** Có hiện giờ dưới bong bóng này không. */
  hienGio: boolean
}

/**
 * Quyết định chỗ nào hiện mốc thời gian, chỗ nào hiện giờ.
 *
 * ===========================================================================
 * KHÔNG GẮN GIỜ VÀO MỌI BONG BÓNG
 * ===========================================================================
 * Mười tin nhắn liên tiếp trong một phút, mỗi cái một dòng "14:32" phía dưới,
 * là mười dòng nhiễu nói cùng một điều. Mắt phải lọc chúng để đọc nội dung.
 *
 * Nếp mà mọi ứng dụng nhắn tin dùng, và lý do của từng phần:
 *
 *   MỐC ngăn cách  khi cách tin trước >20 phút, hoặc sang ngày khác. Đây là
 *                  thứ trả lời "cuộc trò chuyện này diễn ra khi nào".
 *
 *   GIỜ dưới bóng  chỉ ở tin CUỐI của một chuỗi liên tiếp cùng người nói.
 *                  Trả lời "câu này nói lúc mấy giờ" mà không lặp lại.
 *
 * Hàm thuần, không đọc `Date.now()`: cùng đầu vào luôn ra cùng kết quả, nên
 * test được và không nhấp nháy giữa hai lần render.
 */
export function danhDauThoiGian(ds: TinNhanUI[]): TinCoMoc[] {
  return ds.map((tin, i) => {
    const truoc = ds[i - 1]
    const sau = ds[i + 1]

    return {
      tin,
      moc: canMoc(truoc?.luc, tin.luc) ? nhanMoc(tin.luc!) : null,
      /*
       * Tin cuối danh sách luôn hiện giờ. Tin giữa chuỗi chỉ hiện khi người
       * nói tiếp theo KHÁC — hoặc khi tin sau đó đã cách xa tới mức có mốc
       * riêng, vì lúc đó chuỗi coi như đã đứt.
       */
      hienGio:
        tin.luc !== undefined &&
        tin.vai !== 'he-thong' &&
        (sau === undefined || sau.vai !== tin.vai || canMoc(tin.luc, sau.luc)),
    }
  })
}

function canMoc(truoc: string | undefined, nay: string | undefined): boolean {
  if (nay === undefined) return false
  /* Tin đầu tiên có giờ thì luôn mở đầu bằng một mốc. */
  if (truoc === undefined) return true

  const a = new Date(truoc)
  const b = new Date(nay)
  if (b.getTime() - a.getTime() >= KHE_MOC_MS) return true
  return a.toDateString() !== b.toDateString()
}

/** "14:32" nếu là hôm nay, "Hôm qua 14:32", còn lại "02/10 14:32". */
function nhanMoc(iso: string): string {
  const d = new Date(iso)
  const gio = gioPhut(iso)

  const homNay = new Date()
  const homQua = new Date(homNay.getTime() - 86_400_000)

  if (d.toDateString() === homNay.toDateString()) return gio
  if (d.toDateString() === homQua.toDateString()) return `Hôm qua ${gio}`

  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${gio}`
}

/** "14:32". Tách riêng vì bong bóng chỉ cần giờ, không cần ngày. */
export function gioPhut(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
