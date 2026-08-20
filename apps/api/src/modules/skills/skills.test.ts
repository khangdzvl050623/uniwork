import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { listSkills } from './skills.service.js'

/**
 * Test giả lập Prisma thay vì gọi database thật.
 *
 * Lý do: test phải chạy được trên CI, nơi không có Postgres nào đang chạy. Nếu
 * test cần database, mỗi PR sẽ đỏ vì lý do chẳng liên quan gì tới code trong PR
 * đó — và người ta sẽ nhanh chóng học được thói quen bỏ qua CI đỏ.
 *
 * Đổi lại, những test này KHÔNG bắt được lỗi sai câu truy vấn hay lệch schema.
 * Loại đó cần database thật; sẽ thêm ở Sprint 1 khi CI có service Postgres.
 */
vi.mock('../../lib/prisma.js', () => ({
  prisma: { skill: { findMany: vi.fn() } },
}))

/**
 * Ép kiểu vì Prisma khai báo `findMany` trả về đủ mọi cột của bảng, kể cả
 * `createdAt`. Service lại thu hẹp bằng `select` nên chỉ còn ba cột — dữ liệu
 * giả ở đây khớp với cái service thật sự trả ra, không phải với cả dòng trong
 * database.
 */
const findMany = prisma.skill.findMany as unknown as Mock

const KY_NANG_MAU = [
  { id: 'c1', name: 'Bán hàng', slug: 'ban-hang' },
  { id: 'c2', name: 'Pha chế', slug: 'pha-che' },
]

beforeEach(() => {
  findMany.mockReset()
})

describe('skills service', () => {
  it('chỉ lấy đúng ba cột công khai, sắp xếp theo tên', async () => {
    findMany.mockResolvedValue(KY_NANG_MAU)

    const result = await listSkills()

    expect(result).toEqual(KY_NANG_MAU)
    // Khoá chặt hình dạng truy vấn: nếu sau này ai đó đổi sang lấy hết cột,
    // test này đỏ trước khi cột nội bộ kịp lọt ra API.
    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })
  })
})

describe('GET /api/skills', () => {
  it('trả 200 kèm danh sách trong vỏ ApiSuccess', async () => {
    findMany.mockResolvedValue(KY_NANG_MAU)

    const response = await request(createApp()).get('/api/skills')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, data: KY_NANG_MAU })
  })

  it('trả mảng rỗng chứ không phải 404 khi danh mục chưa có gì', async () => {
    findMany.mockResolvedValue([])

    const response = await request(createApp()).get('/api/skills')

    // Danh sách rỗng là câu trả lời hợp lệ, không phải lỗi. Trả 404 ở đây sẽ
    // khiến phía web phải xử lý một nhánh lỗi cho tình huống hoàn toàn bình thường.
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, data: [] })
  })

  it('database sập thì trả 500 chứ không treo request', async () => {
    findMany.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'))

    const response = await request(createApp()).get('/api/skills')

    // Điều đang kiểm: Express 5 tự chuyển promise bị reject tới middleware lỗi.
    // Ở Express 4, controller async không bọc try/catch sẽ để request treo tới
    // khi timeout — trình duyệt quay vòng vô tận, log không có gì.
    //
    // Không kiểm nội dung `message` ở đây: ngoài production, middleware cố ý
    // trả nguyên văn lỗi để lập trình viên nhìn thấy ngay. Phần giấu lỗi khi
    // chạy production được kiểm riêng ở error-handler.test.ts.
    expect(response.status).toBe(500)
    expect(response.body.ok).toBe(false)
    expect(response.body.error.code).toBe('INTERNAL_ERROR')
  })
})
