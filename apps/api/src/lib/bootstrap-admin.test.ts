import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

/**
 * Test cho việc tự tạo admin lúc khởi động.
 *
 * Ca quan trọng nhất ở đây không phải "tạo được" — mà là "KHÔNG BAO GIỜ cập
 * nhật khi đã có". Render khởi động lại service ở rất nhiều tình huống (ngủ
 * dậy, deploy, sập rồi tự phục hồi); nếu hàm này lỡ cập nhật mật khẩu mỗi lần
 * chạy, việc đầu tiên admin làm sau khi đăng nhập — đổi mật khẩu — sẽ bị xoá
 * sạch ở lần khởi động kế tiếp mà không một dòng log nào giải thích vì sao.
 */
vi.mock('../config/env.js', () => ({
  env: { ADMIN_EMAIL: 'AdminUniWork@gmail.com', ADMIN_PASSWORD: 'admin@123' },
}))

vi.mock('./prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('./logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const { taoAdminMacDinhNeuChua } = await import('./bootstrap-admin.js')
const { prisma } = await import('./prisma.js')

const userFindUnique = prisma.user.findUnique as unknown as Mock
const userCreate = prisma.user.create as unknown as Mock

beforeEach(() => {
  vi.clearAllMocks()
})

describe('taoAdminMacDinhNeuChua', () => {
  it('chưa có ai với email đó: tạo tài khoản ADMIN mới', async () => {
    userFindUnique.mockResolvedValue(null)
    userCreate.mockResolvedValue({ id: 'u-1' })

    await taoAdminMacDinhNeuChua()

    expect(userCreate).toHaveBeenCalledOnce()
    const data = userCreate.mock.calls[0][0].data
    expect(data.email).toBe('adminuniwork@gmail.com')
    expect(data.role).toBe('ADMIN')
    // Không xác thực email qua OTP — tài khoản do chính hệ thống tạo, không
    // phải một người lạ tự đăng ký.
    expect(data.emailVerifiedAt).toBeInstanceOf(Date)
    // Mật khẩu phải được BĂM, không phải chuỗi gốc 'admin@123' nằm trần trong DB.
    expect(data.passwordHash).not.toBe('admin@123')
    expect(typeof data.passwordHash).toBe('string')
  })

  it('email so khớp KHÔNG phân biệt hoa thường trước khi tra cứu', async () => {
    userFindUnique.mockResolvedValue(null)
    userCreate.mockResolvedValue({ id: 'u-1' })

    await taoAdminMacDinhNeuChua()

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: 'adminuniwork@gmail.com' },
      select: { id: true },
    })
  })

  it('ĐÃ CÓ tài khoản với email đó: dừng ngay, không gọi create — dù mật khẩu có bị đổi trước đó', async () => {
    userFindUnique.mockResolvedValue({ id: 'u-1-da-ton-tai' })

    await taoAdminMacDinhNeuChua()

    expect(userCreate).not.toHaveBeenCalled()
  })
})
