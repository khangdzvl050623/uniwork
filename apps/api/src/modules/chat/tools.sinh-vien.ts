import { tool } from '@uniwork/ai-runtime'
import {
  APPLICATION_STATUSES,
  PUBLIC_JOB_SORTS,
  SALARY_UNITS,
  SCHEDULE_TYPES,
  type PublicJobQuery,
} from '@uniwork/shared'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { getPublicJob, listPublicJobs, listSavedJobs } from '../jobs/jobs.service.js'
import { getAvailability, getStudentProfile } from '../profile/profile.service.js'
import { listStudentApplications } from '../applications/applications.service.js'
import { listSkills } from '../skills/skills.service.js'
import { donGon, hoSoGon, kyNangGon, oLichRanhGon, tinChiTietGon, tinGon } from './gon-lai.js'
import { catDanhSach, LoLotPII } from './luoc-pii.js'
import { CHU_DE_HUONG_DAN, HUONG_DAN } from './noi-dung/huong-dan.js'

/**
 * Bộ tool cho vai SINH VIÊN.
 *
 * ===========================================================================
 * LUẬT SỐ MỘT: MODEL KHÔNG BAO GIỜ NÓI MÌNH LÀ AI
 * ===========================================================================
 * `ctx.userId` nằm trong closure. Không một `inputSchema` nào dưới đây có
 * trường `userId`, `studentProfileId`, hay bất cứ thứ gì chỉ ra chủ sở hữu dữ
 * liệu.
 *
 * Khác biệt quan trọng: đây KHÔNG phải "model bị chặn khi xin dữ liệu người
 * khác". Là model KHÔNG DIỄN ĐẠT ĐƯỢC yêu cầu đó. Không có trường nào để điền,
 * nên không có gì để kiểm, nên không có chỗ nào để quên kiểm. Prompt injection
 * giỏi tới đâu cũng chỉ sinh ra được một lời gọi tool hợp lệ — mà lời gọi tool
 * hợp lệ thì luôn chạy dưới danh nghĩa người đang đăng nhập.
 *
 * ===========================================================================
 * LUẬT SỐ HAI: TOOL GỌI SERVICE, KHÔNG GỌI PRISMA
 * ===========================================================================
 * `getPublicJob` chỉ trả tin đang OPEN. `getStudentProfile` chỉ đọc hồ sơ của
 * chính `userId`. Tầng kiểm quyền đó đã có sẵn và đã được test. Gọi thẳng
 * Prisma là dựng lại nó lần thứ hai, ở một chỗ không ai nhớ ra để test.
 *
 * ===========================================================================
 * LUẬT SỐ BA: KHÔNG TOOL NÀO GHI
 * ===========================================================================
 * Cả chín tool ở đây đều chỉ đọc. Đó là lý do prompt injection thành công nhất
 * cũng chỉ khiến model NÓI sai một câu — nó không đổi được đơn, không gửi được
 * tin, không sửa được hồ sơ, vì không tồn tại đường nào để làm những việc đó.
 * Xem thêm `deNghiChuyenNhaTuyenDung` ở cuối file.
 */
export interface CtxSinhVien {
  /** Lấy từ `req.user`. KHÔNG BAO GIỜ từ đầu vào của model. */
  userId: string
  /**
   * Tin người dùng đang mở trên màn hình, nếu web gửi kèm.
   *
   * Chỉ dùng để hiểu "việc này lương bao nhiêu" mà không phải hỏi lại. Web gửi
   * sai id thì người dùng tự thấy AI nói về tin khác — không phải lỗ quyền, vì
   * `getPublicJob` vẫn chỉ trả tin công khai.
   */
  jobIdDangXem?: string
}

/** Trần số phần tử trả cho model. Xem `catDanhSach` về việc phải nói rõ còn bao nhiêu. */
const TRAN_TIN = 5
const TRAN_DON = 10
const TRAN_TIN_DA_LUU = 10
const TRAN_KY_NANG = 20

type KetQua<T extends object> = ({ ok: true } & T) | { ok: false; lyDo: string }

