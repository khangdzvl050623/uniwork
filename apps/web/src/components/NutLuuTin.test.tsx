import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicJobSummary, Role } from '@uniwork/shared'
import { NutLuuTin } from './NutLuuTin'

/**
 * Test cho nút lưu tin (Sprint 3).
 *
 * Ba nhóm hành vi đáng bảo vệ ở đây, theo thứ tự dễ hỏng mà không ai thấy:
 *
 * 1. QUYỀN HIỂN THỊ — nút phải biến mất với khách và nhà tuyển dụng. Hỏng chỗ
 *    này thì NTD thấy một nút bấm vào là 403.
 * 2. CHẶN LAN SỰ KIỆN — thẻ tin bọc ngoài là một liên kết. Quên `preventDefault`
 *    thì bấm lưu xong trang tự nhảy sang chi tiết tin. Không có test thì lỗi này
 *    chỉ lộ ra khi dùng tay đúng ở trang danh sách.
 * 3. GỌI ĐÚNG PHƯƠNG THỨC — lưu là POST, bỏ lưu là DELETE. Đảo hai cái thì giao
 *    diện vẫn đổi màu đúng (nhờ cập nhật lạc quan) rồi mới lặng lẽ quay về sau
 *    khi server trả lời.
 */

/* `useAuth` đọc từ một store ngoài React nên mock ở tầng module là cách gọn
   nhất để đổi vai giữa các ca test. */
const vaiHienTai = vi.hoisted(() => ({ role: 'STUDENT' as Role | null }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: vaiHienTai.role ? { id: 'u-1', role: vaiHienTai.role } : null,
    daDangNhap: vaiHienTai.role !== null,
  }),
}))

const goiApi = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  apiFetch: (url: string, init?: RequestInit) => goiApi(url, init),
}))

const TIN = {
  id: 'job-1',
  title: 'Phục vụ quán cà phê ca tối',
  employer: { companyName: 'Sương Mai', verified: true },
  city: 'TP.HCM',
  district: 'Quận 1',
  quantity: 2,
  salaryNegotiable: false,
  salaryMin: 25000,
  salaryMax: 30000,
  salaryUnit: 'HOUR',
  scheduleType: 'RECURRING',
  commitmentMonths: 3,
  deadline: '2026-09-30T00:00:00.000Z',
  publishedAt: '2026-08-10T00:00:00.000Z',
  skills: [],
  shifts: [{ dayOfWeek: 2, slot: 'EVENING' }],
} as unknown as PublicJobSummary

/** Danh sách tin đã lưu mà endpoint trả về. Mặc định là chưa lưu gì. */
function datDanhSachDaLuu(ids: string[]) {
  goiApi.mockImplementation((_url: string, init?: RequestInit) => {
    if (!init?.method) {
      return Promise.resolve({
        savedJobs: ids.map((id) => ({
          job: { ...TIN, id },
          savedAt: '2026-08-20T00:00:00.000Z',
          stillOpen: true,
        })),
        total: ids.length,
      })
    }
    return Promise.resolve({ jobId: 'job-1', saved: init.method === 'POST' })
  })
}

function ve(job: PublicJobSummary = TIN) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <NutLuuTin job={job} />
    </QueryClientProvider>,
  )
}

const nut = () => screen.getByRole('button', { name: `Lưu tin ${TIN.title}` })

