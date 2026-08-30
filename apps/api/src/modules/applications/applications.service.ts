import { Prisma } from '@prisma/client'
import {
  CHUYEN_TRANG_THAI_HOP_LE,
  PHIEN_BAN_CHAM_DIEM,
  TRANG_THAI_MO_LIEN_HE,
  chamDiemPhuHop,
} from '@uniwork/shared'
import type {
  ApplicantItem,
  ApplicantListResponse,
  ApplicantQuery,
  ApplicationEventItem,
  ApplicationStatus,
  CreateApplicationInput,
  CreateApplicationResponse,
  DayOfWeek,
  MatchBreakdown,
  UpdateApplicationStatusInput,
  UpdateApplicationStatusResponse,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'

/**
 * Nghiệp vụ đơn ứng tuyển.
 *
 * Module riêng chứ không nhét vào `modules/jobs/` — khác với `SavedJob` ở Sprint
 * 3 (nhét chung vì nó trả về `PublicJobSummary`, cùng bảng `Job`). `Application`
 * có bảng riêng, luồng trạng thái riêng, bảng lịch sử riêng, và ba tính năng
 * cùng dùng. Để chung `jobs.service.ts` thì file đó vượt 56KB lên gần gấp rưỡi.
 *
 * Phân biệt quyền nằm ở tầng route, không phải ở đây — cùng nếp với jobs.
 */

/* ==================================================================== */
/* Dùng chung                                                            */
/* ==================================================================== */

/**
 * Ghi một mốc vào lịch sử đơn.
 *
 * LUÔN nhận `tx` chứ không dùng `prisma` toàn cục, và chữ ký hàm bắt buộc điều
 * đó: mốc lịch sử phải ghi trong CÙNG transaction với việc đổi `status`. Cho
 * phép gọi ngoài transaction là mở đường cho khoảnh khắc trạng thái đã đổi mà
 * lịch sử chưa ghi — timeline khuyết một bước, và không ai giải thích được vì
 * sao.
 */
async function ghiSuKien(
  tx: Prisma.TransactionClient,
  input: {
    applicationId: string
    status: ApplicationStatus
    actorUserId: string | null
    note?: string | null
  },
): Promise<ApplicationEventItem> {
  const event = await tx.applicationEvent.create({
    data: {
      applicationId: input.applicationId,
      status: input.status,
      actorUserId: input.actorUserId,
      note: input.note ?? null,
    },
    select: { status: true, note: true, createdAt: true },
  })
  return { status: event.status, note: event.note, createdAt: event.createdAt.toISOString() }
}

/**
 * `matchBreakdown` đi ra khỏi Prisma dưới dạng `Prisma.JsonValue`, không phải
 * kiểu của ta. Ép ở đúng một chỗ này thay vì rải `as` khắp nơi.
 *
 * Đơn có từ trước Sprint 4 chưa có cột này nên `null` là ca thật, không phải lỗi.
 */
function docBreakdown(v: Prisma.JsonValue | null): MatchBreakdown | null {
  return (v as unknown as MatchBreakdown | null) ?? null
}

/* ==================================================================== */
/* Tính năng 1 — sinh viên nộp đơn                                       */
/* ==================================================================== */

/**
 * Hồ sơ sinh viên kèm đúng những thứ cần để chấm điểm.
 *
 * Lấy một lượt thay vì ba câu truy vấn riêng: lịch rảnh, kỹ năng và
 * `availableUntil` đều chỉ dùng cho một phép tính duy nhất.
 */
async function layHoSoDeChamDiem(userId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      cvUrl: true,
      availableUntil: true,
      availabilities: { select: { dayOfWeek: true, slot: true } },
      skills: { select: { skillId: true } },
      user: { select: { emailVerifiedAt: true } },
    },
  })
  if (!profile) throw notFound('Không tìm thấy hồ sơ sinh viên')
  return profile
}

