import { describe, expect, it } from 'vitest'
import { SO_O_MOI_TUAN, publicJobQuerySchema } from '@uniwork/shared'
import { chuoiTruyVan } from '@/hooks/usePublicJobs'
import { docBoLoc } from './bo-loc-url'

/**
 * Đọc bộ lọc từ URL.
 *
 * Đây là ranh giới KHÔNG TIN ĐƯỢC duy nhất còn lại ở phía web: mọi thứ khác đi
 * qua form và component, còn cái này người dùng gõ thẳng vào thanh địa chỉ —
 * hoặc nhận từ một link ai đó chép tay sai.
 *
 * Và mọi lỗi ở đây đều KHÔNG có biểu hiện: bộ lọc đọc sai vẫn ra một danh sách
 * trông bình thường, chỉ là sai. Nên test bám vào chỗ giá trị được QUYẾT ĐỊNH
 * chứ không bám vào màn hình.
 */

const p = (qs: string) => new URLSearchParams(qs)

describe('docBoLoc — đọc bộ lọc từ thanh địa chỉ', () => {
  it('URL rỗng ra bộ lọc rỗng, không ra giá trị mặc định nào', () => {
    // Mỗi khoá thừa ở đây là một điều kiện thừa gửi xuống API, và là một biến
    // thể cache key mới trong TanStack Query cho cùng một câu hỏi.
    expect(docBoLoc(p(''))).toEqual({})
  })

  it('đọc đủ các bộ lọc thường dùng', () => {
    const boLoc = docBoLoc(p('district=Quận 1&scheduleType=RECURRING&maxShiftsPerWeek=3'))

    expect(boLoc.district).toBe('Quận 1')
    expect(boLoc.scheduleType).toBe('RECURRING')
    expect(boLoc.maxShiftsPerWeek).toBe(3)
  })

  it('⚠ giá trị enum lạ bị BỎ QUA, không đi thẳng xuống API', () => {
    // Không lọc thì `?scheduleType=xyz` xuống tới Zod của server và trả 422 —
    // một màn hình lỗi cho người chỉ vừa bấm vào link bạn gửi.
    const boLoc = docBoLoc(p('scheduleType=xyz&salaryUnit=BITCOIN'))

    expect(boLoc.scheduleType).toBeUndefined()
    expect(boLoc.salaryUnit).toBeUndefined()
  })

  it('⚠ tham số rỗng KHÔNG được biến thành số 0', () => {
    // Lỗi đã gặp thật: bản đầu tự viết luật kiểm, `Number('')` ra `0`, `0` lọt
    // qua phép kiểm "số nguyên không âm", rồi `?maxShiftsPerWeek=0` xuống API —
    // mà schema đòi số DƯƠNG nên trả 422.
    expect(docBoLoc(p('maxShiftsPerWeek=')).maxShiftsPerWeek).toBeUndefined()
    expect(docBoLoc(p('maxCommitmentMonths=')).maxCommitmentMonths).toBeUndefined()
    expect(docBoLoc(p('maxShiftsPerWeek=0')).maxShiftsPerWeek).toBeUndefined()
  })

  it('⚠ giá trị vượt TRẦN bị bỏ, đúng trần mà API dùng', () => {
    // Lỗi đã gặp thật: bản đầu không có trần nên `?maxCommitmentMonths=61` đi
    // thẳng xuống API rồi 422. Trần lấy từ schema dùng chung, không chép tay.
    expect(docBoLoc(p('maxCommitmentMonths=61')).maxCommitmentMonths).toBeUndefined()
    expect(docBoLoc(p('maxCommitmentMonths=60')).maxCommitmentMonths).toBe(60)
    expect(docBoLoc(p(`maxShiftsPerWeek=${SO_O_MOI_TUAN + 1}`)).maxShiftsPerWeek).toBeUndefined()
    expect(docBoLoc(p(`maxShiftsPerWeek=${SO_O_MOI_TUAN}`)).maxShiftsPerWeek).toBe(SO_O_MOI_TUAN)
  })

  it('số âm và số thập phân bị bỏ', () => {
    expect(docBoLoc(p('maxShiftsPerWeek=-1')).maxShiftsPerWeek).toBeUndefined()
    expect(docBoLoc(p('maxShiftsPerWeek=3.5')).maxShiftsPerWeek).toBeUndefined()
    expect(docBoLoc(p('maxShiftsPerWeek=nhieu')).maxShiftsPerWeek).toBeUndefined()
  })

  it('⚠ mức lương KHÔNG có đơn vị thì bỏ luôn con số', () => {
    // "từ 25.000" không nói được gì nếu không biết mỗi giờ hay mỗi tháng. API
    // chặn bằng `superRefine`; ở đây bỏ con số và giữ phần còn lại.
    expect(docBoLoc(p('salaryFrom=25000')).salaryFrom).toBeUndefined()
  })

  it('có đơn vị thì mới nhận mức lương', () => {
    const boLoc = docBoLoc(p('salaryUnit=HOUR&salaryFrom=25000'))

    expect(boLoc.salaryUnit).toBe('HOUR')
    expect(boLoc.salaryFrom).toBe(25000)
  })

  it('skillIds tách theo dấu phẩy, bỏ phần rỗng', () => {
    expect(docBoLoc(p('skillIds=sk-1,sk-2')).skillIds).toEqual(['sk-1', 'sk-2'])
    expect(docBoLoc(p('skillIds=sk-1,,')).skillIds).toEqual(['sk-1'])
  })

  it('skillIds rỗng ra undefined, KHÔNG ra mảng rỗng', () => {
    // Mảng rỗng lọt vào `chuoiTruyVan` sẽ thành `?skillIds=` — một tham số rỗng
    // trong URL chia sẻ, và một cache key khác cho cùng một bộ lọc.
    expect(docBoLoc(p('skillIds=')).skillIds).toBeUndefined()
    expect(docBoLoc(p('skillIds=,,,')).skillIds).toBeUndefined()
  })

  it('includeNegotiable và matchAvailability đọc theo đúng luật của schema', () => {
    expect(docBoLoc(p('includeNegotiable=false')).includeNegotiable).toBe(false)
    expect(docBoLoc(p('matchAvailability=true')).matchAvailability).toBe(true)
    expect(docBoLoc(p('matchAvailability=')).matchAvailability).toBeUndefined()
  })

  /**
   * Ca canh gác thật sự của cả file.
   *
   * Mọi ca trên đều có thể xanh trong khi web và API vẫn hiểu URL khác nhau —
   * chúng chỉ kiểm từng luật rời. Ca này kiểm thứ duy nhất quan trọng: **thứ
   * `docBoLoc` cho qua thì API PHẢI nhận**.
   *
   * Nó đỏ ngay nếu ai đó nới lỏng `docBoLoc`, hoặc siết `publicJobQuerySchema`
   * mà quên phía web — đúng hai cách hai bộ luật lệch nhau.
   */
  it('⚠ mọi thứ docBoLoc cho qua đều được API chấp nhận', () => {
    const urlNguoiDungCoTheGo = [
      '',
      'maxShiftsPerWeek=&maxCommitmentMonths=',
      'maxCommitmentMonths=61&maxShiftsPerWeek=999',
      'maxShiftsPerWeek=0&salaryFrom=0',
      'scheduleType=xyz&salaryUnit=BITCOIN&district=Quận 1',
      'salaryFrom=25000',
      'salaryUnit=HOUR&salaryFrom=999999999999',
      'skillIds=,,,&matchAvailability=abc',
      'district=Quận 1&scheduleType=RECURRING&salaryUnit=MONTH&salaryFrom=5000000' +
        '&includeNegotiable=false&skillIds=sk-1,sk-2&maxShiftsPerWeek=3' +
        '&maxCommitmentMonths=6&matchAvailability=true',
    ]

    for (const qs of urlNguoiDungCoTheGo) {
      // Đi ĐÚNG đường thật: đọc URL → dựng query string bằng cùng hàm web gửi
      // đi → parse như API parse. So object đã parse với schema là so nhầm
      // hình dạng: `skillIds` ở đầu này là mảng, còn API nhận chuỗi "a,b".
      const boLoc = docBoLoc(p(qs))
      const guiDi = chuoiTruyVan(boLoc).replace(/^\?/, '')
      const kq = publicJobQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(guiDi)))

      expect(kq.success, `API từ chối "?${guiDi}" (đọc từ "?${qs}")`).toBe(true)
    }
  })
})
