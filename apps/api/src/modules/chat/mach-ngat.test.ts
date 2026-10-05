import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  APICallError,
  RetryError,
  _datLaiMach,
  ghiLoi,
  ghiThanhCong,
  laLoiNhaCungCap,
  machChoPhep,
} from '@uniwork/ai-runtime'

/**
 * Mạch ngắt nhà cung cấp — máy trạng thái, với đồng hồ GIẢ.
 *
 * Đồng hồ giả là bắt buộc: thời gian chờ là 60 giây, và một test chờ thật 60
 * giây là test không ai chạy. Hàm thật nhận đồng hồ qua `_datLaiMach`.
 *
 * Các ca được chọn theo những cách mạch ngắt hay hỏng mà không có lỗi nào bắn
 * ra: tính nhầm lỗi của chính ta, không bao giờ đóng lại, và kẹt ở nửa mở.
 */

let bayGio = 1_000_000
const troiQua = (ms: number) => {
  bayGio += ms
}

/** Một lỗi đúng như nhà cung cấp trả về — `laLoiNhaCungCap` nhận ra nó qua marker riêng. */
const loi429 = (retryAfter?: string) =>
  new APICallError({
    message: 'Resource has been exhausted',
    url: 'https://generativelanguage.googleapis.com',
    requestBodyValues: {},
    statusCode: 429,
    responseHeaders: retryAfter ? { 'retry-after': retryAfter } : {},
    isRetryable: true,
  })

const hongLan = (n: number, e: unknown = loi429()) => {
  for (let i = 0; i < n; i += 1) ghiLoi(e, false)
}

beforeEach(() => {
  bayGio = 1_000_000
  _datLaiMach(() => bayGio)
})

afterEach(() => _datLaiMach())

describe('mở mạch', () => {
  it('dưới ngưỡng thì vẫn cho gọi; tới lỗi thứ ba thì chặn', () => {
    hongLan(2)
    expect(machChoPhep().duoc).toBe(true)

    hongLan(1)
    expect(machChoPhep().duoc).toBe(false)
  })

  /*
   * Lỗi phải LIÊN TIẾP. Hai lỗi, một lần thành công, hai lỗi nữa là bốn lỗi
   * rải rác — chuyện thường của mạng, không phải nhà cung cấp đang sập.
   */
  it('một lần thành công xoá bộ đếm', () => {
    hongLan(2)
    ghiThanhCong()
    hongLan(2)
    expect(machChoPhep().duoc).toBe(true)
  })

  it('đang mở thì báo còn bao lâu', () => {
    hongLan(3)
    troiQua(15_000)
    const kq = machChoPhep()
    expect(kq.duoc).toBe(false)
    if (!kq.duoc) expect(kq.thuLaiSauMs).toBe(45_000)
  })
})

/*
 * ===========================================================================
 * KHÔNG TÍNH NHẦM — CHỖ DỄ SAI NHẤT
 * ===========================================================================
 * Mọi lỗi trong một lượt đi qua cùng một `catch`, kể cả lỗi database sau khi
 * model đã trả lời xong. Tính nhầm thì một bug của ta hiện ra cho mọi người
 * thành "trợ lý đang quá tải" trong khi Gemini hoàn toàn bình thường.
 */
describe('chỉ tính lỗi của nhà cung cấp', () => {
  it('lỗi thường của code không được tính, dù bao nhiêu lần', () => {
    hongLan(10, new Error('Không ghi được tin nhắn'))
    expect(machChoPhep().duoc).toBe(true)
  })

  it('người dùng tự huỷ (đóng tab) không được tính', () => {
    for (let i = 0; i < 10; i += 1) ghiLoi(loi429(), true)
    expect(machChoPhep().duoc).toBe(true)
  })

  it('nhà cung cấp treo tới hết giờ thì CÓ tính', () => {
    const hetGio = Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    expect(laLoiNhaCungCap(hetGio)).toBe(true)
  })

  /* AI SDK có thể bọc lỗi gốc trong `RetryError` — phải bóc ra mới nhận đúng. */
  it('nhận ra lỗi nhà cung cấp bị bọc trong RetryError', () => {
    const boc = new RetryError({ message: 'x', reason: 'maxRetriesExceeded', errors: [loi429()] })
    expect(laLoiNhaCungCap(boc)).toBe(true)
  })
})

/*
 * ===========================================================================
 * NỬA MỞ — HẾT CHỜ THÌ PHẢI CHO THỬ, VÀ PHẢI ĐÓNG ĐƯỢC
 * ===========================================================================
 * Hai cách hỏng: mạch mở mãi không bao giờ cho thử lại, hoặc cho thử lại mà
 * một lần thành công không đóng được nó — khi đó mạch nhạy tới mức một lỗi lẻ
 * cũng ngắt.
 */
describe('nửa mở', () => {
  it('hết thời gian chờ thì cho gọi thử', () => {
    hongLan(3)
    troiQua(60_001)
    expect(machChoPhep().duoc).toBe(true)
  })

  it('đang nửa mở mà hỏng thì MỞ LẠI ngay, chỉ cần một lỗi', () => {
    hongLan(3)
    troiQua(60_001)
    hongLan(1)
    expect(machChoPhep().duoc).toBe(false)
  })

  it('đang nửa mở mà thành công thì ĐÓNG hẳn — phải đủ ba lỗi mới mở lại', () => {
    hongLan(3)
    troiQua(60_001)
    ghiThanhCong()

    hongLan(2)
    expect(machChoPhep().duoc).toBe(true)
  })
})

describe('retry-after của nhà cung cấp', () => {
  it('429 đòi chờ 120 giây thì chờ 120 giây, không phải 60', () => {
    hongLan(3, loi429('120'))
    troiQua(90_000)
    expect(machChoPhep().duoc).toBe(false)
    troiQua(31_000)
    expect(machChoPhep().duoc).toBe(true)
  })

  it('đòi chờ ngắn hơn mặc định thì vẫn chờ mặc định', () => {
    hongLan(3, loi429('5'))
    troiQua(30_000)
    expect(machChoPhep().duoc).toBe(false)
  })

  /* Một header lạ không được khoá trợ lý cả ngày. */
  it('đòi chờ quá lâu thì bị chặn ở trần 10 phút', () => {
    hongLan(3, loi429('86400'))
    troiQua(10 * 60_000 + 1)
    expect(machChoPhep().duoc).toBe(true)
  })
})