/** Cột của tin cần cho việc chấm điểm và kiểm điều kiện nộp. */
const CHON_TIN_DE_NOP = {
  id: true,
  title: true,
  status: true,
  deadline: true,
  startDate: true,
  minShiftsPerWeek: true,
  commitmentMonths: true,
  shifts: { select: { dayOfWeek: true, slot: true } },
  skills: { select: { skillId: true } },
  employerProfile: { select: { userId: true } },
} satisfies Prisma.JobSelect

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
): Promise<CreateApplicationResponse> {
  const hoSo = await layHoSoDeChamDiem(userId)

  /*
   * Chưa xác thực email thì không ứng tuyển được — BRD: "Đăng nhập được nhưng
   * chặn ứng tuyển và đăng tin". Đây là lần đầu luật này được áp; trước Sprint 4
   * chưa endpoint nào kiểm `emailVerifiedAt`.
   *
   * Câu trả lời phải CHỈ ĐƯỜNG, không phải một câu 403 trống: người dùng đang
   * đứng trước một nút vừa từ chối họ và cần biết đi đâu tiếp.
   */
  if (!hoSo.user.emailVerifiedAt) {
    throw forbidden('Bạn cần xác thực email trước khi ứng tuyển. Vào Hồ sơ để nhận mã xác thực.')
  }

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: CHON_TIN_DE_NOP,
  })
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng')

  /*
   * 409 chứ không 404: tin CÓ tồn tại, chỉ là không nhận hồ sơ nữa. Trả 404 sẽ
   * nói dối — sinh viên đang mở đúng trang đó và thấy nó bằng mắt.
   *
   * Không nói rõ tin đang ở DRAFT hay PENDING hay CLOSED: ba đường đó là quy
   * trình nội bộ của nhà tuyển dụng, cùng lý do `SavedJobItem.stillOpen` chỉ là
   * một bit chứ không phải cả `status`.
   */
  if (job.status !== 'OPEN') throw conflict('Tin này đã ngừng nhận hồ sơ')

  /*
   * Quá hạn nộp. Tin vẫn `OPEN` vì không có tiến trình nào tự đóng nó — hạn nộp
   * là mốc do NTD tự đặt và chỉ có ý nghĩa lúc ai đó định nộp.
   *
   * So với đầu ngày hôm sau chứ không so thẳng: `deadline` lưu lúc 00:00, so
   * thẳng sẽ khoá tin ngay từ 00:01 CHÍNH NGÀY hết hạn — trong khi người ta hiểu
   * "hạn 20/09" là "hết ngày 20/09".
   */
  if (job.deadline && Date.now() > ngayKeTiep(job.deadline).getTime()) {
    throw conflict('Tin này đã quá hạn nhận hồ sơ')
  }

  const bayGio = new Date()
  const breakdown = chamDiemPhuHop({
    caLam: job.shifts.map((c) => ({ dayOfWeek: c.dayOfWeek as DayOfWeek, slot: c.slot })),
    minShiftsPerWeek: job.minShiftsPerWeek,
    kyNangTin: job.skills.map((s) => s.skillId),
    commitmentMonths: job.commitmentMonths,
    // Mốc tính cam kết là lúc công việc BẮT ĐẦU, không phải lúc nộp đơn. Tin
    // thời vụ Tết bắt đầu tháng 12 thì "còn làm được mấy tháng" phải đếm từ
    // tháng 12, không đếm từ hôm nay.
    mocBatDau: job.startDate ?? bayGio,

    lichRanh: hoSo.availabilities.map((o) => ({
      dayOfWeek: o.dayOfWeek as DayOfWeek,
      slot: o.slot,
    })),
    kyNangSinhVien: hoSo.skills.map((s) => s.skillId),
    availableUntil: hoSo.availableUntil,
  })

  /*
   * Cố ý KHÔNG chặn khi `eligible === false`.
   *
   * Lịch rảnh là bản khai có thể đã cũ — sinh viên vừa đổi thời khoá biểu mà
   * chưa cập nhật là chuyện thường. Chặn cứng là để hệ thống từ chối thay nhà
   * tuyển dụng, trong khi NTD mới là người biết mình linh động tới đâu. Giao
   * diện cảnh báo trước khi bấm gửi; quyết định vẫn là của hai con người.
   *
   * Hệ quả: "có đơn" KHÔNG hàm ý "đủ điều kiện". Đó là lý do `eligible` phải
   * đóng băng trong `matchBreakdown`, không suy ra được từ sự tồn tại của đơn.
   */

  try {
    const don = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          jobId: job.id,
          studentProfileId: hoSo.id,
          coverLetter: input.coverLetter ?? null,
          // Bỏ trống thì lấy CV đang có trong hồ sơ. Chép giá trị chứ không trỏ
          // sang: sinh viên thay CV tháng sau thì đơn này vẫn giữ đúng file NTD
          // đã đọc.
          cvUrl: input.cvUrl ?? hoSo.cvUrl,
          matchScore: breakdown.finalScore,
          matchBreakdown: breakdown as unknown as Prisma.InputJsonValue,
          matchAlgoVersion: PHIEN_BAN_CHAM_DIEM,
        },
        select: CHON_DON,
      })

      // Mốc đầu tiên của timeline. Cùng transaction — xem `ghiSuKien`.
      await ghiSuKien(tx, {
        applicationId: created.id,
        status: 'PENDING',
        actorUserId: userId,
      })

      return created
    })

    return { ...toApplicationBase(don), jobId: job.id, jobTitle: job.title }
  } catch (e) {
    /*
     * `@@unique([jobId, studentProfileId])` là lớp chặn THẬT. Kiểm trước bằng
     * `findFirst` cũng được, nhưng hai request bấm cùng lúc thì cả hai đều qua
     * bước kiểm — chỉ ràng buộc database chặn được. Bắt lỗi ở đây để đổi nó
     * thành một câu tiếng Việt.
     */
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw conflict('Bạn đã nộp đơn cho tin này rồi')
    }
    throw e
  }
}

