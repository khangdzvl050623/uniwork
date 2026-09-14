import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PostJob } from './PostJob'

const { suaTin, taoTin, guiDuyet, tinCu } = vi.hoisted(() => ({
  suaTin: vi.fn(),
  taoTin: vi.fn(),
  guiDuyet: vi.fn(),
  tinCu: {
    id: 'job-1',
    title: 'Phục vụ lễ tân khách sạn',
    description: 'Tiếp đón khách đến khách sạn và hướng dẫn khách hoàn tất thủ tục nhận phòng.',
    requirements: [],
    benefits: [],
    city: 'TP.HCM',
    district: 'Quận 7',
    quantity: 2,
    salaryNegotiable: true,
    salaryMin: null,
    salaryMax: null,
    salaryUnit: 'HOUR',
    scheduleType: 'RECURRING',
    commitmentMonths: null,
    minShiftsPerWeek: null,
    startDate: null,
    endDate: null,
    workDate: null,
    deadline: '2099-01-01',
    shifts: [{ dayOfWeek: 5, slot: 'MORNING' }],
    skills: [],
    status: 'DRAFT',
  },
}))

vi.mock('@/hooks/useEmployerJobs', () => ({
  useMyJob: (id?: string) => ({ data: id ? tinCu : undefined, isLoading: false }),
  useCreateJob: () => ({ mutateAsync: taoTin, isPending: false }),
  useUpdateJob: () => ({ mutateAsync: suaTin, isPending: false }),
  useSubmitJob: () => ({ mutateAsync: guiDuyet, isPending: false }),
}))
vi.mock('@/hooks/useProfile', () => ({
  useSkills: () => ({ data: [] }),
  useMe: () => ({ data: { employerProfile: { verifiedAt: '2026-01-01' } } }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  suaTin.mockResolvedValue({ id: 'job-1' })
})

function hien(sua = true) {
  render(
    <MemoryRouter initialEntries={[sua ? '/ntd/dang-tin?id=job-1' : '/ntd/dang-tin']}>
      <PostJob />
    </MemoryRouter>,
  )
  return screen.getByRole('spinbutton', { name: 'Số lượng cần tuyển' }) as HTMLInputElement
}

describe('Số lượng cần tuyển', () => {
  it.each([true, false])('0002 được chuẩn hoá khi rời ô ở chế độ sửa=%s', (sua) => {
    const input = hien(sua)
    fireEvent.change(input, { target: { value: '0002' } })
    fireEvent.blur(input)
    expect(input.value).toBe('2')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(screen.getByText('Nhập số nguyên từ 1 đến 999 người. Ví dụ: 2.')).toBeTruthy()
  })

  it('xoá hết giữ ô trống; báo thiếu khi rời ô; điền lại thì hết lỗi', async () => {
    const input = hien()
    const user = userEvent.setup()
    await user.clear(input)
    expect(input.value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.tab()
    expect(screen.getByRole('alert').textContent).toBe('Vui lòng nhập số lượng cần tuyển')
    await user.type(input, '2')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['', 'Vui lòng nhập số lượng cần tuyển'],
    ['0', 'Số lượng tuyển tối thiểu là 1'],
    ['-2', 'Số lượng tuyển tối thiểu là 1'],
    ['1.5', 'Số lượng cần tuyển phải là số nguyên'],
    ['1000', 'Số lượng tuyển tối đa là 999'],
  ])('giá trị %s không bị làm tròn/ép về giới hạn và không gửi lên API', async (value, message) => {
    const input = hien()
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)
    expect(input.value).toBe(value)
    expect(screen.getByRole('alert').textContent).toBe(message)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gửi duyệt' }))
    expect(suaTin).not.toHaveBeenCalled()
    expect(taoTin).not.toHaveBeenCalled()
    expect(guiDuyet).not.toHaveBeenCalled()
  })

  it('nhập 0002 rồi lưu thì API nhận số 2', async () => {
    const input = hien()
    const user = userEvent.setup()
    await user.clear(input)
    await user.type(input, '0002')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(input.value).toBe('2')
    await waitFor(() =>
      expect(suaTin).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1', quantity: 2 })),
    )
  })
})
