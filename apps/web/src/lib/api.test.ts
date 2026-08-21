import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@uniwork/shared'
import { ApiClientError, apiFetch, khoiPhucPhien, resetRefreshState } from './api'
import { getAuthState, resetAuthStore, setSession } from './auth-store'

/**
 * Test cho lớp gọi API (T45).
 *
 * Phần đáng test nhất ở đây không phải "gọi được hay không" — mà là cơ chế gom
 * lời gọi refresh. Nó chỉ sai khi có nhiều request hết hạn CÙNG LÚC, tức là
 * đúng lúc khó bắt gặp nhất khi bấm tay, và hậu quả thì nặng: người dùng bị
 * đăng xuất khỏi mọi thiết bị. Đây chính là loại lỗi phải để test canh.
 */

const NGUOI_DUNG: AuthUser = {
  id: 'u-1',
  email: 'khang@sinhvien.edu.vn',
  role: 'STUDENT',
  emailVerifiedAt: null,
  displayName: 'Khang',
}

/**
 * Dựng một Response giả đủ dùng cho `apiFetch`.
 *
 * Phải có cả `ok` chứ không chỉ `status`: `goiRefresh` kiểm `response.ok`, và
 * thiếu thuộc tính đó thì nó là `undefined` — luôn falsy — nên mọi lời gọi
 * refresh trong test đều "thất bại" dù server giả trả 200.
 */
function traVe(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

const thanhCong = (data: unknown) => traVe({ ok: true, data })
const thatBai = (code: string, message: string, status: number) =>
  traVe({ ok: false, error: { code, message } }, status)

let fetchGia: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetAuthStore()
  resetRefreshState()
  fetchGia = vi.fn()
  vi.stubGlobal('fetch', fetchGia)
})

