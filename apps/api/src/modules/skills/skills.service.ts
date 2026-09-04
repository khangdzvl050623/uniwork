import { taoSlug, type AdminSkillResponse, type SkillResponse } from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { conflict, notFound } from '../../lib/errors.js'

/**
 * Đọc toàn bộ danh mục kỹ năng.
 *
 * Không phân trang, và đó là chủ đích: danh mục này do admin quản lý, chỉ có
 * khoảng vài chục dòng và cả tháng mới đổi một lần. Web tải một lần rồi dựng
 * bộ lọc từ đó. Phân trang một danh sách như vậy chỉ làm phía web phức tạp hơn
 * mà không giải quyết vấn đề nào có thật.
 *
 * `select` liệt kê tường minh thay vì lấy hết cột. Nhờ vậy sau này thêm cột vào
 * bảng — ví dụ ghi chú nội bộ của admin — nó sẽ không tự động lọt ra API.
 */
export async function listSkills(): Promise<SkillResponse[]> {
  return prisma.skill.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })
}

/* ----------------------------------------------------- quản trị danh mục -- */

/**
 * Danh sách kèm số lượt đang được dùng, cho màn hình quản trị.
 *
 * `_count` đếm ngay trong cùng một câu truy vấn. Lấy danh sách rồi đếm từng
 * kỹ năng một là N+1 câu — với danh mục vài chục dòng thì vẫn chạy, nhưng đó
 * là kiểu chậm âm thầm, không ai nhận ra cho tới lúc danh mục dài ra.
 */
export async function listSkillsForAdmin(): Promise<AdminSkillResponse[]> {
  const rows = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { jobs: true, students: true } },
    },
    orderBy: { name: 'asc' },
  })

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    jobCount: s._count.jobs,
    studentCount: s._count.students,
  }))
}

/**
 * Thêm một kỹ năng vào danh mục.
 *
 * Slug do server sinh, không nhận từ client — để hai kỹ năng tên khác nhau
 * không thể cùng slug do người nhập tự đặt trùng.
 *
 * Kiểm trùng thủ công TRƯỚC khi ghi, dù `name` và `slug` đều đã `@unique` ở
 * database. Lý do: ràng buộc unique bắn ra lỗi P2002 của Prisma, để nó lọt lên
 * middleware lỗi thì người dùng nhận về một thông báo 500 khó hiểu. Kiểm trước
 * cho ra `CONFLICT` kèm câu tiếng Việt nói đúng chuyện gì xảy ra. Ràng buộc ở
 * database vẫn giữ nguyên vai trò lớp cuối — hai request tạo cùng lúc thì chỉ
 * nó chặn được.
 */
export async function createSkill(name: string): Promise<AdminSkillResponse> {
  const slug = taoSlug(name)

  /*
   * Chặn luôn trường hợp tên có ký tự nhưng slug rỗng — ví dụ tên toàn ký tự
   * đặc biệt như "!!!" hay một chuỗi emoji. Zod đã chặn chuỗi quá ngắn, nhưng
   * nó đếm ký tự chứ không biết ký tự nào sống sót qua bước tạo slug.
   */
  if (!slug) {
    throw conflict('Tên kỹ năng phải có ít nhất một chữ cái hoặc chữ số')
  }

  const trung = await prisma.skill.findFirst({
    where: { OR: [{ name }, { slug }] },
    select: { name: true },
  })
  if (trung) throw conflict(`Kỹ năng "${trung.name}" đã có trong danh mục`)

  const created = await prisma.skill.create({
    data: { name, slug },
    select: { id: true, name: true, slug: true },
  })

  // Vừa tạo nên chắc chắn chưa ai dùng — khỏi cần một câu đếm nữa.
  return { ...created, jobCount: 0, studentCount: 0 }
}

/**
 * Đổi TÊN HIỂN THỊ của một kỹ năng. Slug giữ nguyên.
 *
 * Đây là điểm dễ làm sai nhất ở đây: nhìn qua thì "đổi tên thì đổi slug theo
 * cho khớp" nghe hợp lý. Nhưng slug là khoá tra cứu ổn định — tin tuyển dụng
 * tham chiếu nó, và link lọc `/viec-lam?skill=pha-che` đã phát ra ngoài. Đổi
 * slug là làm chết hết những link đó, đổi lại chỉ được một chuỗi đẹp hơn mà
 * gần như không ai nhìn.
 *
 * Ghi chú này lặp lại điều đã viết trong `prisma/seed.ts` từ Sprint 0, cố ý:
 * người sửa file này sẽ không mở seed.ts ra đọc.
 */
export async function updateSkill(id: string, name: string): Promise<AdminSkillResponse> {
  const hienTai = await prisma.skill.findUnique({
    where: { id },
    select: { id: true, slug: true },
  })
  if (!hienTai) throw notFound('Không tìm thấy kỹ năng')

  const trungTen = await prisma.skill.findFirst({
    where: { name, NOT: { id } },
    select: { id: true },
  })
  if (trungTen) throw conflict(`Đã có kỹ năng khác tên "${name}"`)

  const updated = await prisma.skill.update({
    where: { id },
    data: { name },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { jobs: true, students: true } },
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    jobCount: updated._count.jobs,
    studentCount: updated._count.students,
  }
}

/**
 * Xoá một kỹ năng khỏi danh mục.
 *
 * Kiểm số lượt đang dùng rồi mới xoá, thay vì để `onDelete: Restrict` của
 * Postgres bắn lỗi lên. Hai lý do:
 *
 * 1. Lỗi ràng buộc khoá ngoại của Postgres đi qua Prisma thành P2003 với câu
 *    chữ về tên constraint — vô nghĩa với người dùng cuối.
 * 2. Cần nói rõ VÌ SAO không xoá được và còn bao nhiêu chỗ đang dùng, để admin
 *    biết phải gỡ ở đâu trước.
 *
 * `Restrict` ở schema vẫn là lớp phòng thủ cuối, không bỏ đi: hai request xoá
 * và ứng tuyển chạy song song thì chỉ nó chặn được.
 */
export async function deleteSkill(id: string): Promise<void> {
  const skill = await prisma.skill.findUnique({
    where: { id },
    select: { name: true, _count: { select: { jobs: true, students: true } } },
  })
  if (!skill) throw notFound('Không tìm thấy kỹ năng')

  const { jobs, students } = skill._count
  if (jobs > 0 || students > 0) {
    const dangDung = [
      jobs > 0 ? `${jobs} tin tuyển dụng` : null,
      students > 0 ? `${students} hồ sơ sinh viên` : null,
    ]
      .filter(Boolean)
      .join(' và ')

    throw conflict(
      `Không xoá được "${skill.name}": đang có ${dangDung} dùng kỹ năng này. ` +
        'Đổi tên kỹ năng nếu muốn gộp, thay vì xoá.',
    )
  }

  await prisma.skill.delete({ where: { id } })
}