/**
 * Lớp bọc chung cho mọi `execute`.
 *
 * Một tra cứu hỏng KHÔNG được giết cả lượt hỏi. Ném ra ngoài thì `streamText`
 * dừng và người dùng nhận một màn hình trống; trả `{ ok: false, lyDo }` thì
 * model đọc được lý do và nói lại bằng tiếng Việt, hoặc thử hướng khác.
 *
 * `AppError.message` vốn đã là câu viết cho người dùng đọc (xem `lib/errors.ts`)
 * nên chuyển thẳng được. Lỗi ngoài ý muốn thì KHÔNG: nội dung của nó có thể là
 * câu SQL hoặc chuỗi kết nối, và mọi thứ vào ngữ cảnh model là thứ có người đọc
 * được.
 */
async function chay<T extends object>(ten: string, fn: () => Promise<T>): Promise<KetQua<T>> {
  try {
    return { ok: true, ...(await fn()) }
  } catch (e) {
    if (e instanceof LoLotPII) throw e
    if (e instanceof AppError) return { ok: false, lyDo: e.message }
    console.error(`[tro-ly] tool ${ten} lỗi ngoài ý muốn`, e)
    return { ok: false, lyDo: 'Mình chưa tra được thông tin này, bạn thử lại sau nhé' }
  }
}

