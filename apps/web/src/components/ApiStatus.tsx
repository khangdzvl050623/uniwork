import { useHealth } from '@/hooks/useHealth'
import { cn } from '@/lib/utils'

/**
 * Chấm tròn nhỏ báo trạng thái backend.
 *
 * Đặt ở footer thay vì giữa trang: người dùng bình thường không cần quan tâm,
 * nhưng lúc phát triển và lúc demo thì cần biết ngay web đang nói chuyện được
 * với API hay không — thay vì mở tab Network ra soi.
 */
export function ApiStatus() {
  const { data, isPending, isError } = useHealth()

  const state = isPending
    ? { dot: 'bg-amber-400', text: 'Đang kết nối máy chủ…' }
    : isError
      ? { dot: 'bg-rose-500', text: 'Không kết nối được máy chủ' }
      : { dot: 'bg-brand-500', text: `Máy chủ hoạt động · v${data.version}` }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className={cn('h-2 w-2 rounded-full', state.dot)} />
      {state.text}
    </span>
  )
}
