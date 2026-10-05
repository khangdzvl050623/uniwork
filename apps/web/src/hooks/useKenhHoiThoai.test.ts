import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKenhHoiThoai } from './useKenhHoiThoai'

/**
 * Vòng đời listener của `useKenhHoiThoai` trên socket DÙNG CHUNG.
 *
 * ===========================================================================
 * VÌ SAO TEST NÀY TỒN TẠI
 * ===========================================================================
 * Socket là singleton sống suốt phiên làm việc (`lib/socket.ts`), còn hook này
 * mount/unmount mỗi lần người dùng mở một hội thoại. Listener nào không được
 * gỡ khi unmount sẽ ở lại trên socket mãi mãi.
 *
 * Bản trước đăng ký `connect` bằng một hàm viết tại chỗ, nên phần dọn không
 * `off` được nó — ba sự kiện kia gỡ đúng, riêng cái này thì tích lại. Không có
 * lỗi nào hiện ra: chỉ là mỗi lần socket nối lại, mọi listener cũ cùng chạy và
 * gọi `hoi-thoai:vao` cho những phiên người dùng đã rời. Review 2026-10-05.
 *
 * Socket giả dưới đây ĐẾM listener thật, nên kiểm được đúng điều đó thay vì
 * kiểm "đã gọi off chưa" — cái sau xanh được kể cả khi `off` truyền sai hàm.
 */

/* Một socket giả đủ dùng: đếm listener theo tên sự kiện, `off` theo tham chiếu. */
const socketGia = vi.hoisted(() => {
  const ds = new Map<string, Set<(...a: unknown[]) => void>>()
  return {
    connected: false,
    on(ten: string, fn: (...a: unknown[]) => void) {
      if (!ds.has(ten)) ds.set(ten, new Set())
      ds.get(ten)!.add(fn)
      return this
    },
    off(ten: string, fn: (...a: unknown[]) => void) {
      ds.get(ten)?.delete(fn)
      return this
    },
    emit: vi.fn(),
    soListener: (ten: string) => ds.get(ten)?.size ?? 0,
    xoaHet: () => ds.clear(),
  }
})

/*
 * Trả lời theo TÊN sự kiện, để từng ca dựng đúng cảnh nó cần.
 *
 * Kiểu khai TƯỜNG MINH `Promise<unknown>`. Để TypeScript tự suy thì nó chốt
 * kiểu theo cài đặt ĐẦU TIÊN — `tinNhan: never[]` vì mảng rỗng — và mọi
 * `mockImplementation` sau đó trả tin thật đều lệch kiểu.
 */
const goiSocketGia = vi.hoisted(() =>
  vi.fn<(s: unknown, ten: string) => Promise<unknown>>(async (_s, ten) =>
    ten === 'hoi-thoai:vao'
      ? { ok: true, cursor: 'c', duocGui: false, vai: 'CHU', state: 'AI_ACTIVE' }
      : { ok: true, tinNhan: [], cursor: 'c', conNua: false },
  ),
)

vi.mock('@/lib/socket', () => ({
  moSocket: () => socketGia,
  goiSocket: goiSocketGia,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1', role: 'STUDENT' } }),
}))

const apiFetchGia = vi.hoisted(() =>
  vi.fn(async (_url: string): Promise<unknown> => ({
    tinNhan: [],
    cursor: 'c',
    conNua: false,
    duocGui: false,
    state: 'AI_ACTIVE',
  })),
)

vi.mock('@/lib/api', () => ({
  ApiClientError: class extends Error {},
  apiFetch: apiFetchGia,
}))

const SU_KIEN = ['connect', 'hoi-thoai:tin-moi', 'hoi-thoai:trang-thai', 'hoi-thoai:dang-go']

afterEach(() => {
  socketGia.xoaHet()
  socketGia.connected = false
  apiFetchGia.mockClear()
  goiSocketGia.mockClear()
})

