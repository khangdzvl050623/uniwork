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
    eligible: matchedShifts >= nguongCaToiThieu(totalJobShifts, minShiftsPerWeek),
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
export function nguongCaToiThieu(totalJobShifts: number, minShiftsPerWeek?: number | null): number {
  return Math.min(minShiftsPerWeek ?? 1, totalJobShifts)
}

/** Ngưỡng đổi màu badge điểm phù hợp. Để ở đây để web và tài liệu cùng một mốc. */
export const NGUONG_PHU_HOP = { cao: 80, vua: 40 } as const

/* ==========================================================================
 * SPRINT 4 — ĐIỂM PHÙ HỢP TỔNG HỢP
 *
 * Sprint 3 chấm điểm chỉ theo ca làm. Sprint 4 mở rộng thành ba thành phần
 * (ca làm, kỹ năng, cam kết) và đóng băng kết quả vào `Application` lúc nộp đơn.
 *
 * Ba hàm ở dưới — `duNguongCa`, `tongHopDiem`, `tinhDoPhu` — CỐ Ý không hàm nào
 * gọi hàm kia. Chúng trả lời ba câu hỏi khác loại nhau:
 *
 *   duNguongCa  — "Có nhận nổi việc này không?"     → ràng buộc cứng, có/không
 *   tongHopDiem — "Hợp tới đâu?"                    → mức độ, để xếp hạng
 *   tinhDoPhu   — "Con số kia tính trên mấy tiêu chí?" → độ tin cậy của chính nó
 *
 * Trộn chúng lại là lỗi loại hình. Chi tiết ở docs/sprint-4.md.
 * ========================================================================== */

/** Vì sao một thành phần không có điểm. Xem `ThanhPhan.vangVi`. */
export type LyDoVang =
  /** Thuộc về TIN: tiêu chí này không tồn tại cho tin đó (tin không yêu cầu kỹ năng nào). */
  | 'KHONG_AP_DUNG'
  /** Thuộc về SINH VIÊN: chưa khai nên chưa đo được (chưa điền `availableUntil`). */
  | 'THIEU_DU_LIEU'

/** Một thành phần của điểm tổng hợp. */
export interface ThanhPhan {
  /** `null` = KHÔNG TÍNH ĐƯỢC. Khác hẳn `0` (tính được, kết quả là không khớp). */
  score: number | null
  weight: number
  /**
   * Vì sao `score` là `null`. KHÔNG tham gia phép tính điểm — chỉ để đếm độ phủ
   * và nhắc đúng người. Bỏ trống khi `score` có giá trị.
   */
  vangVi?: LyDoVang
}

/**
 * Độ phủ: điểm tổng hợp được tính trên bao nhiêu tiêu chí.
 *
 * HAI số chứ không phải một phân số, và mẫu số KHÔNG cứng bằng 3.
 *
 * Tin "Phát tờ rơi" không yêu cầu kỹ năng, `ONE_TIME` nên không có cam kết:
 * sinh viên khai đủ mọi thứ tin đó cần. Mẫu số cứng bằng 3 sẽ ghi "tính trên
 * 1/3 tiêu chí" và bêu một hồ sơ HOÀN CHỈNH là thiếu, rồi nhắc họ đi khai thứ
 * chẳng ai hỏi. Loại `KHONG_AP_DUNG` khỏi mẫu số thì ca đó ra `1/1` — im lặng,
 * đúng như nó phải thế.
 */
export interface DoPhu {
  /** Số tiêu chí TIN NÀY có yêu cầu. */
  apDung: number
  /** Số tiêu chí đo được cho SINH VIÊN NÀY. */
  doDuoc: number
}

/**
 * Trọng số mặc định.
 *
 * Ca làm nặng nhất vì UniWork tồn tại nhờ lọc theo lịch rảnh — thứ các trang
 * tuyển dụng phổ thông không có. Kỹ năng cho việc part-time phần lớn đào tạo
 * được; lịch học thì không.
 *
 * Nói thẳng: CHƯA có dữ liệu nào chứng minh 0.5/0.3/0.2 đúng hơn 0.4/0.4/0.2.
 * Tiêu chí chọn ở đây là "nói đúng thứ sản phẩm tự nhận về mình", không phải
 * "đúng" — và đó là tiêu chí tốt nhất có được lúc chưa có hành vi người dùng.
 * `matchAlgoVersion` tồn tại chính để đổi bộ số này sau mà không làm hỏng ý
 * nghĩa của những hàng đã ghi.
 */
