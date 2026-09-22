import { afterEach, describe, expect, it, vi } from 'vitest'
import { phongChu, phongNTD } from './chat.access.js'
import { dangKyBoPhat, phatToiPhong } from './phat-su-kien.js'
import { phatTinMoi } from './chat.service.js'

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }))

const TIN = {
  id: 'm-1',
  seq: 7,
  senderType: 'STUDENT' as const,
  body: 'em xin về sớm 30 phút được không ạ',
  createdAt: '2026-09-21T03:00:00.000Z',
}

function batPhat() {
  const daPhat: { phong: string; ten: string; du: unknown }[] = []
  dangKyBoPhat({ toiPhong: (phong, ten, du) => daPhat.push({ phong, ten, du }) })
  return daPhat
}

afterEach(() => dangKyBoPhat(null))

/*
 * ===========================================================================
 * HAI PHÒNG, KHÔNG PHẢI MỘT — VÀ ĐÂY LÀ CHỖ CANH NÓ
 * ===========================================================================
 * Một phòng chung nghĩa là mọi `emit` tới cả hai bên. Khi phiên quay về
 * AI_ACTIVE, NTD đang ngồi trong phòng sẽ nhận realtime TỪNG CÂU sinh viên nói
 * với trợ lý — dù truy vấn REST chặn họ đọc đúng những tin ấy.
 *
 * Không test REST nào bắt được lỗ đó, vì REST hoàn toàn đúng. Nên nó phải được
 * canh ở đây.
 */
describe('luật phát tin', () => {
  /*
   * Khẳng định bằng CHUỖI THẬT, không bằng `phongChu()`/`phongNTD()`.
   *
   * Dùng chính hàm đang kiểm để dựng giá trị mong đợi là viết một câu luôn
   * đúng: đổi `phongNTD` thành trả về đúng chuỗi của `phongChu` thì hai vế cùng
   * đổi và test vẫn xanh — trong khi NTD vừa được đưa vào phòng của chủ phiên
   * và bắt đầu nhận mọi tin riêng tư.
   */
  it('tin riêng tư chỉ vào phòng của chủ phiên', () => {
    const daPhat = batPhat()
    phatTinMoi('p-1', TIN, false)

    expect(daPhat).toHaveLength(1)
    expect(daPhat[0]!.phong).toBe('hoi-thoai:p-1:chu')
  })

  it('tin đã chia sẻ vào cả hai phòng, và hai phòng đó KHÁC NHAU', () => {
    const daPhat = batPhat()
    phatTinMoi('p-1', TIN, true)

    expect(daPhat.map((d) => d.phong)).toEqual(['hoi-thoai:p-1:chu', 'hoi-thoai:p-1:ntd'])
  })

  it('tên phòng khớp đúng hằng số hai phía cùng dùng', () => {
    expect(phongChu('p-1')).toBe('hoi-thoai:p-1:chu')
    expect(phongNTD('p-1')).toBe('hoi-thoai:p-1:ntd')
  })

  it('tên phòng của hai phiên khác nhau không trùng', () => {
    expect(phongChu('p-1')).not.toBe(phongChu('p-2'))
  })
})

/*
 * ===========================================================================
 * REALTIME HỎNG KHÔNG ĐƯỢC LÀM HỎNG NGHIỆP VỤ
 * ===========================================================================
 * Tin nhắn đã commit là tin nhắn đã tồn tại. Một `emit` thất bại chỉ có nghĩa
 * người kia phải tải bù — mà tải bù đã có cursor lo. Để lỗi từ tầng phát ngược
 * lên service là biến một sự cố vô hại thành 500, và người gửi sẽ gửi lại một
 * tin đã nằm trong database.
 */
describe('khe cắm bộ phát', () => {
  it('chưa ai đăng ký thì không làm gì, không ném', () => {
    expect(() => phatTinMoi('p-1', TIN, true)).not.toThrow()
  })

  it('bộ phát ném thì service KHÔNG ném theo', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    dangKyBoPhat({
      toiPhong: () => {
        throw new Error('io đã đóng')
      },
    })
    expect(() => phatTinMoi('p-1', TIN, true)).not.toThrow()
  })

  it('gỡ bộ phát rồi thì im lặng trở lại', () => {
    const daPhat = batPhat()
    dangKyBoPhat(null)
    phatToiPhong('bat-ky', 'su-kien', {})
    expect(daPhat).toHaveLength(0)
  })
})