/** Đầu ngày hôm sau của một mốc — dùng để so "hết ngày X". */
function ngayKeTiep(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() + 1)
  return r
}

/* ==================================================================== */
/* Tính năng 2 — nhà tuyển dụng xem ứng viên                             */
/* ==================================================================== */

/** Cột chung của một đơn, dùng cho cả hai phía. */
const CHON_DON = {
  id: true,
  status: true,
  coverLetter: true,
  cvUrl: true,
  matchScore: true,
  matchBreakdown: true,
  matchAlgoVersion: true,
  createdAt: true,
  statusChangedAt: true,
} satisfies Prisma.ApplicationSelect

type HangDon = Prisma.ApplicationGetPayload<{ select: typeof CHON_DON }>

function toApplicationBase(don: HangDon) {
  return {
    id: don.id,
    status: don.status,
    coverLetter: don.coverLetter,
    cvUrl: don.cvUrl,
    matchScore: don.matchScore,
    matchBreakdown: docBreakdown(don.matchBreakdown),
    matchAlgoVersion: don.matchAlgoVersion,
    createdAt: don.createdAt.toISOString(),
    statusChangedAt: don.statusChangedAt?.toISOString() ?? null,
  }
}

/**
 * Hồ sơ ứng viên KHÔNG kèm liên hệ. Dùng cho đơn chưa tới `SHORTLISTED`.
 */
const CHON_UNG_VIEN_KIN = {
  id: true,
  fullName: true,
  university: true,
  major: true,
  year: true,
  skills: { select: { skill: { select: { name: true } } } },
} satisfies Prisma.StudentProfileSelect

/** Như trên, MỞ thêm số điện thoại và email. */
const CHON_UNG_VIEN_MO = {
  ...CHON_UNG_VIEN_KIN,
  phone: true,
  user: { select: { email: true } },
} satisfies Prisma.StudentProfileSelect

/**
 * Tin phải thuộc về nhà tuyển dụng đang đăng nhập.
 *
 * Ba kết quả cho ba tình huống khác nhau, KHÔNG gộp:
 *   - tin không tồn tại      → 404
 *   - tin của NTD khác       → 403
 *   - tin của mình           → trả về
 *
 * Có lập luận rằng nên trả 404 cho cả hai ca đầu để không lộ "tin này có tồn
 * tại". Ở đây id tin là cuid công khai trên URL của trang việc làm, ai cũng
 * xem được — nên 403 không lộ thêm gì, mà lại nói đúng chuyện đang xảy ra.
 */
async function layTinCuaNtd(userId: string, jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, title: true, employerProfile: { select: { userId: true } } },
  })
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng')
  if (job.employerProfile.userId !== userId) throw forbidden('Tin này không thuộc về bạn')
  return job
}

