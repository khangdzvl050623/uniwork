import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '@uniwork/shared'
import type { AuthStatus } from '@/lib/auth-store'
import { JobList } from './JobList'

/**
 * Bộ lọc trên URL của trang danh sách việc làm.
 *
 * Hai ca ở đây đều là LỖI ĐÃ XẢY RA THẬT, do một người ngoài nhóm tái hiện trên
 * trình duyệt ngày 2026-09-07. Cả hai sinh ra từ cùng một thiết kế sai: giữ một
 * bản sao bộ lọc trong `useState` khởi tạo từ URL, rồi chỉ ghi một chiều ra URL.
 *
 * `useState` KHÔNG chạy lại hàm khởi tạo khi component còn sống — đó là hành vi
 * React ghi rõ, không phải chuyện bất ngờ. Nên bản sao đó lệch khỏi URL ngay khi
 * URL đổi mà component không bị dựng lại.
 *
 * Nay URL là nguồn sự thật. Hai ca này canh để không ai vô tình dựng lại bản sao.
 */

/* `useAuth` đọc từ một store ngoài React nên mock ở tầng module, cùng cách
   `NutLuuTin.test.tsx` đang làm. */
const phien = vi.hoisted(() => ({
  role: 'STUDENT' as Role | null,
  status: 'da-dang-nhap' as AuthStatus,
  /** Lịch rảnh đã tải xong chưa — điểm mấu chốt của ca thứ hai. */
  daHoiXongLich: true,
  soO: 4,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    status: phien.status,
    user: phien.role ? { id: 'u-1', role: phien.role } : null,
    accessToken: null,
    daDangNhap: phien.status === 'da-dang-nhap',
  }),
}))

vi.mock('@/hooks/useProfile', () => ({
  useSkills: () => ({ data: [] }),
  useAvailability: () => ({
    // Trong lúc chưa hỏi xong, `data` là `undefined` — ĐÚNG như TanStack Query
    // trả về. Đây chính là trạng thái làm lộ lỗi.
    data: phien.daHoiXongLich
      ? { slots: Array.from({ length: phien.soO }, (_, i) => ({ dayOfWeek: i, slot: 'MORNING' })) }
      : undefined,
    isFetched: phien.daHoiXongLich,
  }),
}))

/*
 * Không gọi mạng, nhưng GHI LẠI tham số mỗi lần truy vấn được dựng.
 *
 * Mock rỗng thì không thấy được thứ quan trọng nhất: từ khoá nào thật sự đi
 * xuống API. Bản trước mock kiểu đó nên bỏ lọt việc `q` đang gõ được truyền
 * thẳng vào truy vấn — debounce có mà request vẫn bắn mỗi phím.
 */
const truyVanDaGoi = vi.hoisted(() => [] as { q?: string }[])

vi.mock('@/hooks/usePublicJobs', async (goc) => ({
  ...(await goc<typeof import('@/hooks/usePublicJobs')>()),
  usePublicJobs: (query: { q?: string }) => {
    truyVanDaGoi.push(query)
    return {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }
  },
}))

/** Các từ khoá KHÁC NHAU đã đi xuống API, theo thứ tự. */
function tuKhoaDaGuiDi(): string[] {
  const ra: string[] = []
  for (const { q } of truyVanDaGoi) {
    const v = q ?? ''
    if (ra[ra.length - 1] !== v) ra.push(v)
  }
  return ra
}

/** Hiện query string hiện tại ra màn hình để test đọc được. */
function HienUrl() {
  const { search } = useLocation()
  return <output data-testid="url">{search}</output>
}

/** Nút điều hướng tới một địa chỉ khác mà KHÔNG dựng lại JobList. */
function NutDi({ toi }: { toi: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(toi)}>
      di-chuyen
    </button>
  )
}

