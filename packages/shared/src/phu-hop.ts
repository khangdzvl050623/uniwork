import type { DayOfWeek, TimeSlot } from './domain.js'

/** Một ô trong lưới 7 ngày × 3 buổi — dùng chung cho ca làm và lịch rảnh. */
interface O {
  dayOfWeek: DayOfWeek
  slot: TimeSlot
}

const khoa = (o: O) => `${o.dayOfWeek}:${o.slot}`

/**
 * Kết quả ghép lịch rảnh của một sinh viên với ca làm của một tin.
 *
 * Bốn con số, KHÔNG phải một. Xem giải thích ở `ghepLich`.
 */
export interface KetQuaGhepLich {
  /** Số ca của tin nằm trong lịch rảnh. */
  matchedShifts: number
  /** Tổng số ca nhà tuyển dụng mở. */
  totalJobShifts: number
  /**
   * Sinh viên có nhận đủ số ca tối thiểu tin yêu cầu không.
   * `null` = chưa đo được (chưa khai lịch rảnh, hoặc người xem không phải sinh viên).
   */
  eligible: boolean | null
  /**
   * Phần trăm ca của tin mà sinh viên rảnh: `matchedShifts / totalJobShifts`.
   * `null` = chưa đo được. KHÁC HẲN `0` (đã đo, không trùng ca nào).
   */
  matchScore: number | null
}

/**
 * Ghép lịch rảnh của sinh viên với ca làm của một tin.
 *
 * ---------------------------------------------------------------------------
 * `job_shifts` LÀ CA NHÀ TUYỂN DỤNG **MỞ**, KHÔNG PHẢI CA BẮT BUỘC LÀM HẾT
 * ---------------------------------------------------------------------------
 * Chốt 2026-08-27. Đây là cách hiểu khớp với tin part-time thật ở Việt Nam:
 * quán mở gần như cả tuần rồi yêu cầu người làm nhận tối thiểu N ca
 * (`minShiftsPerWeek`). Cách hiểu kia — "đây là lịch cố định, nhận là làm hết"
 * — khiến chính cột `minShiftsPerWeek` trở nên vô nghĩa: làm hết thì lấy đâu ra
 * "tối thiểu".
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TÁCH `eligible` KHỎI `matchScore` — HAI CÂU HỎI KHÁC NHAU
 * ---------------------------------------------------------------------------
 *   eligible   — "Tôi CÓ nhận nổi việc này không?"   → có/không, so với ngưỡng
 *   matchScore — "Việc này hợp lịch tôi tới đâu?"    → mức độ, để xếp hạng
 *
 * Gộp làm một là hỏng theo cả hai chiều:
 *
 * - Lấy `matched / minShiftsPerWeek` làm điểm thì MỌI người đủ điều kiện đều
 *   thành 100%. Sinh viên trùng 5/20 ca và sinh viên trùng 18/20 ca hiện giống
 *   hệt nhau, điểm số mất sạch khả năng phân biệt — mà phân biệt chính là lý do
 *   nó tồn tại.
 * - Lấy `matched / totalJobShifts` làm cổng vào thì tin mở 20 ca cần 5 sẽ loại
 *   oan người trùng 8 ca (40%), dù 8 ≥ 5 nên họ thừa sức nhận việc.
 *
 * ---------------------------------------------------------------------------
 * MẪU SỐ CỦA ĐIỂM LÀ SỐ CA CỦA TIN, KHÔNG PHẢI SỐ Ô RẢNH CỦA SINH VIÊN
 * ---------------------------------------------------------------------------
 * Câu hỏi cần trả lời là "tôi phủ được bao nhiêu phần lịch của việc này", không
 * phải "việc này lấp được bao nhiêu phần thời gian rảnh của tôi". Lấy số ô rảnh
 * làm mẫu số thì sinh viên rảnh cả 21 ô sẽ thấy MỌI tin đều dưới 20% — càng
 * rảnh càng bị chấm thấp, đúng ngược với ý nghĩa cần có.
 *
 * Hệ quả cần biết khi xếp hạng: tin mở nhiều ca luôn khó đạt điểm cao hơn tin
 * ít ca. Nên chỗ sắp xếp phải để `eligible` đứng trước điểm, không sắp thuần
 * theo điểm — xem `listPublicJobs`.
 */
export function ghepLich(
  caLam: O[],
  lichRanh: O[] | null | undefined,
  minShiftsPerWeek?: number | null,
): KetQuaGhepLich {
  const totalJobShifts = caLam.length

  // Chưa khai lịch rảnh, hoặc tin không có ca nào (Zod chặn, nhưng dữ liệu vá
  // tay thì có thể lọt): không có gì để đối chiếu. Trả `null` chứ không phải
  // `0` — `0` là một lời khẳng định ("đã đo, không hợp") về thứ chưa hề đo được.
  if (!lichRanh || lichRanh.length === 0 || totalJobShifts === 0) {
    return { matchedShifts: 0, totalJobShifts, eligible: null, matchScore: null }
  }

  const oRanh = new Set(lichRanh.map(khoa))
  const matchedShifts = caLam.filter((ca) => oRanh.has(khoa(ca))).length

  return {
    matchedShifts,
    totalJobShifts,
    eligible: matchedShifts >= nguongCan(totalJobShifts, minShiftsPerWeek),
    matchScore: Math.round((matchedShifts / totalJobShifts) * 100),
  }
}

/**
 * Số ca tối thiểu thực sự phải nhận được để đủ điều kiện.
 *
 * Hai chỗ chỉnh so với giá trị thô trong database:
 *
 * 1. `null` → 1. Tin không quy định số ca tối thiểu (ONE_TIME, và SEASONAL nếu
 *    nhà tuyển dụng bỏ trống) thì chỉ cần nhận được ít nhất một ca là làm được.
 *    Để 0 sẽ khiến sinh viên không trùng ca nào cũng "đủ điều kiện".
 *
 * 2. Chặn trần ở tổng số ca mở. Tin yêu cầu 5 ca/tuần nhưng chỉ mở 3 ca là tin
 *    KHÔNG AI làm được — một lỗi nhập liệu, không phải một yêu cầu khắt khe.
 *    Không chặn thì tin đó biến mất khỏi mọi kết quả lọc và nhà tuyển dụng
 *    không bao giờ biết vì sao tin của mình không ai thấy.
 *
 *    `createJobSchema` đã chặn không cho tạo mới tin như vậy; dòng này lo cho
 *    dữ liệu đã có từ trước — cùng mẫu "chặn ở cả hai tầng" dùng xuyên suốt dự án.
 */
function nguongCan(totalJobShifts: number, minShiftsPerWeek?: number | null): number {
  return Math.min(minShiftsPerWeek ?? 1, totalJobShifts)
}

/** Ngưỡng đổi màu badge điểm phù hợp. Để ở đây để web và tài liệu cùng một mốc. */
export const NGUONG_PHU_HOP = { cao: 80, vua: 40 } as const
