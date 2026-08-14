import type { SkillResponse } from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'

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