export const TRONG_SO_MAC_DINH = { shifts: 0.5, skills: 0.3, commitment: 0.2 } as const

/** Đời công thức của những hàng ghi bằng mã hiện tại. Đóng băng vào `Application`. */
export const PHIEN_BAN_CHAM_DIEM = 'v1'

/**
 * CỔNG — ràng buộc cứng, KHÔNG bao giờ tham gia phép trung bình.
 *
 * Tin cần tối thiểu 5 ca/tuần mà sinh viên chỉ nhận nổi 1 thì họ không làm được
 * việc đó, chấm hết. Để 100% kỹ năng kéo điểm tổng lên là nói rằng giỏi nghề bù
 * được cho việc không có mặt lúc quán cần người. Không bù được.
 *
 * `required` phải là giá trị đã qua `nguongCaToiThieu`, không phải cột thô.
 */
export function duNguongCa(matched: number, required: number): boolean {
  return matched >= required
}

/**
 * ĐIỂM — trung bình có trọng số, tự bỏ qua thành phần `null` và chuẩn hoá lại
 * phần còn lại.
 *
 * Viết tổng quát chứ không xử lý từng nhánh `if`: hôm nay ba thành phần, mai
 * thêm khoảng cách địa lý và mức lương mong muốn là năm. Viết `if` cho từng tổ
 * hợp thiếu thì 5 thành phần đã là 31 nhánh, và nhánh nào sai cũng chỉ biểu
 * hiện thành một con số hơi lệch — không ai phát hiện ra.
 *
 * Không thành phần nào đo được → `null`, KHÔNG phải 0.
 */
export function tongHopDiem(cac: Record<string, ThanhPhan>): number | null {
  const dungDuoc = Object.values(cac).filter((c) => c.score !== null)
  if (dungDuoc.length === 0) return null

  const tongTrongSo = dungDuoc.reduce((s, c) => s + c.weight, 0)
  if (tongTrongSo === 0) return null

  const tong = dungDuoc.reduce((s, c) => s + (c.score as number) * c.weight, 0)
  return Math.round(tong / tongTrongSo)
}

/**
 * ĐỘ PHỦ — hàm thứ ba, và cũng không gọi hai hàm kia.
 *
 * Luật hiển thị chỉ có một dòng: `apDung === doDuoc` thì im lặng, khác thì hiện
 * "tính trên doDuoc/apDung tiêu chí". Không cần biết vì sao lệch — mẫu số đã tự
 * loại phần không thuộc lỗi sinh viên.
 */
export function tinhDoPhu(cac: Record<string, ThanhPhan>): DoPhu {
  const tp = Object.values(cac)
  return {
    apDung: tp.filter((c) => c.vangVi !== 'KHONG_AP_DUNG').length,
    doDuoc: tp.filter((c) => c.score !== null).length,
  }
}

/* -------------------------------------------------------------------------- */

/** Thành phần ca làm, kèm số liệu đủ để đọc lại sau nhiều tháng. */
export interface ThanhPhanCa extends ThanhPhan {
  matched: number
  total: number
  /**
   * Ngưỡng ca tối thiểu TẠI THỜI ĐIỂM NỘP.
   *
   * `minShiftsPerWeek` KHÔNG nằm trong `TRUONG_BAT_DUYET_LAI`, nghĩa là nhà
   * tuyển dụng sửa nó lúc nào cũng được, không cần admin duyệt. Không đóng băng
   * con số này thì đơn nộp hôm nay với 8/20 ca (ngưỡng 5 → đủ) sẽ thành "không
   * đủ" khi NTD nâng ngưỡng lên 10 tuần sau — lịch sử bị viết lại sau lưng.
   */
  required: number
}

/** Thành phần kỹ năng. `total` là số kỹ năng TIN yêu cầu, không phải số sinh viên có. */
export interface ThanhPhanKyNang extends ThanhPhan {
  matched: number
  total: number
}

