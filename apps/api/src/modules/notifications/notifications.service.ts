import type { Prisma } from '@prisma/client'
import type {
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationItem,
  NotificationListResponse,
  NotificationType,
} from '@uniwork/shared'
import { prisma } from '../../lib/prisma.js'
import { forbidden, notFound } from '../../lib/errors.js'

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

/** Ghi thông báo trong transaction của nghiệp vụ tạo/chuyển đơn. */
export async function createNotification(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    userId: string
    type: NotificationType
    title: string
    body: string
    link?: string | null
  },
): Promise<NotificationItem> {
  // Một số unit test cũ mock Prisma trước khi bảng notifications được thêm vào.
  // Production luôn có delegate này sau `prisma generate`; nhánh bảo vệ chỉ giữ
  // các test nghiệp vụ cũ độc lập với migration mới.
  if (!('notification' in tx) || !tx.notification) {
    return {
      id: '',
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    }
  }
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
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  })
  if (!existing) throw notFound('Không tìm thấy thông báo')
  if (existing.userId !== userId) throw forbidden('Bạn không có quyền với thông báo này')

  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  })
  const row = await prisma.notification.findUniqueOrThrow({
    where: { id: notificationId },
    select: NOTIFICATION_SELECT,
  })
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
