import { afterEach, describe, expect, it, vi } from 'vitest'
import { phongAdmin, phongChu, phongNTD } from './chat.access.js'
import { dangKyBoPhat, phatToiPhong } from './phat-su-kien.js'
import { phatTinMoi, phatTrangThai } from './chat.service.js'

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
  /*
   * =======================================================================
   * PHÁT VÀO CẢ BA PHÒNG — TÍNH RIÊNG TƯ DO `quyenTruyCapPhien` GIỮ
   * =======================================================================
   * Không còn cờ `choNTD`. Một luồng chỉ có một đối tượng, nên mọi tin trong
   * luồng đều thuộc về đúng những người vào được luồng ấy.
   *
   * Điều đó CHỈ đúng nhờ một bất biến ở nơi khác: đường duy nhất vào phòng
   * `:ntd` / `:admin` là `quyenTruyCapPhien`, và nó chỉ mở chúng cho đúng
   * `kind`. Bất biến ấy có test riêng canh ở làn database — ca ở đây chỉ
   * khẳng định phần phát.
   */
  it('phát tới cả ba phòng của luồng, và ba phòng đó KHÁC NHAU', () => {
    const daPhat = batPhat()
    phatTinMoi('p-1', TIN)

    expect(daPhat.map((d) => d.phong).sort()).toEqual(
      ['hoi-thoai:p-1:admin', 'hoi-thoai:p-1:chu', 'hoi-thoai:p-1:ntd'].sort(),
    )
  })

  it('ba phòng của cùng một phiên khác nhau từng đôi một', () => {
    const ba = [phongChu('p-1'), phongNTD('p-1'), phongAdmin('p-1')]
    expect(new Set(ba).size).toBe(3)
  })

  /*
   * =======================================================================
   * CA NÀY CHẶN "BÊN KIA KHÔNG BIẾT HỘI THOẠI VỪA ĐÓNG"
   * =======================================================================
   * Bản trước chỉ phát đổi trạng thái vào phòng RIÊNG của chủ phiên. Nhà
   * tuyển dụng hay admin đang ngồi trong chính hội thoại đó không nhận được
   * gì: ô nhập vẫn mở, và họ chỉ biết khi gõ xong rồi nhận lỗi từ server.
   */
  it('đổi trạng thái tới cả ba phòng hội thoại VÀ phòng riêng của chủ phiên', () => {
    const daPhat = batPhat()
    phatTrangThai('p-1', 'CLOSED', 'u-9')

    expect(daPhat.map((d) => d.phong).sort()).toEqual(
      ['hoi-thoai:p-1:admin', 'hoi-thoai:p-1:chu', 'hoi-thoai:p-1:ntd', 'user:u-9'].sort(),
    )
    expect(daPhat.every((d) => d.ten === 'hoi-thoai:trang-thai')).toBe(true)
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
    expect(() => phatTinMoi('p-1', TIN)).not.toThrow()
  })

  it('bộ phát ném thì service KHÔNG ném theo', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    dangKyBoPhat({
      toiPhong: () => {
        throw new Error('io đã đóng')
      },
    })
    expect(() => phatTinMoi('p-1', TIN)).not.toThrow()
  })

  it('gỡ bộ phát rồi thì im lặng trở lại', () => {
    const daPhat = batPhat()
    dangKyBoPhat(null)
    phatToiPhong('bat-ky', 'su-kien', {})
    expect(daPhat).toHaveLength(0)
  })
})
