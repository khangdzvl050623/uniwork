import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Response } from 'express'
import { KenhSSE } from './sse.js'

/** `Response` giả chỉ đủ cho những gì KenhSSE dùng tới. */
function resGia() {
  const daGhi: string[] = []
  const nghe: Record<string, () => void> = {}
  const res = {
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((s: string) => {
      daGhi.push(s)
      return true
    }),
    end: vi.fn(),
    on: vi.fn((ten: string, fn: () => void) => {
      nghe[ten] = fn
    }),
  }
  return { res: res as unknown as Response, daGhi, nghe, spy: res }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('header', () => {
  it('tắt cache, tắt biến đổi, và tắt đệm của nginx', () => {
    const { res, spy } = resGia()
    new KenhSSE(res).moKenh()
    const h = spy.writeHead.mock.calls[0]![1] as Record<string, string>
    expect(h['Content-Type']).toContain('text/event-stream')
    expect(h['Cache-Control']).toContain('no-transform')
    expect(h['X-Accel-Buffering']).toBe('no')
  })

  it('đẩy header đi ngay, không đợi body', () => {
    const { res, spy } = resGia()
    new KenhSSE(res).moKenh()
    expect(spy.flushHeaders).toHaveBeenCalled()
  })
})

describe('khung sự kiện', () => {
  it('đúng dạng event/data kết bằng hai dòng trống', () => {
    const { res, daGhi } = resGia()
    const k = new KenhSSE(res)
    k.moKenh()
    k.phat('chu', 'xin chào')
    expect(daGhi.at(-1)).toBe('event: chu\ndata: "xin chào"\n\n')
  })

  /*
   * ---------------------------------------------------------------------
   * CA QUAN TRỌNG NHẤT FILE NÀY
   * ---------------------------------------------------------------------
   * Khung SSE ngăn cách hai sự kiện bằng hai dấu xuống dòng. Model rất hay trả
   * lời có xuống dòng — liệt kê ba tin mỗi tin một dòng chẳng hạn. Ghi thẳng
   * chuỗi đó ra là cắt sự kiện làm đôi: client đọc được nửa đầu, nửa sau thành
   * một sự kiện rác không tên.
   *
   * `JSON.stringify` biến `\n` thành hai ký tự `\` và `n`, hết đường cắt nhầm.
   */
  it('chữ có xuống dòng KHÔNG cắt sự kiện làm đôi', () => {
    const { res, daGhi } = resGia()
    const k = new KenhSSE(res)
    k.moKenh()
    k.phat('chu', 'dòng một\n\ndòng hai')

    const khung = daGhi.at(-1)!
    expect(khung.split('\n\n').filter((x) => x !== '')).toHaveLength(1)
    expect(khung).toContain('\\n\\n')
  })

  it('không ghi gì nữa sau khi đóng', () => {
    const { res, daGhi } = resGia()
    const k = new KenhSSE(res)
    k.moKenh()
    k.dongKenh()
    k.phat('chu', 'muộn rồi')
    expect(daGhi.some((d) => d.includes('muộn rồi'))).toBe(false)
  })
})

describe('nhịp tim', () => {
  /*
   * Model có thể im lặng vài giây trước chữ đầu tiên khi nó đang gọi tool. Proxy
   * cắt kết nối im lặng, và người dùng thấy lỗi mạng cho một lượt hoàn toàn bình
   * thường.
   */
  it('gửi chú thích giữ kết nối khi kênh im lặng', () => {
    const { res, daGhi } = resGia()
    new KenhSSE(res).moKenh()
    vi.advanceTimersByTime(31_000)
    expect(daGhi.filter((d) => d === ': nhip\n\n')).toHaveLength(2)
  })

  it('dừng nhịp tim khi đóng kênh — không để timer sống sau response', () => {
    const { res, daGhi } = resGia()
    const k = new KenhSSE(res)
    k.moKenh()
    k.dongKenh()
    vi.advanceTimersByTime(60_000)
    expect(daGhi.filter((d) => d === ': nhip\n\n')).toHaveLength(0)
  })

  it('dừng nhịp tim khi người dùng rời đi', () => {
    const { res, daGhi, nghe } = resGia()
    const k = new KenhSSE(res)
    k.moKenh()
    k.khiNguoiDungRoiDi(() => {})
    nghe.close!()
    vi.advanceTimersByTime(60_000)
    expect(daGhi.filter((d) => d === ': nhip\n\n')).toHaveLength(0)
  })

  it('báo cho nơi gọi khi người dùng đóng tab', () => {
    const { res, nghe } = resGia()
    const huy = vi.fn()
    const k = new KenhSSE(res)
    k.moKenh()
    k.khiNguoiDungRoiDi(huy)
    nghe.close!()
    expect(huy).toHaveBeenCalledOnce()
  })
})