export function dungToolSinhVien(ctx: CtxSinhVien) {
  return {
    timViecLam: tool({
      description:
        'Tìm tin tuyển dụng đang mở trên UniWork. Dùng khi người dùng hỏi có việc gì, ' +
        'tìm việc theo khu vực, theo lịch rảnh, theo mức lương, hay theo kỹ năng.',
      inputSchema: z.object({
        q: z.string().max(100).optional().describe('Từ khoá tự do, ví dụ "pha chế"'),
        city: z.string().max(50).optional().describe('Tỉnh/thành, ví dụ "Hà Nội"'),
        district: z.string().max(50).optional().describe('Quận/huyện, ví dụ "Cầu Giấy"'),
        kieuLich: z.enum(SCHEDULE_TYPES).optional(),
        luongToiThieu: z.number().int().min(0).optional(),
        donViLuong: z.enum(SALARY_UNITS).optional().describe('Mặc định HOUR nếu bỏ trống'),
        kyNang: z
          .array(z.string().max(50))
          .max(5)
          .optional()
          .describe('Tên hoặc slug kỹ năng. Gọi danhMucKyNang trước nếu không chắc.'),
        hopLichRanh: z
          .boolean()
          .optional()
          .describe('true = chỉ lấy tin người dùng nhận đủ số ca tối thiểu'),
        sort: z.enum(PUBLIC_JOB_SORTS).optional(),
      }),
      execute: async (v) =>
        chay('timViecLam', async () => {
          /*
           * Model chỉ biết TÊN kỹ năng, `PublicJobQuery` lại đòi `skillIds`.
           * Đổi ở đây chứ không bắt model gọi `danhMucKyNang` trước rồi tự nhớ
           * id: bớt một vòng tool, và model hết đường bịa ra một id.
           */
          let skillIds: string[] | undefined
          let kyNangKhongCo: string[] = []
          if (v.kyNang !== undefined && v.kyNang.length > 0) {
            const danhMuc = await listSkills()
            const tim = (s: string) => {
              const thuong = s.toLocaleLowerCase('vi-VN')
              return danhMuc.find(
                (k) => k.slug === thuong || k.name.toLocaleLowerCase('vi-VN') === thuong,
              )
            }
            skillIds = v.kyNang.flatMap((s) => {
              const k = tim(s)
              return k === undefined ? [] : [k.id]
            })
            kyNangKhongCo = v.kyNang.filter((s) => tim(s) === undefined)
          }

          const truyVan: PublicJobQuery = {
            q: v.q,
            city: v.city,
            district: v.district,
            scheduleType: v.kieuLich,
            salaryFrom: v.luongToiThieu,
            // Đơn vị là bắt buộc khi lọc theo lương. Mặc định giờ — đơn vị hay
            // gặp nhất ở tin part-time — thay vì trả lỗi cho model đoán lại.
            salaryUnit: v.luongToiThieu === undefined ? undefined : (v.donViLuong ?? 'HOUR'),
            skillIds,
            matchAvailability: v.hopLichRanh,
            sort: v.sort,
            page: 1,
            limit: TRAN_TIN,
          }

          const kq = await listPublicJobs(truyVan, ctx.userId)
          return {
            tin: kq.jobs.map(tinGon),
            tong: kq.total,
            conNua: kq.total > kq.jobs.length,
            ...(kyNangKhongCo.length > 0 ? { kyNangKhongCo } : {}),
          }
        }),
    }),

    xemChiTietViec: tool({
      description:
        'Xem đầy đủ một tin tuyển dụng: mô tả, yêu cầu, phúc lợi, ca làm, kỹ năng. ' +
        'Bỏ trống jobId nếu người dùng đang nói về tin họ vừa mở.',
      inputSchema: z.object({
        jobId: z.string().max(40).optional(),
      }),
      execute: async ({ jobId }) =>
        chay('xemChiTietViec', async () => {
          const id = jobId ?? ctx.jobIdDangXem
          if (id === undefined) {
            throw new AppError(
              'VALIDATION_ERROR',
              'Chưa rõ bạn đang hỏi về tin nào. Hỏi lại tên tin, hoặc bảo người dùng mở tin ra.',
              400,
            )
          }
          return { tin: tinChiTietGon(await getPublicJob(id, ctx.userId)) }
        }),
    }),

    xemLichRanhCuaToi: tool({
      description:
        'Xem lịch rảnh người dùng đã khai (lưới 7 ngày × 3 khung sáng/chiều/tối). ' +
        'Mảng rỗng nghĩa là CHƯA KHAI, không phải "không rảnh lúc nào".',
      inputSchema: z.object({}),
      execute: async () =>
        chay('xemLichRanhCuaToi', async () => {
          const o = await getAvailability(ctx.userId)
          return { o: o.map(oLichRanhGon), daKhai: o.length > 0 }
        }),
    }),

    xemHoSoCuaToi: tool({
      description:
        'Xem hồ sơ người dùng: trường, ngành, năm học, kỹ năng, mức lương mong muốn, ' +
        'đã tải CV hay chưa. Không có tên, số điện thoại hay email.',
      inputSchema: z.object({}),
      execute: async () =>
        chay('xemHoSoCuaToi', async () => ({
          hoSo: hoSoGon(await getStudentProfile(ctx.userId)),
        })),
    }),

    xemDonUngTuyenCuaToi: tool({
      description: 'Xem các đơn ứng tuyển người dùng đã nộp và trạng thái từng đơn.',
      inputSchema: z.object({
        trangThai: z.enum(APPLICATION_STATUSES).optional().describe('Bỏ trống để lấy tất cả'),
      }),
      execute: async ({ trangThai }) =>
        chay('xemDonUngTuyenCuaToi', async () => {
          const kq = await listStudentApplications(ctx.userId)
          const loc =
            trangThai === undefined
              ? kq.applications
              : kq.applications.filter((d) => d.status === trangThai)
          const { danhSach, conNua, tong } = catDanhSach(loc, TRAN_DON)
          return { don: danhSach.map(donGon), tong, conNua }
        }),
    }),

    xemTinDaLuu: tool({
      description:
        'Xem danh sách tin người dùng đã bấm lưu. `conNhanHoSo` cho biết tin còn nộp được không.',
      inputSchema: z.object({}),
      execute: async () =>
        chay('xemTinDaLuu', async () => {
          const kq = await listSavedJobs(ctx.userId)
          const { danhSach, conNua, tong } = catDanhSach(kq.savedJobs, TRAN_TIN_DA_LUU)
          return {
            tin: danhSach.map((m) => ({ ...tinGon(m.job), conNhanHoSo: m.stillOpen })),
            tong,
            conNua,
          }
        }),
    }),

    danhMucKyNang: tool({
      description:
        'Liệt kê các kỹ năng có trong danh mục UniWork. Dùng khi cần biết tên kỹ năng ' +
        'chính xác trước khi lọc tin.',
      inputSchema: z.object({
        tuKhoa: z.string().max(50).optional().describe('Lọc theo tên, ví dụ "bán"'),
      }),
      execute: async ({ tuKhoa }) =>
        chay('danhMucKyNang', async () => {
          const tat = await listSkills()
          const loc =
            tuKhoa === undefined
              ? tat
              : tat.filter((k) =>
                  k.name.toLocaleLowerCase('vi-VN').includes(tuKhoa.toLocaleLowerCase('vi-VN')),
                )
          const { danhSach, conNua, tong } = catDanhSach(loc, TRAN_KY_NANG)
          return { kyNang: danhSach.map(kyNangGon), tong, conNua }
        }),
    }),

    huongDanSuDung: tool({
      description:
        'Lấy hướng dẫn thao tác trên UniWork. Dùng cho MỌI câu hỏi "làm sao để…", ' +
        '"ở đâu…", "bấm vào đâu…". Đừng tự mô tả giao diện — bạn không biết nó.',
      inputSchema: z.object({
        chuDe: z.enum(CHU_DE_HUONG_DAN),
      }),
      // Không chạm database nên không cần `chay` — không có gì hỏng được.
      execute: async ({ chuDe }) => ({ ok: true as const, huongDan: HUONG_DAN[chuDe] }),
    }),

    /*
     * -----------------------------------------------------------------------
     * TOOL KHÔNG LÀM GÌ CẢ — VÀ ĐÓ LÀ TOÀN BỘ THIẾT KẾ CỦA NÓ
     * -----------------------------------------------------------------------
     * Yêu cầu: AI được phép ĐỀ NGHỊ chuyển sang nhà tuyển dụng, nhưng không tự
     * gửi tin trước khi người dùng chọn.
     *
     * Cách bảo đảm điều đó KHÔNG phải dặn model kỹ hơn. Là không tồn tại đường
     * nào để model gửi: trong cả bộ tool này không có tool nào ghi vào
     * `chat_messages`. Tin nhắn tới nhà tuyển dụng chỉ sinh ra từ một endpoint
     * HTTP mà chỉ trình duyệt gọi được — và model không gọi HTTP.
     *
     * Việc duy nhất tool này làm là kiểm tin có thật và đang mở, rồi mô tả một
     * cái nút. Bước kiểm đó cắt đúng ca model bịa `jobId`.
     */
    deNghiChuyenNhaTuyenDung: tool({
      description:
        'Gọi khi câu hỏi cần CHÍNH nhà tuyển dụng quyết định hoặc xác nhận: thương lượng ' +
        'lương, xin đổi ca, xin về sớm, hỏi chi tiết không có trong tin. Tool này CHỈ tạo ' +
        'một lời đề nghị hiện lên màn hình. Nó KHÔNG gửi tin nhắn nào cho nhà tuyển dụng. ' +
        'Người dùng phải tự bấm nút thì mới có tin được gửi đi.',
      inputSchema: z.object({
        jobId: z
          .string()
          .max(40)
          .optional()
          .describe('Tin đang bàn tới. Chưa rõ thì hỏi lại, đừng đoán.'),
        lyDo: z.string().max(200).describe('Một câu ngắn vì sao cần hỏi nhà tuyển dụng'),
      }),
      execute: async ({ jobId, lyDo }) =>
        chay('deNghiChuyenNhaTuyenDung', async () => {
          const id = jobId ?? ctx.jobIdDangXem
          if (id === undefined) {
            throw new AppError(
              'VALIDATION_ERROR',
              'Chưa rõ đang hỏi về tin nào. Hỏi lại người dùng trước khi đề nghị chuyển.',
              400,
            )
          }
          const tin = await getPublicJob(id, ctx.userId).catch(() => null)
          if (tin === null) {
            return { deNghi: null, lyDoTuChoi: 'Không tìm thấy tin này hoặc tin đã đóng' }
          }
          return {
            deNghi: { jobId: tin.id, tenTin: tin.title, congTy: tin.employer.companyName, lyDo },
          }
        }),
    }),
  }
}

export type ToolSinhVien = ReturnType<typeof dungToolSinhVien>
