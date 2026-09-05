import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const { data } = useNotifications(enabled)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const notifications = data?.notifications ?? []

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-md p-2 text-white transition-colors hover:bg-white/10"
      >
        <Bell size={18} />
        {!!data?.unreadCount && (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {data.unreadCount > 9 ? '9+' : data.unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1.5">
            <strong className="text-sm">Thông báo</strong>
            {!!data?.unreadCount && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">Chưa có thông báo.</p>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.link ?? '/don-ung-tuyen'}
                  onClick={() => {
                    if (!notification.readAt) markRead.mutate(notification.id)
                    setOpen(false)
                  }}
                  className={`block rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                    notification.readAt ? '' : 'bg-brand-50/70'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.readAt && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    )}
                    <div className={notification.readAt ? 'pl-4' : undefined}>
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">{notification.body}</p>
                      <time className="mt-1 block text-[11px] text-slate-400">
                        {new Date(notification.createdAt).toLocaleString('vi-VN')}
                      </time>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
