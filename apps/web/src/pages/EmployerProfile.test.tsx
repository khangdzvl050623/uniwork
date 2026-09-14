import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmployerProfile } from './EmployerProfile'
import { apiFetch } from '@/lib/api'

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  apiFetch: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('Hồ sơ NTD — nhập liên hệ', () => {
  it('nạp số cũ, sửa và gửi phone/contactName qua hook thật dù website để trống', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      email: 'ntd@example.test',
      employerProfile: {
        companyName: 'Cà phê Sương Mai',
        contactName: 'Tên cũ',
        phone: '0909999999',
        description: null,
        address: null,
        website: null,
        verifiedAt: null,
        documents: [],
      },
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <EmployerProfile />
      </QueryClientProvider>,
    )
    const phone = await screen.findByLabelText('Số điện thoại liên hệ')
    const name = screen.getByLabelText('Người phụ trách')
    await waitFor(() => expect((phone as HTMLInputElement).value).toBe('0909999999'))
    expect((name as HTMLInputElement).value).toBe('Tên cũ')
    await user.clear(phone)
    await user.type(phone, '0901 234 567')
    await user.clear(name)
    await user.type(name, 'Lê Thị Sương')
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/toi/ho-so-ntd', {
        method: 'PUT',
        body: expect.any(String),
      }),
    )
    const call = vi.mocked(apiFetch).mock.calls.find(([path]) => path === '/api/toi/ho-so-ntd')!
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({
      contactName: 'Lê Thị Sương',
      phone: '0901234567',
      website: null,
    })
    client.clear()
  })
})
