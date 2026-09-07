import { publicJobQueryShape } from '@uniwork/shared'
import type { BoLoc } from '@/components/FilterSidebar'

/** Các tham số lọc web đọc từ URL. `page`/`limit`/`city` do nơi khác quyết định. */
const TRUONG_LOC = [
  'district',
  'scheduleType',
  'salaryUnit',
  'salaryFrom',
  'includeNegotiable',
  'matchAvailability',
  'skillIds',
  'maxShiftsPerWeek',
  'maxCommitmentMonths',
] as const

type TruongLoc = (typeof TRUONG_LOC)[number]

/**
 * Đọc bộ lọc từ thanh địa chỉ.
 *
 * ---------------------------------------------------------------------------
 * DÙNG CHUNG LUẬT VỚI API, KHÔNG VIẾT BẢN THỨ HAI
 * ---------------------------------------------------------------------------
 * Mỗi trường được kiểm bằng ĐÚNG schema mà API dùng (`publicJobQueryShape` ở
 * `@uniwork/shared`). Bản đầu của hàm này tự viết luật kiểm — và lệch ngay:
 *
 * | URL                        | Bản tự viết   | Schema API           |
 * | -------------------------- | ------------- | -------------------- |
 * | `?maxShiftsPerWeek=`       | gửi `0`       | phải là số DƯƠNG → 422 |
 * | `?maxCommitmentMonths=61`  | gửi `61`      | trần 60 → 422        |
 *
 * Cả hai đều là 422 cho người vừa bấm vào một link ai đó gửi. Chép luật là có
 * hai bộ luật; chúng lệch nhau ngay lần đầu một bên được sửa.
 *
 * Khác biệt duy nhất là CÁCH XỬ LÝ khi sai: API từ chối cả request vì người gọi
 * sai hợp đồng, còn ở đây thì bỏ riêng trường hỏng và giữ phần còn lại — người
 * dùng chỉ đang muốn xem việc làm, không muốn xem một màn hình lỗi.
 */
export function docBoLoc(p: URLSearchParams): BoLoc {
  const boLoc: Record<string, unknown> = {}

  for (const truong of TRUONG_LOC) {
    const tho = p.get(truong)
    if (tho === null) continue

    // `safeParse` chứ không `parse`: giá trị lạ phải bị bỏ qua chứ không ném lỗi
    // làm trắng cả trang.
    const kq = publicJobQueryShape[truong as TruongLoc].safeParse(tho)
    if (kq.success && kq.data !== undefined) boLoc[truong] = kq.data
  }

  /*
   * Luật cuối, chép từ `superRefine` của `publicJobQuerySchema`: mức lương
   * không có nghĩa nếu thiếu đơn vị.
   *
   * Đây là luật giữa HAI trường nên không nằm trong schema của từng trường được.
   * API chặn bằng cách trả 422; ở đây bỏ con số và giữ nguyên phần còn lại —
   * cùng cách `FilterSidebar` xoá `salaryFrom` mỗi lần đổi đơn vị.
   */
  if (boLoc.salaryFrom !== undefined && boLoc.salaryUnit === undefined) {
    delete boLoc.salaryFrom
  }

  return boLoc as BoLoc
}