describe('useKenhHoiThoai — listener trên socket dùng chung', () => {
  it('đang mở thì có đúng MỘT listener cho mỗi sự kiện', () => {
    const { unmount } = renderHook(() => useKenhHoiThoai('p-1'))
    for (const ten of SU_KIEN) expect(socketGia.soListener(ten), ten).toBe(1)
    unmount()
  })

  /*
   * Ca này là lý do của cả file: mở rồi đóng năm hội thoại liên tiếp — đúng
   * như admin bấm qua hàng đợi hỗ trợ — thì socket phải sạch, không còn một
   * listener nào của năm phiên đã rời.
   */
  it('mở rồi đóng năm hội thoại: không để lại listener nào, kể cả `connect`', () => {
    for (let i = 0; i < 5; i += 1) {
      const { unmount } = renderHook(() => useKenhHoiThoai(`p-${i}`))
      unmount()
    }
    for (const ten of SU_KIEN) expect(socketGia.soListener(ten), ten).toBe(0)
  })

  /* Đổi phiên mà không unmount — admin bấm từ ticket này sang ticket kia. */
  it('đổi sang phiên khác thì listener của phiên cũ được gỡ', () => {
    const { rerender, unmount } = renderHook(({ id }) => useKenhHoiThoai(id), {
      initialProps: { id: 'p-a' },
    })
    rerender({ id: 'p-b' })
    rerender({ id: 'p-c' })

    for (const ten of SU_KIEN) expect(socketGia.soListener(ten), ten).toBe(1)
    unmount()
  })
})

const tin = (seq: number) => ({
  id: `m-${seq}`,
  seq,
  senderType: 'STUDENT',
  body: `tin ${seq}`,
  createdAt: '2026-10-05T03:00:00.000Z',
})

/*
 * ===========================================================================
 * PHÂN TRANG PHÍA CLIENT
 * ===========================================================================
 * Server đã trả `conNua` từ đầu, client chưa từng đọc — nên mất mạng lâu chỉ
 * nhận về 50 tin. Và mở luồng thì nhận 50 tin CŨ NHẤT. Hai ca dưới canh hai
 * nửa của việc sửa.
 */
describe('useKenhHoiThoai — phân trang', () => {
  it('tải tin cũ gửi đúng truocSeq, và chèn lên đầu đúng thứ tự', async () => {
    apiFetchGia.mockImplementation(async (url: string) =>
      url.includes('truocSeq')
        ? { tinNhan: [tin(49), tin(50)], conCu: false }
        : {
            tinNhan: [tin(51), tin(52)],
            cursor: 'c',
            conNua: false,
            conCu: true,
            duocGui: false,
            state: 'AI_ACTIVE',
          },
    )

    const { result, unmount } = renderHook(() => useKenhHoiThoai('p-1'))
    await waitFor(() => expect(result.current.tinNhan).toHaveLength(2))
    expect(result.current.conCu).toBe(true)

    await act(() => result.current.taiCu())

    expect(apiFetchGia).toHaveBeenCalledWith('/api/hoi-thoai/p-1/tin-nhan?truocSeq=51')
    expect(result.current.tinNhan.map((t) => t.seq)).toEqual([49, 50, 51, 52])
    expect(result.current.conCu).toBe(false)
    unmount()
  })

  /*
   * Mất mạng lâu, lỡ hơn 50 tin: tải bù phải gọi TIẾP cho tới khi server báo
   * hết. Bản trước dừng sau một trang.
   */
  it('tải bù gọi tiếp cho tới khi hết conNua', async () => {
    let lan = 0
    goiSocketGia.mockImplementation(async (_s, ten) => {
      if (ten === 'hoi-thoai:vao') {
        return { ok: true, cursor: 'moi-hon', duocGui: false, vai: 'CHU', state: 'AI_ACTIVE' }
      }
      lan += 1
      return lan === 1
        ? { ok: true, tinNhan: [tin(60)], cursor: 'c1', conNua: true }
        : { ok: true, tinNhan: [tin(61)], cursor: 'c2', conNua: false }
    })
    socketGia.connected = true

    const { result, unmount } = renderHook(() => useKenhHoiThoai('p-1'))
    await waitFor(() => expect(lan).toBe(2))
    await waitFor(() =>
      expect(result.current.tinNhan.map((t) => t.seq)).toEqual(expect.arrayContaining([60, 61])),
    )
    unmount()
  })
})
