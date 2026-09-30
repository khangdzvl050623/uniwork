import {
  DAY_FULL_LABELS,
  SALARY_UNIT_LABELS,
  TIME_SLOT_LABELS,
  TRANG_THAI_MO_LIEN_HE,
  type ApplicationStatus,
  type AvailabilitySlot,
  type JobShiftItem,
  type PublicJobDetail,
  type PublicJobSummary,
  type ScheduleType,
  type SkillResponse,
  type StudentApplicationItem,
  type StudentProfileResponse,
} from '@uniwork/shared'
import { bocNguon, catChuoi, raSoat } from './luoc-pii.js'

/**
 * Thu nhỏ response của service xuống hình dạng model đọc được.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG TRẢ THẲNG RESPONSE CỦA SERVICE
 * ---------------------------------------------------------------------------
 * Hai lý do độc lập, và mỗi lý do một mình đã đủ:
 *
 *   TIỀN. `PublicJobSummary` đầy đủ ≈ 700 token một tin. Năm tin là 3.500
 *   token, nhân với bốn vòng tool là hết cửa sổ và đốt hạn mức TPM cho một câu
 *   hỏi. Bản gọn ≈ 60 token một tin.
 *
 *   RIÊNG TƯ. Xem `luoc-pii.ts`.
 *
 * Mọi hàm ở đây kết thúc bằng `raSoat(...)` — đó là cổng ra, không phải một
 * bước kiểm tra tuỳ chọn.
 */

/* ------------------------------------------------------------ tin tuyển dụng -- */

export interface TinGon {
  id: string
  tenTin: string
  congTy: string
  daXacMinh: boolean
  /** "Cầu Giấy, Hà Nội" */
  noiLam: string
  /** "25.000 - 30.000đ/giờ" hoặc "Thoả thuận/giờ" */
  luong: string
  kieuLich: ScheduleType
  /**
   * `null` GIỮ NGUYÊN là `null`, không đổi thành 0.
   *
   * `null` = chưa đo được (chưa khai lịch rảnh). `0` = đã đo, và không hợp ca
   * nào. Đổi cái trước thành cái sau ở tầng này là cách chắc chắn nhất khiến AI
   * nói ngược với màn hình, dù system prompt có dặn kỹ tới đâu.
   */
  matchScore: number | null
  eligible: boolean | null
  soCaHop: number
  tongCa: number
  /** 'YYYY-MM-DD' */
  hanNop: string
}

/** "25.000 - 30.000đ/giờ". Cùng quy tắc với `formatSalary` của apps/web. */
function chuoiLuong(j: PublicJobSummary): string {
  const donVi = `/${SALARY_UNIT_LABELS[j.salaryUnit]}`
  if (j.salaryNegotiable || j.salaryMin === null || j.salaryMax === null) {
    return `Thoả thuận${donVi}`
  }
  const so = (n: number) => n.toLocaleString('vi-VN')
  if (j.salaryMin === j.salaryMax) return `${so(j.salaryMin)}đ${donVi}`
  return `${so(j.salaryMin)} - ${so(j.salaryMax)}đ${donVi}`
}

/** "Thứ Hai buổi sáng" — model đọc câu này, không đọc `{dayOfWeek: 1, slot: 'MORNING'}`. */
function chuoiCa(c: JobShiftItem | AvailabilitySlot): string {
  return `${DAY_FULL_LABELS[c.dayOfWeek]} buổi ${TIME_SLOT_LABELS[c.slot].label.toLocaleLowerCase('vi-VN')}`
}

export function tinGon(j: PublicJobSummary): TinGon {
  return raSoat('tinTuyenDung', {
    id: j.id,
    tenTin: j.title,
    congTy: j.employer.companyName,
    daXacMinh: j.employer.verified,
    noiLam: `${j.district}, ${j.city}`,
    luong: chuoiLuong(j),
    kieuLich: j.scheduleType,
    matchScore: j.matchScore,
    eligible: j.eligible,
    soCaHop: j.matchedShifts,
    tongCa: j.totalJobShifts,
    hanNop: j.deadline.slice(0, 10),
  })
}

export interface TinChiTietGon extends TinGon {
  moTa: string
  yeuCau: string[]
  phucLoi: string[]
  soLuong: number
  caLam: string[]
  kyNang: string[]
  camKetThang: number | null
  soCaToiThieuTuan: number | null
  ngayBatDau: string | null
  ngayKetThuc: string | null
}

/** Trần độ dài cho từng mẩu văn tự do lấy từ database. */
const TRAN_MO_TA = 500
const TRAN_MOT_DONG = 120
const TRAN_SO_DONG = 8

