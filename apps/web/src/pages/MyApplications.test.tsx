import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ApplicationStatus, LienHeNhaTuyenDung } from '@uniwork/shared'
import { MyApplications } from './MyApplications'

const { useMyApplications } = vi.hoisted(() => ({ useMyApplications: vi.fn() }))
vi.mock('@/hooks/useApplications', () => ({
  useMyApplications,
  useWithdrawApplication: () => ({ mutate: vi.fn(), isPending: false }),
}))

beforeEach(() => vi.clearAllMocks())

function hien(contact: LienHeNhaTuyenDung | null, status: ApplicationStatus = 'SHORTLISTED') {
  useMyApplications.mockReturnValue({
    data: {
      applications: [
        {
          id: 'app-1',
          status,
          jobId: 'job-1',
          jobTitle: 'Phục vụ quán cà phê',
          companyName: 'Cà phê Sương Mai',
          createdAt: '2026-09-01T00:00:00Z',
          statusChangedAt: null,
          coverLetter: null,
          cvUrl: null,
          matchBreakdown: null,
          job: { employer: { companyName: 'Cà phê Sương Mai', verified: true, contact } },
          events: [],
        },
      ],
    },
    isPending: false,
    isError: false,
  })
  render(
    <MemoryRouter>
      <MyApplications />
    </MemoryRouter>,
  )
}

describe('Đơn của tôi — liên hệ NTD', () => {
  it('hiện tên người phụ trách, link gọi/mail và lý do nhận diện số', () => {
    hien({ contactName: 'Lê Thị Sương', phone: '0901234567', email: 'ntd@example.test' })
    expect(screen.getByText(/Cà phê Sương Mai · Lê Thị Sương/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '0901234567' }).getAttribute('href')).toBe(
      'tel:0901234567',
    )
    expect(screen.getByRole('link', { name: 'ntd@example.test' }).getAttribute('href')).toBe(
      'mailto:ntd@example.test',
    )
    expect(screen.getByText('Số này có thể gọi tới bạn trong vài ngày tới.')).toBeTruthy()
  })

  it('thiếu số/tên vẫn có email và thông báo chưa cập nhật', () => {
    hien({ contactName: null, phone: null, email: 'ntd@example.test' })
    expect(screen.getByText(/Số điện thoại: chưa cập nhật/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ntd@example.test' })).toBeTruthy()
    expect(document.querySelector('a[href^="tel:"]')).toBeNull()
    expect(screen.queryByText(/Số này có thể gọi/)).toBeNull()
    expect(screen.queryByText(/null/)).toBeNull()
  })

  it.each(['PENDING', 'VIEWED', 'WITHDRAWN', 'REJECTED'] as const)(
    '%s: hiện lý do khoá và không có liên hệ',
    (status) => {
      hien(null, status)
      expect(
        screen.getByText(
          status === 'PENDING' || status === 'VIEWED'
            ? 'Thông tin liên hệ sẽ mở khi nhà tuyển dụng mời bạn phỏng vấn.'
            : 'Đơn đã kết thúc. Thông tin liên hệ nhà tuyển dụng đã đóng.',
        ),
      ).toBeTruthy()
      expect(document.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull()
    },
  )
})