export async function listApplicants(
  userId: string,
  jobId: string,
  query: ApplicantQuery,
): Promise<ApplicantListResponse> {
  const job = await layTinCuaNtd(userId, jobId)

  const loc: Prisma.ApplicationWhereInput = {
    jobId,
    ...(query.status ? { status: query.status } : {}),
  }

  /*
   * ---------------------------------------------------------------------
   * VÌ SAO HAI CÂU TRUY VẤN CHỨ KHÔNG PHẢI MỘT
   * ---------------------------------------------------------------------
   * Luật che liên hệ phụ thuộc TRẠNG THÁI CỦA TỪNG ĐƠN, mà mệnh đề `select`
   * của Prisma là một hình dạng cố định cho cả câu truy vấn — không có cách
   * nào nói "hàng nào SHORTLISTED thì kèm phone".
   *
   * Còn đúng hai đường:
   *
   *   a) Lấy hết rồi xoá `phone`/`email` trong JS trước khi trả về.
   *   b) Hai câu truy vấn, mỗi câu một `select`, rồi ghép lại.
   *
   * Chọn (b). Phương án (a) cho ra cùng một response HÔM NAY, nhưng số điện
   * thoại đã nằm trong tiến trình Node và chỉ còn một dòng code ngăn nó rò ra
   * — thêm một trường vào response, hoặc một `console.log` lúc gỡ lỗi, hoặc
   * một `res.json(rows)` viết tắt của người sau. Với (b), dữ liệu KHÔNG BAO
   * GIỜ rời khỏi database, nên không có dòng nào để quên.
   *
   * Bọc `$transaction` để hai câu đọc cùng một ảnh chụp: không có nó thì một
   * đơn đổi trạng thái giữa hai lượt sẽ lọt vào cả hai kết quả, hoặc không
   * vào kết quả nào.
   */
  const [donKin, donMo, dem] = await prisma.$transaction([
    prisma.application.findMany({
      where: { ...loc, status: { notIn: TRANG_THAI_MO_LIEN_HE } },
      select: { ...CHON_DON, studentProfile: { select: CHON_UNG_VIEN_KIN } },
    }),
    prisma.application.findMany({
      where: { ...loc, status: { in: TRANG_THAI_MO_LIEN_HE } },
      select: { ...CHON_DON, studentProfile: { select: CHON_UNG_VIEN_MO } },
    }),
    /*
     * Đếm cho tab: lấy MỌI đơn của tin, không áp `loc` — số trên tab phải đứng
     * yên khi người dùng bấm sang tab khác, nếu không thì bấm vào "Đã xem" xong
     * mọi tab kia tụt về 0.
     *
     * Lấy cột `status` rồi đếm trong JS chứ không dùng `groupBy`: số đơn của
     * MỘT tin là tập nhỏ có chặn trên (`quantity` vài người, đơn vài chục), nên
     * chênh lệch không đo được — đổi lại kiểu trả về gọn và không phải chiều
     * cách `_count` của Prisma lỏng kiểu bên trong `$transaction`.
     */
    prisma.application.findMany({ where: { jobId }, select: { status: true } }),
  ])

  const applicants = [...donKin, ...donMo].map(toApplicantItem)
  sapXep(applicants, query.sort ?? 'match')

  return {
    jobId: job.id,
    jobTitle: job.title,
    applicants,
    total: applicants.length,
    demTheoTrangThai: demTheoTrangThai(dem),
  }
}

type HangUngVien = HangDon & {
  studentProfile: Prisma.StudentProfileGetPayload<{ select: typeof CHON_UNG_VIEN_KIN }> & {
    phone?: string | null
    user?: { email: string }
  }
}

function toApplicantItem(don: HangUngVien): ApplicantItem {
  const sv = don.studentProfile

  return {
    ...toApplicationBase(don),
    studentProfileId: sv.id,
    fullName: sv.fullName,
    university: sv.university,
    major: sv.major,
    year: sv.year,
    skills: sv.skills.map((s) => s.skill.name),
    // `user` chỉ có mặt ở nhánh MỞ. Không cần kiểm lại trạng thái ở đây — hình
    // dạng dữ liệu ĐÃ nói lên quyền, đó chính là điều phương án hai-truy-vấn mua được.
    contact: sv.user ? { phone: sv.phone ?? null, email: sv.user.email } : null,
    // Bỏ `WITHDRAWN`: rút đơn là quyền của sinh viên, NTD không đặt được.
    buocTiepTheo: CHUYEN_TRANG_THAI_HOP_LE[don.status].filter((s) => s !== 'WITHDRAWN'),
  }
}

