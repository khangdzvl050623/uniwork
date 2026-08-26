import { describe, expect, it } from 'vitest'
import { duongDanTin, taoSlug } from '@uniwork/shared'

/**
 * Test cho slug và đường dẫn tin.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CÓ HẲN MỘT NHÓM TEST CHO "ID CÓ DẤU GẠCH"
 * ---------------------------------------------------------------------------
 * Bản đầu của `duongDanTin` nối `${slug}-${id}` rồi lấy id lại bằng cách cắt
 * theo dấu gạch cuối. Toàn bộ test khi đó xanh — vì mọi ca test đều dùng một
 * `cuid()`, mà cuid thì không có dấu gạch.
 *
 * Chạy thử trên database thật mới lộ ra: `prisma/seed.ts` đặt id viết tay
 * (`demo-job-cafe-toi`) cho dữ liệu mẫu, và phép cắt trả về `toi`. 7 trên 9 tin
 * thật dẫn tới trang 404.
 *
 * Nên nhóm test dưới cùng KHÔNG phải để phòng xa: nó chốt lại đúng hình dạng dữ
 * liệu đã từng làm hỏng tính năng này.
 */

/** Hai hình dạng id thật sự tồn tại trong bảng `jobs`. */
const ID_CUID = 'cmt8g8rro000iuex0vzzm14fi'
const ID_SEED = 'demo-job-cafe-toi'

describe('taoSlug', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(taoSlug('Phục vụ quán cà phê')).toBe('phuc-vu-quan-ca-phe')
  })

  it('xử lý được chữ đ và Đ — thứ NFD không tách', () => {
    // Bỏ sót chỗ này thì "Đầu bếp" ra `-u-bp`.
    expect(taoSlug('Đầu bếp')).toBe('dau-bep')
    expect(taoSlug('đóng gói')).toBe('dong-goi')
  })

  it('gộp dấu câu và khoảng trắng thành một gạch', () => {
    expect(taoSlug('  Pha chế!!!  cơ bản  ')).toBe('pha-che-co-ban')
  })

  it('tiêu đề toàn ký tự lạ thì ra chuỗi rỗng', () => {
    expect(taoSlug('!!!')).toBe('')
    expect(taoSlug('')).toBe('')
  })
})

describe('duongDanTin', () => {
  it('slug và id là HAI đoạn, ngăn bằng dấu gạch chéo', () => {
    expect(duongDanTin({ id: ID_CUID, title: 'Phục vụ quán cà phê' })).toBe(
      `phuc-vu-quan-ca-phe/${ID_CUID}`,
    )
  })

  it('tiêu đề không sinh được slug thì trả id trần, KHÔNG có gạch chéo thừa', () => {
    // `/demo-job-cafe-toi` sẽ thành đường dẫn tuyệt đối, khớp nhầm route khác.
    expect(duongDanTin({ id: ID_CUID, title: '!!!' })).toBe(ID_CUID)
    expect(duongDanTin({ id: ID_SEED, title: '' })).toBe(ID_SEED)
  })
})

describe('id giữ NGUYÊN VẸN ở đoạn cuối — kể cả id chứa dấu gạch', () => {
  /**
   * Lấy đoạn cuối đúng như React Router đưa vào `params.id`.
   *
   * Route khai `/viec-lam/:slug/:id`, nên đoạn cuối là toàn bộ `:id`. Ở đây mô
   * phỏng lại bằng cách cắt theo dấu gạch CHÉO — phép cắt duy nhất còn lại, và
   * là phép cắt an toàn vì `taoSlug` không bao giờ sinh ra dấu gạch chéo.
   */
  const doanCuoi = (duongDan: string) => duongDan.split('/').pop()

  const CA_TEST: { title: string; id: string }[] = [
    { title: 'Phục vụ quán cà phê ca tối', id: ID_SEED },
    { title: 'Gia sư Toán lớp 9', id: 'demo-job-gia-su-toan' },
    { title: 'Nhân viên bán hàng thời vụ Tết', id: 'demo-job-ban-hang-tet' },
    { title: 'Bán quần áo localbrand', id: ID_CUID },
    { title: 'Nhân viên bán hàng Tết 2026', id: ID_CUID },
    { title: 'Shipper - giao hàng nội thành', id: ID_SEED },
    { title: 'A', id: ID_SEED },
    { title: '2026', id: 'demo-job-su-kien-am-nhac' },
  ]

  it.each(CA_TEST)('"$title" → id $id', ({ title, id }) => {
    expect(doanCuoi(duongDanTin({ id, title }))).toBe(id)
  })

  it('id trần (link cũ trước khi có slug) vẫn là chính nó', () => {
    expect(doanCuoi(ID_SEED)).toBe(ID_SEED)
    expect(doanCuoi(ID_CUID)).toBe(ID_CUID)
  })
})
