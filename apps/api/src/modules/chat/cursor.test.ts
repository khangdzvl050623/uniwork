import { describe, expect, it } from 'vitest'
import { dongCursor, moCursor } from './cursor.js'

describe('đóng/mở', () => {
  it('mở ra đúng số đã đóng vào', () => {
    expect(moCursor(dongCursor(42))).toBe(42)
  })

  it('0 là hợp lệ — nghĩa là chưa xét gì', () => {
    expect(moCursor(dongCursor(0))).toBe(0)
  })

  /*
   * Đục, không phải số trần. Hai lý do, và lý do thứ hai mới là lý do thật:
   *
   *   1. Một con số tăng đều là kênh rò rỉ — NTD đếm được sinh viên đã nói riêng
   *      bao nhiêu câu với trợ lý.
   *   2. Đục thì client KHÔNG VIẾT NỔI logic dò lỗ hổng trên nó, mà dò lỗ hổng
   *      chính là thứ sai với vai NTD.
   */
  it('không lộ con số ra ngoài chuỗi', () => {
    expect(dongCursor(137)).not.toContain('137')
  })

  it('không phải số nguyên đọc được bằng Number()', () => {
    expect(Number.isNaN(Number(dongCursor(7)))).toBe(true)
  })

  it('an toàn cho URL — dùng base64url, không có + / =', () => {
    expect(dongCursor(999999)).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

/*
 * ===========================================================================
 * MỌI ĐẦU VÀO HỎNG ĐỀU VỀ 0, KHÔNG NÉM
 * ===========================================================================
 * Ném ở đây là biến một cursor cũ nằm trong localStorage thành một màn hình lỗi
 * mà người dùng không tự thoát được. Về 0 thì tốn thêm một truy vấn tải từ đầu
 * rồi mọi thứ chạy tiếp.
 *
 * Không mở cửa gì: quyền đọc do `quyenTruyCapPhien` chặn, nên cursor bịa cũng
 * không xem thêm được tin nào.
 */
describe('đầu vào hỏng', () => {
  const hong = [
    ['thiếu hẳn', undefined],
    ['null', null],
    ['chuỗi rỗng', ''],
    ['không phải base64', '!!!không phải base64!!!'],
    ['base64 của rác', Buffer.from('không phải json').toString('base64url')],
    ['json nhưng không phải object', Buffer.from('123').toString('base64url')],
    ['thiếu seq', Buffer.from(JSON.stringify({ v: 1 })).toString('base64url')],
    ['seq âm', Buffer.from(JSON.stringify({ seq: -5, v: 1 })).toString('base64url')],
    ['seq không nguyên', Buffer.from(JSON.stringify({ seq: 1.5, v: 1 })).toString('base64url')],
    ['seq là chuỗi', Buffer.from(JSON.stringify({ seq: '9', v: 1 })).toString('base64url')],
  ] as const

  for (const [ten, gt] of hong) {
    it(`${ten} → 0`, () => {
      expect(moCursor(gt)).toBe(0)
    })
  }

  /*
   * `v` là đường thoát cho tương lai: đổi cách mã hoá (thêm messageId cho ổn
   * định, đổi luật lọc) mà không phải phát hành lại client. Cursor đời cũ về 0
   * và tải lại từ đầu — chậm một lần, đúng mọi lần.
   */
  it('đời khác thì về 0, không cố diễn giải', () => {
    expect(moCursor(Buffer.from(JSON.stringify({ seq: 99, v: 2 })).toString('base64url'))).toBe(0)
  })
})