describe('apiFetch — phần cơ bản', () => {
  it('bóc lớp vỏ ApiSuccess, trả thẳng phần data', async () => {
    fetchGia.mockResolvedValue(thanhCong({ ten: 'UniWork' }))

    await expect(apiFetch('/api/thu')).resolves.toEqual({ ten: 'UniWork' })
  })

  it('ném ApiClientError kèm mã lỗi khi server trả ApiFailure', async () => {
    fetchGia.mockResolvedValue(thatBai('NOT_FOUND', 'Không thấy', 404))

    await expect(apiFetch('/api/thu')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })

  it('server trả HTML (không phải JSON) thì vẫn ném lỗi đọc được, không sập', async () => {
    fetchGia.mockResolvedValue({
      status: 502,
      json: () => Promise.reject(new Error('Unexpected token <')),
    } as unknown as Response)

    await expect(apiFetch('/api/thu')).rejects.toBeInstanceOf(ApiClientError)
  })

  it('gắn Authorization khi đã có token', async () => {
    setSession('token-abc', NGUOI_DUNG)
    fetchGia.mockResolvedValue(thanhCong({}))

    await apiFetch('/api/toi')

    const headers = fetchGia.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer token-abc')
  })

  it('KHÔNG tự đặt Content-Type cho FormData', async () => {
    // Trình duyệt phải tự đặt để chèn chuỗi `boundary` ngăn cách các phần.
    // Ghi đè bằng tay là server nhận multipart không bóc ra được.
    fetchGia.mockResolvedValue(thanhCong({}))

    await apiFetch('/api/toi/cv', { method: 'POST', body: new FormData() })

    const headers = fetchGia.mock.calls[0][1].headers as Headers
    expect(headers.has('Content-Type')).toBe(false)
  })
})

describe('apiFetch — tự gia hạn phiên khi gặp 401 (T45)', () => {
  it('401 khi đang đăng nhập: refresh rồi gọi lại, người dùng không thấy gì', async () => {
    setSession('token-cu', NGUOI_DUNG)

    fetchGia
      .mockResolvedValueOnce(thatBai('UNAUTHORIZED', 'Hết hạn', 401))
      .mockResolvedValueOnce(thanhCong({ accessToken: 'token-moi', user: NGUOI_DUNG }))
      .mockResolvedValueOnce(thanhCong({ id: 'u-1' }))

    await expect(apiFetch('/api/toi')).resolves.toEqual({ id: 'u-1' })

    // Lần gọi lại phải mang token MỚI, không phải token đã hết hạn.
    const headerLanCuoi = fetchGia.mock.calls[2][1].headers as Headers
    expect(headerLanCuoi.get('Authorization')).toBe('Bearer token-moi')
    expect(getAuthState().accessToken).toBe('token-moi')
  })

  it('BỐN request cùng hết hạn chỉ gọi refresh ĐÚNG MỘT LẦN', async () => {
    /*
     * Đây là ca quan trọng nhất của cả file.
     *
     * Server xoay vòng refresh token: lần refresh đầu thu hồi token cũ. Nếu ba
     * request còn lại cũng tự gọi refresh, chúng vẫn cầm token đã bị thu hồi —
     * và server coi "token đã thu hồi bị đem ra dùng" là dấu hiệu bị đánh cắp,
     * rồi huỷ TOÀN BỘ phiên của tài khoản. Người dùng bị đăng xuất khỏi mọi
     * thiết bị chỉ vì mở một trang có bốn request.
     */
    setSession('token-cu', NGUOI_DUNG)

    fetchGia.mockImplementation((url: string) => {
      if (url.includes('/api/auth/refresh')) {
        return Promise.resolve(thanhCong({ accessToken: 'token-moi', user: NGUOI_DUNG }))
      }
      // Mọi request mang token cũ đều hết hạn; mang token mới thì qua.
      return Promise.resolve(thanhCong({ ok: true }))
    })

    // Bốn request đầu tiên phải nhận 401 để kích hoạt refresh.
    let soLan401 = 0
    fetchGia.mockImplementation((url: string, init: RequestInit) => {
      if (url.includes('/api/auth/refresh')) {
        return Promise.resolve(thanhCong({ accessToken: 'token-moi', user: NGUOI_DUNG }))
      }
      const headers = init.headers as Headers
      if (headers.get('Authorization') === 'Bearer token-cu') {
        soLan401++
        return Promise.resolve(thatBai('UNAUTHORIZED', 'Hết hạn', 401))
      }
      return Promise.resolve(thanhCong({ xong: true }))
    })

    const ketQua = await Promise.all([
      apiFetch('/api/toi'),
      apiFetch('/api/toi/lich-ranh'),
      apiFetch('/api/skills'),
      apiFetch('/api/toi/ho-so-sinh-vien'),
    ])

    expect(ketQua).toEqual([{ xong: true }, { xong: true }, { xong: true }, { xong: true }])
    expect(soLan401).toBe(4)

    const soLanGoiRefresh = fetchGia.mock.calls.filter((c) =>
      String(c[0]).includes('/api/auth/refresh'),
    ).length
    expect(soLanGoiRefresh).toBe(1)
  })

  it('refresh hỏng thì xoá phiên và để lỗi 401 nổi lên', async () => {
    setSession('token-cu', NGUOI_DUNG)

    fetchGia
      .mockResolvedValueOnce(thatBai('UNAUTHORIZED', 'Hết hạn', 401))
      .mockResolvedValueOnce(thatBai('UNAUTHORIZED', 'Phiên hết hạn', 401))

    await expect(apiFetch('/api/toi')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

    // Giao diện phải chuyển ngay sang trạng thái chưa đăng nhập, thay vì hiện
    // nút "Đăng xuất" cho một phiên đã chết.
    expect(getAuthState().status).toBe('chua-dang-nhap')
    expect(getAuthState().accessToken).toBeNull()
  })

  it('CHƯA đăng nhập mà gặp 401 thì KHÔNG gọi refresh', async () => {
    // Không có gì để gia hạn. Gọi refresh chỉ tốn thêm một vòng mạng cho mỗi
    // lần người lạ chạm vào endpoint cần quyền.
    fetchGia.mockResolvedValue(thatBai('UNAUTHORIZED', 'Cần đăng nhập', 401))

    await expect(apiFetch('/api/toi')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(fetchGia).toHaveBeenCalledOnce()
  })

  it('khongTuRefresh chặn gia hạn — dùng cho chính màn đăng nhập', async () => {
    /*
     * Sai mật khẩu cũng trả 401. Nếu để cơ chế gia hạn chạy ở đây thì người
     * đang đăng nhập bằng tài khoản A mà gõ nhầm mật khẩu tài khoản B sẽ bị
     * xoá mất phiên A đang dùng tốt.
     */
    setSession('token-dang-dung', NGUOI_DUNG)
    fetchGia.mockResolvedValue(thatBai('UNAUTHORIZED', 'Sai mật khẩu', 401))

    await expect(
      apiFetch('/api/auth/dang-nhap', { method: 'POST' }, { khongTuRefresh: true }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

    expect(fetchGia).toHaveBeenCalledOnce()
    expect(getAuthState().status).toBe('da-dang-nhap')
  })
})

describe('khoiPhucPhien — lúc web vừa mở (T44)', () => {
  it('còn cookie hợp lệ thì dựng lại phiên từ đầu', async () => {
    fetchGia.mockResolvedValue(thanhCong({ accessToken: 'token-moi', user: NGUOI_DUNG }))

    await khoiPhucPhien()

    expect(getAuthState().status).toBe('da-dang-nhap')
    expect(getAuthState().user?.email).toBe('khang@sinhvien.edu.vn')
  })

  it('không có cookie thì chốt trạng thái chưa đăng nhập, không treo ở dang-kiem-tra', async () => {
    // Treo mãi ở 'dang-kiem-tra' nghĩa là route guard quay vòng xoay vĩnh viễn
    // — trang trắng không lý do, còn tệ hơn báo lỗi thẳng.
    fetchGia.mockResolvedValue(thatBai('UNAUTHORIZED', 'Chưa đăng nhập', 401))

    await khoiPhucPhien()

    expect(getAuthState().status).toBe('chua-dang-nhap')
  })
})
