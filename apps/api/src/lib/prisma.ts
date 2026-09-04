import { PrismaClient } from '@prisma/client'
import { isProduction } from '../config/env.js'

/**
 * Một PrismaClient duy nhất dùng chung cho cả app.
 *
 * Mỗi lần gọi `new PrismaClient()` là mở thêm một pool kết nối tới Postgres.
 * Trong lúc phát triển, `tsx watch` nạp lại module mỗi khi bạn lưu file — nếu
 * không giữ lại instance cũ thì sau vài chục lần lưu, Neon báo hết hạn mức kết
 * nối và app chết, trong khi code chẳng có dòng nào sai. Lỗi này rất khó đoán
 * vì nó không liên quan gì tới thứ bạn vừa sửa.
 *
 * Phải gắn vào `globalThis` chứ không để biến thường: biến ở phạm vi module bị
 * xoá sạch sau mỗi lần nạp lại, còn globalThis thì sống sót.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Ở production chỉ ghi lỗi. Bật 'query' trên Render sẽ đổ toàn bộ câu SQL
    // vào log — vừa ngập log vừa lộ dữ liệu người dùng nằm trong tham số truy vấn.
    log: isProduction ? ['error'] : ['warn', 'error'],
  })

if (!isProduction) {
  globalForPrisma.prisma = prisma
}
