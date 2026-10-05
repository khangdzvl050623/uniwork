import { renderHook } from '@testing-library/react'
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

vi.mock('@/lib/socket', () => ({
  moSocket: () => socketGia,
  goiSocket: vi.fn(async () => ({
    ok: true,
    cursor: 'c',
    duocGui: false,
    vai: 'CHU',
    state: 'AI_ACTIVE',
  })),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1', role: 'STUDENT' } }),
}))

vi.mock('@/lib/api', () => ({
  ApiClientError: class extends Error {},
  apiFetch: vi.fn(async () => ({
    tinNhan: [],
    cursor: 'c',
    conNua: false,
    duocGui: false,
    state: 'AI_ACTIVE',
  })),
}))

const SU_KIEN = ['connect', 'hoi-thoai:tin-moi', 'hoi-thoai:trang-thai', 'hoi-thoai:dang-go']

afterEach(() => socketGia.xoaHet())

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
