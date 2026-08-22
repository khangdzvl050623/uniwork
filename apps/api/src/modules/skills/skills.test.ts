import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/token.js'
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
  prisma: {
    skill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

/**
 * Ép kiểu vì Prisma khai báo `findMany` trả về đủ mọi cột của bảng, kể cả
 * `createdAt`. Service lại thu hẹp bằng `select` nên chỉ còn ba cột — dữ liệu
 * giả ở đây khớp với cái service thật sự trả ra, không phải với cả dòng trong
 * database.
 */
const findMany = prisma.skill.findMany as unknown as Mock
const findFirst = prisma.skill.findFirst as unknown as Mock
const findUnique = prisma.skill.findUnique as unknown as Mock
const create = prisma.skill.create as unknown as Mock
const update = prisma.skill.update as unknown as Mock
const del = prisma.skill.delete as unknown as Mock

const KY_NANG_MAU = [
  { id: 'c1', name: 'Bán hàng', slug: 'ban-hang' },
  { id: 'c2', name: 'Pha chế', slug: 'pha-che' },
]

const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN' })
const studentToken = signAccessToken({ sub: 'u-1', role: 'STUDENT' })

beforeEach(() => {
  vi.clearAllMocks()
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

/* ----------------------------------------------- T67 — quản trị danh mục -- */

describe('GET /api/admin/ky-nang', () => {
  it('trả kèm CẢ HAI con số đếm, không phải mỗi số tin', async () => {
    findMany.mockResolvedValue([
      { id: 'c1', name: 'Pha chế', slug: 'pha-che', _count: { jobs: 3, students: 12 } },
    ])

    const res = await request(createApp())
      .get('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.skills[0]).toEqual({
      id: 'c1',
      name: 'Pha chế',
      slug: 'pha-che',
      jobCount: 3,
      studentCount: 12,
    })
  })

  it('sinh viên gọi vào thì 403', async () => {
    const res = await request(createApp())
      .get('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(403)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('chưa đăng nhập thì 401', async () => {
    const res = await request(createApp()).get('/api/admin/ky-nang')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/admin/ky-nang', () => {
  it('sinh slug không dấu từ tên tiếng Việt', async () => {
    findFirst.mockResolvedValue(null)
    create.mockResolvedValue({ id: 'c9', name: 'Pha chế cơ bản', slug: 'pha-che-co-ban' })

    const res = await request(createApp())
      .post('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Pha chế cơ bản' })

    expect(res.status).toBe(201)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Pha chế cơ bản', slug: 'pha-che-co-ban' } }),
    )
    // Vừa tạo thì chưa ai dùng — không tốn thêm một câu đếm để biết điều đó.
    expect(res.body.data).toMatchObject({ jobCount: 0, studentCount: 0 })
  })

  it('chữ Đ ra "d", không rơi vào nhánh xoá ký tự lạ', async () => {
    // `normalize('NFD')` KHÔNG tách được đ/Đ vì chúng là chữ cái riêng, không
    // phải d + dấu. Thiếu bước thay riêng thì "Đầu bếp" ra slug "-u-bp".
    findFirst.mockResolvedValue(null)
    create.mockResolvedValue({ id: 'c10', name: 'Đầu bếp', slug: 'dau-bep' })

    await request(createApp())
      .post('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Đầu bếp' })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Đầu bếp', slug: 'dau-bep' } }),
    )
  })

  it('trùng tên hoặc trùng slug thì 409, không ghi gì', async () => {
    findFirst.mockResolvedValue({ name: 'Pha chế' })

    const res = await request(createApp())
      .post('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Pha chế' })

    expect(res.status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })

  it('tên toàn ký tự đặc biệt bị chặn — Zod đếm ký tự, không biết slug rỗng', async () => {
    const res = await request(createApp())
      .post('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '!!!???' })

    expect(res.status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })

  it('tên toàn khoảng trắng bị chặn ở Zod trước khi chạm database', async () => {
    const res = await request(createApp())
      .post('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '     ' })

    expect(res.status).toBe(400)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('sinh viên không thêm được kỹ năng', async () => {
    const res = await request(createApp())
      .post('/api/admin/ky-nang')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Kỹ năng lạ' })

    expect(res.status).toBe(403)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/ky-nang/:id', () => {
  it('đổi tên KHÔNG đổi slug — slug là khoá tra cứu ổn định', async () => {
    /*
     * Đây là hành vi dễ bị "sửa cho hợp lý" nhất ở module này: đổi tên thì đổi
     * slug theo nghe rất xuôi tai. Nhưng tin tuyển dụng tham chiếu kỹ năng bằng
     * slug, và link lọc /viec-lam?skill=pha-che đã phát ra ngoài — đổi slug là
     * làm chết hết những link đó.
     */
    findUnique.mockResolvedValue({ id: 'c1', slug: 'pha-che' })
    findFirst.mockResolvedValue(null)
    update.mockResolvedValue({
      id: 'c1',
      name: 'Pha chế đồ uống',
      slug: 'pha-che',
      _count: { jobs: 2, students: 5 },
    })

    const res = await request(createApp())
      .put('/api/admin/ky-nang/c1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Pha chế đồ uống' })

    expect(res.status).toBe(200)
    expect(res.body.data.slug).toBe('pha-che')
    // Chỉ ghi `name`. Có `slug` trong `data` là hỏng đúng điều đang bảo vệ.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: { name: 'Pha chế đồ uống' } }),
    )
  })

  it('đổi trùng tên kỹ năng khác thì 409', async () => {
    findUnique.mockResolvedValue({ id: 'c1', slug: 'pha-che' })
    findFirst.mockResolvedValue({ id: 'c2' })

    const res = await request(createApp())
      .put('/api/admin/ky-nang/c1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bán hàng' })

    expect(res.status).toBe(409)
    expect(update).not.toHaveBeenCalled()
  })

  it('kỹ năng không tồn tại thì 404', async () => {
    findUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .put('/api/admin/ky-nang/khong-co')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tên mới' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/ky-nang/:id', () => {
  it('xoá được khi không ai dùng', async () => {
    findUnique.mockResolvedValue({ name: 'Kỹ năng thừa', _count: { jobs: 0, students: 0 } })

    const res = await request(createApp())
      .delete('/api/admin/ky-nang/c9')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    // Trả `{ id }` chứ không phải 204 rỗng: apiFetch phía web gọi
    // response.json() vô điều kiện, 204 sẽ thành lỗi "không đọc được".
    expect(res.body.data).toEqual({ id: 'c9' })
    expect(del).toHaveBeenCalledWith({ where: { id: 'c9' } })
  })

  it('còn TIN dùng thì 409, nói rõ còn bao nhiêu', async () => {
    findUnique.mockResolvedValue({ name: 'Pha chế', _count: { jobs: 3, students: 0 } })

    const res = await request(createApp())
      .delete('/api/admin/ky-nang/c1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('3 tin tuyển dụng')
    expect(del).not.toHaveBeenCalled()
  })

  it('còn SINH VIÊN khai thì cũng chặn — không chỉ đếm mỗi tin', async () => {
    /*
     * `StudentSkill` cũng tham chiếu Skill với onDelete: Restrict. Chỉ kiểm
     * jobs thì admin thấy "0 tin", bấm xoá, rồi nhận lỗi khoá ngoại thô của
     * Postgres mà không hiểu vì sao.
     */
    findUnique.mockResolvedValue({ name: 'Gia sư', _count: { jobs: 0, students: 7 } })

    const res = await request(createApp())
      .delete('/api/admin/ky-nang/c5')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('7 hồ sơ sinh viên')
    expect(del).not.toHaveBeenCalled()
  })

  it('cả hai bên cùng dùng thì báo cả hai', async () => {
    findUnique.mockResolvedValue({ name: 'Giao tiếp', _count: { jobs: 4, students: 20 } })

    const res = await request(createApp())
      .delete('/api/admin/ky-nang/c2')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.body.error.message).toContain('4 tin tuyển dụng')
    expect(res.body.error.message).toContain('20 hồ sơ sinh viên')
  })

  it('kỹ năng không tồn tại thì 404', async () => {
    findUnique.mockResolvedValue(null)

    const res = await request(createApp())
      .delete('/api/admin/ky-nang/khong-co')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
  })

  it('sinh viên không xoá được kỹ năng nào', async () => {
    const res = await request(createApp())
      .delete('/api/admin/ky-nang/c1')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(403)
    expect(del).not.toHaveBeenCalled()
  })
})