/**
 * Xếp `eligible` trước, rồi mới tới điểm — cùng nếp `hang()` của `listPublicJobs`.
 *
 * Vì sao không xếp thuần theo điểm: điểm giữa các sinh viên KHÔNG so sánh được
 * khi độ phủ khác nhau. Người khai đúng một tiêu chí và khớp hoàn hảo tiêu chí
 * đó được 100, cao hơn người khai đủ ba thứ. Cho `eligible` đi trước ít nhất
 * đảm bảo người làm được việc đứng trên người không làm được.
 *
 * Độ phủ KHÔNG tham gia xếp hạng, chỉ hiển thị — nhân điểm với `doDuoc/apDung`
 * là dựng thêm một chiều chấm điểm chưa có dữ liệu nào đỡ, và nó tự loại ứng
 * viên thay nhà tuyển dụng.
 */
function sapXep(ds: ApplicantItem[], sort: 'match' | 'newest'): void {
  if (sort === 'newest') {
    ds.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return
  }

  const hang = (e: boolean | null | undefined) => (e === true ? 2 : e === false ? 1 : 0)
  ds.sort(
    (a, b) =>
      hang(b.matchBreakdown?.eligible) - hang(a.matchBreakdown?.eligible) ||
      (b.matchScore ?? -1) - (a.matchScore ?? -1) ||
      // Cùng điểm thì ai nộp trước đứng trước — có thứ tự ổn định, không để
      // danh sách đảo lung tung mỗi lần tải lại.
      a.createdAt.localeCompare(b.createdAt),
  )
}

/** Đếm đủ 6 trạng thái, kể cả trạng thái không có đơn nào — để tab hiện số 0. */
function demTheoTrangThai(rows: { status: ApplicationStatus }[]): Record<ApplicationStatus, number> {
  const dem = {
    PENDING: 0,
    VIEWED: 0,
    SHORTLISTED: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  } satisfies Record<ApplicationStatus, number>

  for (const r of rows) dem[r.status] += 1
  return dem
}

/* ==================================================================== */
/* Tính năng 3 — đổi trạng thái                                          */
/* ==================================================================== */

export async function updateApplicationStatus(
  userId: string,
  jobId: string,
  applicationId: string,
  input: UpdateApplicationStatusInput,
): Promise<UpdateApplicationStatusResponse> {
  await layTinCuaNtd(userId, jobId)

  const hienTai = await prisma.application.findFirst({
    // Lọc kèm `jobId` chứ không chỉ `id`: không có nó thì NTD đổi được đơn của
    // tin người khác chỉ bằng cách đoán một applicationId và ghép vào jobId của
    // mình. Ownership phải kiểm ở CẢ hai mắt xích.
    where: { id: applicationId, jobId },
    select: { id: true, status: true },
  })
  if (!hienTai) throw notFound('Không tìm thấy đơn ứng tuyển trong tin này')

  /*
   * Rút đơn là quyền của sinh viên. Chặn ở đây chứ không để lọt vào bảng chuyển
   * trạng thái: bảng đó trả lời "đi từ đâu tới đâu được", còn đây là "ai được đi".
   */
  if (input.status === 'WITHDRAWN') {
    throw forbidden('Chỉ sinh viên mới rút được đơn của họ')
  }

  const duocPhep = CHUYEN_TRANG_THAI_HOP_LE[hienTai.status]
  if (!duocPhep.includes(input.status)) {
    throw conflict(
      duocPhep.length === 0
        ? `Đơn đã ở trạng thái cuối (${hienTai.status}), không đổi được nữa`
        : `Không chuyển được từ ${hienTai.status} sang ${input.status}`,
    )
  }

  const { don, event } = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.application.update({
      where: { id: applicationId },
      data: { status: input.status, statusChangedAt: new Date() },
      select: {
        ...CHON_DON,
        studentProfile: {
          // Mở liên hệ theo trạng thái MỚI, không theo trạng thái cũ: NTD vừa
          // bấm "mời phỏng vấn" thì response ngay sau đó phải kèm liên hệ,
          // nếu không họ phải tải lại trang mới thấy.
          select: TRANG_THAI_MO_LIEN_HE.includes(input.status)
            ? CHON_UNG_VIEN_MO
            : CHON_UNG_VIEN_KIN,
        },
      },
    })

    const ev = await ghiSuKien(tx, {
      applicationId,
      status: input.status,
      actorUserId: userId,
      note: input.note,
    })

    return { don: capNhat, event: ev }
  })

  return { applicant: toApplicantItem(don), event }
}
