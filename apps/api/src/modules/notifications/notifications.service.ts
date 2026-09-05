import type { Prisma } from '@prisma/client'
import type {
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationItem,
  NotificationListResponse,
  NotificationType,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>

function toNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Ghi thông báo, LUÔN trong transaction của nghiệp vụ sinh ra nó.
 *
 * ---------------------------------------------------------------------------
 * KHÔNG có nhánh thoát khi thiếu delegate — và đó là chủ đích
 * ---------------------------------------------------------------------------
 * Bản đầu có một nhánh `if (!tx.notification) return {objectGiả}` để các test cũ
 * mock Prisma thiếu bảng này vẫn chạy. Nhưng nó là mã PRODUCTION bị bẻ cong để
 * chiều mock, và hệ quả rộng hơn hẳn ý định:
 *
 *   client Prisma lệch schema → mọi thông báo bị NUỐT IM LẶNG
 *   → ứng tuyển vẫn trả 201, nhà tuyển dụng không bao giờ biết có đơn
 *   → không lỗi, không log, hàm còn trả về `id: ''` như thể đã ghi
 *
 * Thiếu delegate là hỏng cấu hình. Hỏng thì phải NỔ ngay lúc chạy, không phải
 * âm thầm bỏ việc rồi báo thành công. Test thiếu mock thì sửa test.
 */
export async function createNotification(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    type: NotificationType
    title: string
    body: string
    link?: string | null
  },
): Promise<NotificationItem> {
  const row = await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    },
    select: NOTIFICATION_SELECT,
  })
  return toNotificationItem(row)
}

export async function listNotifications(userId: string): Promise<NotificationListResponse> {
  const [rows, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  return {
    notifications: rows.map(toNotificationItem),
    unreadCount,
  }
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<MarkNotificationReadResponse> {
  /*
   * MỘT truy vấn, không phải ba.
   *
   * Bản đầu làm `findUnique` → `updateMany` → `findUniqueOrThrow`. Ngoài chuyện
   * tốn ba lượt, nó còn có khe đua: giữa lúc kiểm chủ sở hữu và lúc ghi, hàng có
   * thể bị xoá — rồi `findUniqueOrThrow` ném một lỗi 500 thay vì 404.
   *
   * Lọc kèm `userId` ngay trong `where` thì quyền và phép ghi là CÙNG một thao
   * tác nguyên tử: không khớp thì không có hàng nào đổi, và không có khoảnh khắc
   * nào ở giữa để chen vào.
   *
   * `readAt` chỉ đặt khi còn `null` — bấm lại một thông báo đã đọc không được
   * dời mốc đọc sang thời điểm mới.
   */
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  })

  const row = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: NOTIFICATION_SELECT,
  })

  /*
   * Không tách 403 khỏi 404 ở đây: id thông báo là cuid không đoán được và không
   * hiện công khai ở đâu, nên trả 403 cho thông báo của người khác chính là xác
   * nhận nó tồn tại. Khác hẳn tin tuyển dụng, nơi id nằm sẵn trên URL nên 403 mới
   * là câu trả lời đúng.
   */
  if (!row) throw notFound('Không tìm thấy thông báo')

  return { notification: toNotificationItem(row) }
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<MarkAllNotificationsReadResponse> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count }
}
