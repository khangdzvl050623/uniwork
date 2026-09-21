/**
 * Hai hàm THUẦN đọc dấu vết của một lượt: model đã gọi tool nào, kết quả ra sao.
 *
 * Tách khỏi `tro-ly.service.ts` để test được mà không phải dựng Prisma, Express
 * hay AI SDK — chúng chỉ nhận một mảng và trả một chuỗi.
 */

export interface GoiTool {
  ten: string
  ketQua: unknown
}

export interface DeNghiNTD {
  jobId: string
  tenTin: string
  congTy: string
  lyDo: string
}

export function layDeNghi(goiTool: GoiTool[]): DeNghiNTD | null {
  for (const g of goiTool) {
    if (g.ten !== 'deNghiChuyenNhaTuyenDung') continue
    const d = (g.ketQua as { deNghi?: DeNghiNTD | null }).deNghi
    if (d) return d
  }
  return null
}

/**
 * Nhãn nhóm câu hỏi, SUY TỪ DẤU VẾT — không hỏi model nó vừa làm gì.
 *
 * ---------------------------------------------------------------------------
 * ĐÂY LÀ TELEMETRY, KHÔNG PHẢI THƯỚC ĐO CHẤT LƯỢNG
 * ---------------------------------------------------------------------------
 * Quy tắc này có một lỗ mà chính nó không thấy được: "không gọi tool nào" có
 * thể là ngoài phạm vi, có thể là thiếu ngữ cảnh, và cũng có thể là model đã
 * trả lời sai mà không thèm tra cứu. Ba ca đó không phân biệt được từ dấu vết.
 *
 * Nên có `UNKNOWN`, và nó KHÔNG được thay bằng một phỏng đoán: tỉ lệ UNKNOWN
 * cao chính là tín hiệu quy tắc này cần sửa, và tín hiệu đó biến mất nếu ép mọi
 * lượt vào một nhãn. Ground truth là nhãn người, chấm bằng bộ 40 câu.
 */
export function suyNhan(goiTool: GoiTool[]): string {
  if (goiTool.length === 0) return 'UNKNOWN'
  const ten = new Set(goiTool.map((g) => g.ten))
  if (ten.has('deNghiChuyenNhaTuyenDung')) return 'CAN_NHA_TUYEN_DUNG'
  if (ten.has('huongDanSuDung')) return 'HUONG_DAN_SU_DUNG'
  return goiTool.some(coDuLieu) ? 'TRA_CUU' : 'KHONG_CO_DU_LIEU'
}

/** Tool chạy được nhưng trả về mảng rỗng — "đúng phạm vi, không có dữ liệu". */
function coDuLieu(g: GoiTool): boolean {
  const k = g.ketQua as Record<string, unknown> | null
  if (k === null || typeof k !== 'object') return false
  if (k.ok === false) return false
  return Object.values(k).some((v) => (Array.isArray(v) ? v.length > 0 : false))
}