beforeEach(() => {
  vaiHienTai.role = 'STUDENT'
  goiApi.mockReset()
  datDanhSachDaLuu([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('NutLuuTin — quyền hiển thị', () => {
  it('sinh viên đã đăng nhập thì thấy nút', async () => {
    ve()
    expect(await screen.findByRole('button')).toBeTruthy()
  })

  it('khách chưa đăng nhập KHÔNG thấy nút', () => {
    vaiHienTai.role = null
    ve()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('nhà tuyển dụng KHÔNG thấy nút', () => {
    // NTD không có nhu cầu lưu tin của chính nghề mình. Hiện nút rồi trả 403
    // là hứa một thứ không tồn tại.
    vaiHienTai.role = 'EMPLOYER'
    ve()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('admin KHÔNG thấy nút', () => {
    vaiHienTai.role = 'ADMIN'
    ve()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('vai khác sinh viên thì KHÔNG gọi endpoint tin đã lưu', async () => {
    // Bật truy vấn cho NTD là mỗi lần vào trang việc làm gọi một lần chắc chắn
    // trả 403 — rác trong log và một request thừa.
    vaiHienTai.role = 'EMPLOYER'
    ve()
    await waitFor(() => expect(goiApi).not.toHaveBeenCalled())
  })
})

describe('NutLuuTin — trạng thái', () => {
  it('tin chưa lưu thì aria-pressed = false', async () => {
    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('false'))
  })

  it('tin đã lưu thì aria-pressed = true', async () => {
    datDanhSachDaLuu(['job-1'])
    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('true'))
  })

  it('tin KHÁC đã lưu không làm nút của tin này bật lên', async () => {
    // Nhầm chỗ này thì lưu một tin làm cả danh sách hiện dấu trang.
    datDanhSachDaLuu(['job-khac'])
    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('false'))
  })
})

describe('NutLuuTin — thao tác', () => {
  it('bấm khi chưa lưu thì gọi POST', async () => {
    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('false'))

    await userEvent.click(nut())

    await waitFor(() =>
      expect(goiApi).toHaveBeenCalledWith(
        '/api/toi/tin-da-luu/job-1',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('bấm khi đã lưu thì gọi DELETE', async () => {
    datDanhSachDaLuu(['job-1'])
    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('true'))

    await userEvent.click(nut())

    await waitFor(() =>
      expect(goiApi).toHaveBeenCalledWith(
        '/api/toi/tin-da-luu/job-1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })

  it('đổi trạng thái NGAY, không đợi server trả lời', async () => {
    // Cập nhật lạc quan. Chờ server mới đổi màu thì trên mạng chậm người dùng
    // bấm lần hai vì tưởng lần đầu trượt.
    let thaServer: (v: unknown) => void = () => {}
    goiApi.mockImplementation((_url: string, init?: RequestInit) => {
      if (!init?.method) return Promise.resolve({ savedJobs: [], total: 0 })
      return new Promise((resolve) => {
        thaServer = resolve
      })
    })

    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('false'))

    await userEvent.click(nut())

    // Server còn chưa trả lời mà nút đã bật.
    expect(nut().getAttribute('aria-pressed')).toBe('true')

    thaServer({ jobId: 'job-1', saved: true })
  })

  it('server lỗi thì trả nút về trạng thái cũ', async () => {
    goiApi.mockImplementation((_url: string, init?: RequestInit) => {
      if (!init?.method) return Promise.resolve({ savedJobs: [], total: 0 })
      return Promise.reject(new Error('mạng hỏng'))
    })

    ve()
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('false'))

    await userEvent.click(nut())

    // Bật lạc quan rồi phải quay về false khi biết là hỏng — nếu không thì nút
    // nói "đã lưu" trong khi server không có gì.
    await waitFor(() => expect(nut().getAttribute('aria-pressed')).toBe('false'))
  })

  it('CHẶN sự kiện lan ra thẻ tin bọc ngoài', async () => {
    // Thẻ tin là một liên kết phủ kín. Không chặn thì bấm lưu xong trang nhảy
    // sang chi tiết tin, kéo người dùng khỏi danh sách đang lướt dở.
    const bamNgoai = vi.fn()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div onClick={bamNgoai}>
          <NutLuuTin job={TIN} />
        </div>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(nut()).toBeTruthy())
    await userEvent.click(nut())

    expect(bamNgoai).not.toHaveBeenCalled()
  })

  it('giữ `relative z-10` để không bị lớp phủ của thẻ tin nuốt cú bấm', async () => {
    // Kiểm lớp CSS chứ không kiểm hành vi, vì hành vi này jsdom không dựng
    // được: nó không tính layout nên lớp phủ `before:absolute inset-0` không
    // thật sự che gì cả. Test lớp là thứ duy nhất giữ được điều kiện đó —
    // gỡ hai lớp này thì nút vẫn hiện, vẫn đổi màu khi rê chuột, nhưng mọi cú
    // bấm ở trang việc làm đều rơi vào liên kết bọc ngoài.
    ve()
    await waitFor(() => expect(nut()).toBeTruthy())

    expect(nut().className).toContain('relative')
    expect(nut().className).toContain('z-10')
  })
})