/** Thành phần cam kết thời gian. */
export interface ThanhPhanCamKet extends ThanhPhan {
  /** Số tháng sinh viên còn đi làm được, tính từ mốc bắt đầu. `null` khi chưa khai. */
  months: number | null
  /** `job.commitmentMonths`. `null` khi tin không yêu cầu cam kết. */
  required: number | null
}

/**
 * Toàn bộ chi tiết chấm điểm, đóng băng vào `Application.matchBreakdown`.
 *
 * Lưu JSON chứ không mỗi thành phần một cột: thêm tiêu chí mới sau này (khoảng
 * cách địa lý, mức lương mong muốn) không cần migration. Đổi lại JSON truy vấn
 * chậm hơn — nên `matchScore` vẫn là cột riêng có index để sắp xếp ở tầng SQL.
 */
export interface MatchBreakdown {
  shifts: ThanhPhanCa
  skills: ThanhPhanKyNang
  commitment: ThanhPhanCamKet
  coverage: DoPhu
  /** Suy từ `shifts.matched >= shifts.required`. Ghi sẵn cho dễ đọc. */
  eligible: boolean | null
  finalScore: number | null
}

/** Dữ liệu cần để chấm điểm một cặp (sinh viên, tin). */
export interface DauVaoChamDiem {
  /* --- phía TIN --- */
  caLam: O[]
  minShiftsPerWeek?: number | null
  /** Id kỹ năng tin yêu cầu. Rỗng = tin không yêu cầu kỹ năng nào. */
  kyNangTin: string[]
  commitmentMonths?: number | null
  /**
   * Mốc bắt đầu tính cam kết: `job.startDate` nếu tin có, không thì thời điểm
   * nộp đơn. Truyền vào chứ không gọi `new Date()` bên trong — hàm phải thuần
   * để test được, và để hai lần chấm cùng dữ liệu luôn ra cùng kết quả.
   */
  mocBatDau: Date

  /* --- phía SINH VIÊN --- */
  lichRanh?: O[] | null
  /** Id kỹ năng sinh viên khai. Rỗng/`null` = chưa khai, KHÔNG phải "không có kỹ năng nào". */
  kyNangSinhVien?: string[] | null
  availableUntil?: Date | null
}

/**
 * Chấm điểm phù hợp đầy đủ ba thành phần.
 *
 * Gọi ở đúng MỘT chỗ: lúc tạo `Application`. Kết quả đóng băng, không bao giờ
 * tính lại — nhà tuyển dụng mở đơn tháng sau vẫn thấy đúng con số hồi đó, kể cả
 * khi sinh viên đã đổi lịch rảnh từ lâu.
 */
export function chamDiemPhuHop(dv: DauVaoChamDiem): MatchBreakdown {
  const shifts = thanhPhanCa(dv)
  const skills = thanhPhanKyNang(dv)
  const commitment = thanhPhanCamKet(dv)

  const cac = { shifts, skills, commitment }

  return {
    shifts,
    skills,
    commitment,
    coverage: tinhDoPhu(cac),
    // `eligible` lấy từ CỔNG, không lấy từ điểm. `null` khi chưa đo được ca nào.
    eligible: shifts.score === null ? null : duNguongCa(shifts.matched, shifts.required),
    finalScore: tongHopDiem(cac),
  }
}

function thanhPhanCa(dv: DauVaoChamDiem): ThanhPhanCa {
  const total = dv.caLam.length
  const required = nguongCaToiThieu(total, dv.minShiftsPerWeek)

  // Tin không có ca nào: không phải lỗi sinh viên, cũng không có gì để đo.
  if (total === 0) {
    return {
      matched: 0,
      total: 0,
      required,
      score: null,
      weight: TRONG_SO_MAC_DINH.shifts,
      vangVi: 'KHONG_AP_DUNG',
    }
  }

  // Chưa khai lịch rảnh: thuộc về sinh viên, và có nhắc họ khai.
  if (!dv.lichRanh || dv.lichRanh.length === 0) {
    return {
      matched: 0,
      total,
      required,
      score: null,
      weight: TRONG_SO_MAC_DINH.shifts,
      vangVi: 'THIEU_DU_LIEU',
    }
  }

  const oRanh = new Set(dv.lichRanh.map(khoa))
  const matched = dv.caLam.filter((ca) => oRanh.has(khoa(ca))).length

  return {
    matched,
    total,
    required,
    score: Math.round((matched / total) * 100),
    weight: TRONG_SO_MAC_DINH.shifts,
  }
}

