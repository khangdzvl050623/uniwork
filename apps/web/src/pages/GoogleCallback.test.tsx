import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { AuthUser } from '@uniwork/shared'
import { GoogleCallback } from './GoogleCallback'

/**
 * Trang này không có test nào cho tới 2026-09-15, và nhánh lỗi của nó vừa làm
 * mất một buổi truy vết: người dùng chỉ thấy "Không đăng nhập được, vui lòng
 * thử lại" nên bấm lại mãi, trong khi nguyên nhân thật nằm ở thiết lập trình
 * duyệt (chặn cookie bên thứ ba ở chế độ ẩn danh).
 *
 * Nên thứ được khoá ở đây là NỘI DUNG câu báo lỗi, không chỉ là "có điều hướng
 * về trang đăng nhập". Câu chữ chính là tính năng.
 */

const { useAuth, khoiPhucPhien } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  khoiPhucPhien: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth }))
vi.mock('@/lib/api', () => ({ khoiPhucPhien }))

beforeEach(() => vi.clearAllMocks())

/** Điểm đến giả, in ra nơi đã tới kèm query string để test đọc được. */
function ViTri({ nhan }: { nhan: string }) {
  const { search } = useLocation()
  return <div data-testid="vi-tri" data-search={search}>{nhan}</div>
}

function hien(state: { status: string; user?: Partial<AuthUser> }) {
  useAuth.mockReturnValue(state)

  render(
    <MemoryRouter initialEntries={['/dang-nhap-google-xong']}>
      <Routes>
        <Route path="/dang-nhap-google-xong" element={<GoogleCallback />} />
        <Route path="/dang-nhap" element={<ViTri nhan="dang-nhap" />} />
        <Route path="/ho-so" element={<ViTri nhan="ho-so" />} />
        <Route path="/" element={<ViTri nhan="trang-chu" />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Lấy lại tham số `loi` đã được giải mã từ URL vừa điều hướng tới. */
function loiTrenUrl(): string {
  const search = screen.getByTestId('vi-tri').getAttribute('data-search') ?? ''
  return new URLSearchParams(search).get('loi') ?? ''
}

describe('GoogleCallback', () => {
  it('đang kiểm tra: chờ, chưa điều hướng đi đâu', () => {
    hien({ status: 'dang-kiem-tra' })

    expect(screen.getByText('Đang hoàn tất đăng nhập…')).toBeTruthy()
    expect(screen.queryByTestId('vi-tri')).toBeNull()
  })

  it('gọi khoiPhucPhien đúng một lần để đổi cookie lấy access token', () => {
    hien({ status: 'dang-kiem-tra' })

    expect(khoiPhucPhien).toHaveBeenCalledTimes(1)
  })

  it('refresh hỏng: báo đúng nguyên nhân là trình duyệt chặn cookie', () => {
    hien({ status: 'chua-dang-nhap' })

    expect(screen.getByTestId('vi-tri').textContent).toBe('dang-nhap')

    const loi = loiTrenUrl()
    // Nói ra NGUYÊN NHÂN...
    expect(loi).toContain('chặn cookie')
    expect(loi).toContain('ẩn danh')
    // ...và ít nhất một LỐI THOÁT bấm được ngay.
    expect(loi).toContain('cửa sổ thường')
    expect(loi).toContain('email')
  })

  it('refresh hỏng: không dùng lại câu chung chung cũ', () => {
    hien({ status: 'chua-dang-nhap' })

    // Câu này từng là toàn bộ nội dung báo lỗi. Nó là ngõ cụt: bấm lại bao
    // nhiêu lần cũng hỏng y hệt vì nguyên nhân nằm ở trình duyệt.
    expect(loiTrenUrl()).not.toBe('Không đăng nhập được, vui lòng thử lại')
  })

  it('tài khoản Google mới (chưa điền hồ sơ): đưa thẳng tới trang hồ sơ', () => {
    hien({
      status: 'da-dang-nhap',
      user: { role: 'STUDENT', email: 'sv@example.test', displayName: 'sv@example.test' },
    })

    expect(screen.getByTestId('vi-tri').textContent).toBe('ho-so')
  })

  it('đã có hồ sơ: về trang chủ', () => {
    hien({
      status: 'da-dang-nhap',
      user: { role: 'STUDENT', email: 'sv@example.test', displayName: 'Nguyễn Văn A' },
    })

    expect(screen.getByTestId('vi-tri').textContent).toBe('trang-chu')
  })

  it('nhà tuyển dụng: về trang chủ, không đẩy sang hồ sơ sinh viên', () => {
    hien({
      status: 'da-dang-nhap',
      user: { role: 'EMPLOYER', email: 'ntd@example.test', displayName: 'ntd@example.test' },
    })

    expect(screen.getByTestId('vi-tri').textContent).toBe('trang-chu')
  })
})
