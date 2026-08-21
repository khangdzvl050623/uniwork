import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OtpInput } from './OtpInput'

/**
 * Test cho ô nhập mã xác thực (T47).
 *
 * Sáu ô riêng đòi phải tự lo những thứ mà một ô dài được trình duyệt cho không:
 * dán, xoá lùi, di chuyển giữa các ô. Mỗi thứ chỉ vài dòng code nên rất dễ bị
 * sửa hỏng lúc dọn dẹp về sau — và hỏng thì không ai phát hiện cho tới khi có
 * người thật ngồi nhập mã.
 */

/** Bọc trong một component có state thật, vì OtpInput là component được điều khiển. */
function Bao({ onComplete }: { onComplete?: (v: string) => void }) {
  const [value, setValue] = useState('')
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
}

const layOO = () => screen.getAllByRole('textbox') as HTMLInputElement[]

describe('OtpInput', () => {
  it('dựng đúng 6 ô', () => {
    render(<Bao />)
    expect(layOO()).toHaveLength(6)
  })

  it('gõ từng số thì tự nhảy sang ô kế tiếp', async () => {
    const user = userEvent.setup()
    render(<Bao />)
    const o = layOO()

    await user.click(o[0])
    await user.keyboard('123')

    expect(o[0].value).toBe('1')
    expect(o[1].value).toBe('2')
    expect(o[2].value).toBe('3')
    // Con trỏ phải đang ở ô thứ tư, sẵn sàng cho chữ số tiếp theo.
    expect(document.activeElement).toBe(o[3])
  })

  it('DÁN mã 6 số điền đủ cả sáu ô', async () => {
    /*
     * Đây là cách dùng phổ biến nhất: copy mã từ email rồi dán. Không xử lý
     * riêng sự kiện paste thì cả 6 chữ số chui hết vào ô đầu tiên.
     */
    const user = userEvent.setup()
    render(<Bao />)
    const o = layOO()

    await user.click(o[0])
    await user.paste('483920')

    expect(o.map((x) => x.value).join('')).toBe('483920')
  })

  it('dán chuỗi có ký tự thừa thì lọc lấy phần số', async () => {
    const user = userEvent.setup()
    render(<Bao />)

    await user.click(layOO()[0])
    // Người dùng hay quét dư khoảng trắng hoặc dấu gạch khi bôi đen trong email.
    await user.paste(' 48-39 20 ')

    expect(layOO().map((x) => x.value).join('')).toBe('483920')
  })

  it('Backspace ở ô rỗng thì lùi về ô trước VÀ xoá chữ ở đó', async () => {
    // Gộp hai thao tác làm một. Thiếu thì người dùng phải bấm Backspace hai
    // lần cho mỗi chữ số muốn xoá.
    const user = userEvent.setup()
    render(<Bao />)
    const o = layOO()

    await user.click(o[0])
    await user.keyboard('12')
    // Sau khi gõ '12', con trỏ ở ô thứ 3 (rỗng).
    await user.keyboard('{Backspace}')

    expect(o[1].value).toBe('')
    expect(o[0].value).toBe('1')
    expect(document.activeElement).toBe(o[1])
  })

  it('Backspace ở ô đang có chữ thì chỉ xoá tại chỗ', async () => {
    const user = userEvent.setup()
    render(<Bao />)
    const o = layOO()

    await user.click(o[0])
    await user.keyboard('12')
    await user.click(o[0])
    await user.keyboard('{Backspace}')

    expect(o[0].value).toBe('')
    expect(o[1].value).toBe('2')
  })

  it('xoá một ô GIỮA thì các số phía sau ĐỨNG YÊN, không dồn lên', async () => {
    /*
     * Ca này từng hỏng thật: xoá ô số 1 của "123456" cho ra "23456", tức là mọi
     * chữ số dồn sang trái một ô. Người dùng thấy ô vừa bấm xoá bỗng hiện một
     * số khác — trông y như lỗi hiển thị, và mã gõ tiếp sẽ sai hoàn toàn.
     */
    const user = userEvent.setup()
    render(<Bao />)
    const o = layOO()

    await user.click(o[0])
    await user.paste('123456')

    await user.click(o[2])
    await user.keyboard('{Backspace}')

    expect(o[2].value).toBe('')
    // Đây là phần quan trọng: bốn ô sau vẫn giữ nguyên số của mình.
    expect(o[3].value).toBe('4')
    expect(o[4].value).toBe('5')
    expect(o[5].value).toBe('6')
    expect(o[0].value).toBe('1')
    expect(o[1].value).toBe('2')
  })

  it('mã còn khuyết một ô thì KHÔNG gọi onComplete dù đủ 6 vị trí', async () => {
    const user = userEvent.setup()
    const xong = vi.fn()
    render(<Bao onComplete={xong} />)
    const o = layOO()

    await user.click(o[0])
    await user.paste('123456')
    expect(xong).toHaveBeenCalledOnce()

    // Xoá một ô giữa: chuỗi vẫn dài 6 (ô khuyết là dấu cách) nhưng chưa hợp lệ.
    await user.click(o[2])
    await user.keyboard('{Backspace}')

    expect(xong).toHaveBeenCalledOnce()
  })

  it('phím mũi tên đi lại được giữa các ô', async () => {
    const user = userEvent.setup()
    render(<Bao />)
    const o = layOO()

    await user.click(o[3])
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(o[2])

    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(o[4])
  })

  it('gọi onComplete đúng một lần khi vừa đủ 6 chữ số', async () => {
    // Đây là thứ khiến người dùng không phải bấm thêm nút Xác thực.
    const user = userEvent.setup()
    const xong = vi.fn()
    render(<Bao onComplete={xong} />)

    await user.click(layOO()[0])
    await user.keyboard('483920')

    expect(xong).toHaveBeenCalledOnce()
    expect(xong).toHaveBeenCalledWith('483920')
  })

  it('không nhận chữ cái', async () => {
    const user = userEvent.setup()
    render(<Bao />)

    await user.click(layOO()[0])
    await user.keyboard('abc')

    expect(layOO().every((x) => x.value === '')).toBe(true)
  })

  it('chỉ ô đầu mang autoComplete=one-time-code', () => {
    // Đặt ở cả sáu ô thì trình duyệt bối rối và không gợi ý mã từ tin nhắn nữa.
    render(<Bao />)
    const o = layOO()

    expect(o[0]).toHaveProperty('autocomplete', 'one-time-code')
    expect(o[1]).toHaveProperty('autocomplete', 'off')
  })
})