function thanhPhanKyNang(dv: DauVaoChamDiem): ThanhPhanKyNang {
  const total = dv.kyNangTin.length

  // Tin không yêu cầu kỹ năng nào → KHÔNG ÁP DỤNG, không phải 100.
  // Cho 100 sẽ kéo điểm mọi ứng viên của tin đó lên bằng một tiêu chí trống rỗng.
  if (total === 0) {
    return {
      matched: 0,
      total: 0,
      score: null,
      weight: TRONG_SO_MAC_DINH.skills,
      vangVi: 'KHONG_AP_DUNG',
    }
  }

  // Chưa khai kỹ năng nào. Database không phân biệt được "khai rồi mà rỗng" với
  // "chưa khai" — không có hàng `StudentSkill` nào là hết. Nên coi là THIẾU DỮ
  // LIỆU và nhắc họ khai, thay vì chấm 0 rồi im lặng.
  const cua = dv.kyNangSinhVien
  if (!cua || cua.length === 0) {
    return {
      matched: 0,
      total,
      score: null,
      weight: TRONG_SO_MAC_DINH.skills,
      vangVi: 'THIEU_DU_LIEU',
    }
  }

  const co = new Set(cua)
  const matched = dv.kyNangTin.filter((id) => co.has(id)).length

  return {
    matched,
    total,
    score: Math.round((matched / total) * 100),
    weight: TRONG_SO_MAC_DINH.skills,
  }
}

function thanhPhanCamKet(dv: DauVaoChamDiem): ThanhPhanCamKet {
  const required = dv.commitmentMonths ?? null

  // Tin không yêu cầu cam kết (ONE_TIME, hoặc NTD bỏ trống) → KHÔNG ÁP DỤNG.
  if (required === null || required <= 0) {
    return {
      months: null,
      required: null,
      score: null,
      weight: TRONG_SO_MAC_DINH.commitment,
      vangVi: 'KHONG_AP_DUNG',
    }
  }

  // Chưa khai `availableUntil`. Cột này là cột chết từ Sprint 0 nên PHẦN LỚN
  // sinh viên sẽ để trống. Cho 0 là khẳng định "đã đo, bạn không cam kết được
  // gì" về thứ chưa hỏi bao giờ.
  if (!dv.availableUntil) {
    return {
      months: null,
      required,
      score: null,
      weight: TRONG_SO_MAC_DINH.commitment,
      vangVi: 'THIEU_DU_LIEU',
    }
  }

  const months = soThangTronVen(dv.mocBatDau, dv.availableUntil)

  // Tính theo PHẦN chứ không nhị phân: cam kết được 2/3 tháng vẫn đáng để NTD
  // cân nhắc, nhiều quán chấp nhận. Trả 0 tuyệt đối là để hệ thống từ chối thay
  // nhà tuyển dụng — đúng thứ đã bác ở luật "cho nộp kèm cảnh báo".
  //
  // `months = 0` ở đây là số ĐÃ ĐO (đã khai, và khai xong thì không đủ), khác
  // hẳn nhánh `null` phía trên.
  return {
    months,
    required,
    score: Math.min(100, Math.round((months / required) * 100)),
    weight: TRONG_SO_MAC_DINH.commitment,
  }
}

/**
 * Số tháng TRỌN VẸN giữa hai mốc, không âm.
 *
 * Đếm theo lịch chứ không chia cho "30 ngày": cam kết 6 tháng là chuyện của
 * tháng, không phải của 180 ngày, và mọi hằng số ngày-trong-tháng đều là một
 * con số bịa (30? 30.44?). Đếm lịch còn khớp với cách người ta tự nhẩm.
 *
 * `01/09 → 30/11` cho 2 chứ không phải 3: chưa qua ngày 01/12 thì tháng thứ ba
 * chưa trọn. Thà thiếu một chút còn hơn hứa thay sinh viên.
 */
export function soThangTronVen(tu: Date, den: Date): number {
  let thang = (den.getFullYear() - tu.getFullYear()) * 12 + (den.getMonth() - tu.getMonth())
  if (den.getDate() < tu.getDate()) thang -= 1
  return Math.max(0, thang)
}