export function tinChiTietGon(j: PublicJobDetail): TinChiTietGon {
  return raSoat('tinChiTiet', {
    ...tinGon(j),
    moTa: bocNguon('job.description', catChuoi(j.description, TRAN_MO_TA)),
    yeuCau: j.requirements
      .slice(0, TRAN_SO_DONG)
      .map((d) => bocNguon('job.requirements', catChuoi(d, TRAN_MOT_DONG))),
    phucLoi: j.benefits
      .slice(0, TRAN_SO_DONG)
      .map((d) => bocNguon('job.benefits', catChuoi(d, TRAN_MOT_DONG))),
    soLuong: j.quantity,
    caLam: j.shifts.map(chuoiCa),
    kyNang: j.skills.map((k) => k.name),
    camKetThang: j.commitmentMonths,
    soCaToiThieuTuan: j.minShiftsPerWeek,
    ngayBatDau: j.startDate?.slice(0, 10) ?? null,
    ngayKetThuc: j.endDate?.slice(0, 10) ?? null,
  })
}

/* ---------------------------------------------------------------- hồ sơ -- */

export interface HoSoGon {
  truong: string | null
  nganh: string | null
  namHoc: number | null
  luongMongMuon: number | null
  lamDuocToiNgay: string | null
  kyNang: string[]
  /**
   * Có CV hay chưa — MỘT BIT, không phải `cvUrl`.
   *
   * Model chỉ cần biết để nói "bạn chưa tải CV lên". Đưa cả đường dẫn vào ngữ
   * cảnh là đưa một URL tải được file PII ra ngoài, đổi lấy đúng con số không.
   */
  coCv: boolean
}

/**
 * `bio` CỐ Ý không có mặt.
 *
 * Đây là chỗ bản viết đầu của file này sai, và ca canh trong
 * `tools.sinh-vien.test.ts` bắt được: sinh viên viết phần giới thiệu bằng lời
 * của mình, và câu đầu tiên rất hay là "Em là Nguyễn Văn An". Bộ che theo hình
 * dạng chỉ bắt được sđt và email — nó không biết chuỗi nào là tên người, chuỗi
 * nào là địa chỉ nhà.
 *
 * Đổi lại gần như không mất gì: kỹ năng, trường, ngành, mức lương mong muốn đã
 * mang đủ tín hiệu để gợi việc. Cần đưa `bio` vào sau này thì phải kèm một cách
 * che tên người, không phải chỉ thêm một dòng vào danh sách cho phép.
 */
export function hoSoGon(h: StudentProfileResponse): HoSoGon {
  return raSoat('hoSoSinhVien', {
    truong: h.university,
    nganh: h.major,
    namHoc: h.year,
    luongMongMuon: h.expectedHourlyRate,
    lamDuocToiNgay: h.availableUntil?.slice(0, 10) ?? null,
    kyNang: h.skills.map((k) => k.name),
    coCv: h.cvUrl !== null,
  })
}

/* ----------------------------------------------------------- đơn ứng tuyển -- */

export interface DonGon {
  id: string
  jobId: string
  tenTin: string
  congTy: string
  trangThai: ApplicationStatus
  matchScore: number | null
  ngayNop: string
  /**
   * Đơn đã tới bước mở liên hệ chưa.
   *
   * Thay cho cả khối `job.employer.contact { contactName, phone, email }`. Model
   * nói được "nhà tuyển dụng đã mở liên hệ, bạn xem ở trang Đơn ứng tuyển" mà
   * không cần cầm ba trường kia.
   */
  moLienHe: boolean
}

export function donGon(d: StudentApplicationItem): DonGon {
  return raSoat('donUngTuyen', {
    id: d.id,
    jobId: d.jobId,
    tenTin: d.jobTitle,
    congTy: d.companyName,
    trangThai: d.status,
    matchScore: d.matchScore,
    ngayNop: d.createdAt.slice(0, 10),
    moLienHe: TRANG_THAI_MO_LIEN_HE.includes(d.status),
  })
}

/* ---------------------------------------------------- lịch rảnh và kỹ năng -- */

export interface OLichRanhGon {
  dayOfWeek: number
  slot: string
}

/** Không có PII, nhưng vẫn đi qua `raSoat` — cổng ra phải là một, không phải hai. */
export function oLichRanhGon(o: AvailabilitySlot): OLichRanhGon {
  return raSoat('oLichRanh', { dayOfWeek: o.dayOfWeek, slot: o.slot })
}

export interface KyNangGon {
  name: string
  slug: string
}

export function kyNangGon(k: SkillResponse): KyNangGon {
  return raSoat('kyNang', { name: k.name, slug: k.slug })
}

export { chuoiCa }