function cay(duongDan: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[duongDan]}>
        <HienUrl />
        <NutDi toi="/viec-lam" />
        <Routes>
          <Route path="/viec-lam" element={<JobList />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function ve(duongDan: string) {
  return render(cay(duongDan))
}

const nghi = (ms = 50) => new Promise((r) => setTimeout(r, ms))

const url = () => screen.getByTestId('url').textContent ?? ''

beforeEach(() => {
  truyVanDaGoi.length = 0
  phien.role = 'STUDENT'
  phien.status = 'da-dang-nhap'
  phien.daHoiXongLich = true
  phien.soO = 4
})

describe('JobList — bộ lọc trên URL', () => {
  it('⚠ điều hướng tới /viec-lam không kèm bộ lọc thì bộ lọc cũ KHÔNG mọc lại', async () => {
    /*
     * Ca reviewer tái hiện: đang ở `?skillIds=c1`, bấm "Việc làm" trên header để
     * về `/viec-lam`. React Router giữ nguyên component, nên bản sao trong state
     * vẫn còn `skillIds` và effect dán nó trở lại — người dùng xoá bộ lọc mà bộ
     * lọc tự quay lại.
     */
    const { getByText } = ve('/viec-lam?skillIds=c1')
    await waitFor(() => expect(url()).toContain('skillIds=c1'))

    getByText('di-chuyen').click()

    await waitFor(() => expect(url()).toBe(''))
    // Chờ thêm một nhịp: lỗi cũ không xảy ra ngay, nó xảy ra ở effect kế tiếp.
    await nghi()
    expect(url()).toBe('')
  })

  it('⚠ sinh viên CÓ lịch mở link lọc lịch rảnh thì bộ lọc được giữ', async () => {
    /*
     * Ca reviewer tái hiện: lúc trang vừa mở, phiên còn đang kiểm và lịch rảnh
     * còn đang tải, nên `dungDuocLichRanh` là `false`. Bản đầu coi `false` đó là
     * "không dùng được" và xoá ngay `matchAvailability` — nhưng nó có nghĩa là
     * "CHƯA BIẾT". Lịch về sau đó cũng không có gì khôi phục bộ lọc.
     */
    phien.status = 'dang-kiem-tra'
    phien.daHoiXongLich = false

    const { rerender } = ve('/viec-lam?matchAvailability=true')
    await nghi()
    expect(url(), 'bị gỡ ngay khi còn ĐANG TẢI').toContain('matchAvailability=true')

    // Phiên xác thực xong, lịch về — CÙNG một component render lại, không dựng
    // lại. Đây đúng là khoảnh khắc bản cũ đã đánh mất bộ lọc.
    phien.status = 'da-dang-nhap'
    phien.daHoiXongLich = true
    rerender(cay('/viec-lam?matchAvailability=true'))

    await nghi()
    expect(url(), 'bị gỡ sau khi lịch đã về').toContain('matchAvailability=true')
  })

  it('người KHÔNG dùng được lịch rảnh thì bộ lọc bị gỡ, tránh 401 từ API', async () => {
    // Mặt còn lại của luật: link chia sẻ tới người không phải sinh viên phải gỡ
    // bộ lọc, nếu không họ nhận một màn hình lỗi cho việc duy nhất họ làm là bấm
    // vào link. Không có ca này thì "sửa" ca trên bằng cách bỏ hẳn phép gỡ.
    phien.role = 'EMPLOYER'

    ve('/viec-lam?matchAvailability=true')

    await waitFor(() => expect(url()).not.toContain('matchAvailability'))
  })

  it('bộ lọc đọc từ URL lúc vào thẳng bằng link chia sẻ', async () => {
    ve('/viec-lam?district=Qu%E1%BA%ADn%201&maxShiftsPerWeek=3')

    await nghi()
    expect(url()).toContain('district=')
    expect(url()).toContain('maxShiftsPerWeek=3')
  })
})

describe('JobList — ô tìm kiếm không được bắn request mỗi phím', () => {
  /** Gõ từng ký tự vào ô tìm kiếm, mỗi phím một lần render. */
  async function go(chu: string) {
    const o = screen.getByLabelText('Tìm việc làm') as HTMLInputElement
    for (let i = 1; i <= chu.length; i++) {
      fireEvent.change(o, { target: { value: chu.slice(0, i) } })
      // Ngắn hơn 300ms rất nhiều: mô phỏng người gõ liên tục.
      await nghi(10)
    }
  }

  it('⚠ gõ 6 ký tự KHÔNG tạo 6 truy vấn', async () => {
    /*
     * Lỗi đã gặp thật: `usePublicJobs({ ...boLoc, q, sort })` nhận `q` đang gõ,
     * mà `q` nằm trong `queryKey`, nên mỗi phím là một truy vấn mới và một cache
     * entry mới. Debounce 300ms lúc đó chỉ hoãn việc ghi URL — không ai được lợi.
     *
     * Kiểm ở chỗ giá trị được QUYẾT ĐỊNH (tham số truyền vào hook), không kiểm
     * số request trên mạng: hook đã mock nên mạng không nói gì được.
     */
    ve('/viec-lam')
    await nghi()

    await go('gia su')

    // Trong lúc còn đang gõ, API vẫn chỉ mới thấy từ khoá rỗng ban đầu.
    expect(tuKhoaDaGuiDi()).toEqual([''])
  })

  it('gõ xong 300ms thì từ khoá ĐÃ LẮNG mới xuống API, đúng một lần', async () => {
    ve('/viec-lam')
    await nghi()

    await go('gia su')
    await nghi(400)

    expect(tuKhoaDaGuiDi()).toEqual(['', 'gia su'])
  })

  it('⚠ nút "Xoá bộ lọc" xoá LUÔN ô tìm kiếm, không chỉ cột lọc', async () => {
    /*
     * Lỗi có sẵn từ trước. `coBoLoc` — thứ quyết định nút này hiện hay không —
     * tính cả `q` là một bộ lọc, nhưng hàm xoá thì chỉ dọn cột lọc. Người tìm
     * một chuỗi không có kết quả sẽ thấy nút "Xoá bộ lọc", bấm vào, rồi vẫn
     * nhìn màn hình trống y như cũ.
     */
    ve('/viec-lam?q=khongcogi&district=Qu%E1%BA%ADn%201')
    await nghi()

    screen.getByText('Xoá bộ lọc').click()
    await nghi()

    expect(url()).toBe('')
    expect((screen.getByLabelText('Tìm việc làm') as HTMLInputElement).value).toBe('')
    expect(tuKhoaDaGuiDi().at(-1)).toBe('')
  })

  it('ô nhập vẫn phản hồi tức thì trong lúc chờ — không khoá tay người gõ', async () => {
    // Mặt còn lại: hoãn REQUEST chứ không hoãn ô nhập. Thiếu ca này thì "sửa"
    // được ca trên bằng cách debounce luôn cả `value` của ô, và người dùng gõ
    // vào một ô trễ 300ms.
    ve('/viec-lam')
    await nghi()

    await go('gia')

    expect((screen.getByLabelText('Tìm việc làm') as HTMLInputElement).value).toBe('gia')
  })
})
