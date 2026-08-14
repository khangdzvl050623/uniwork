import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-bold text-brand-200">404</p>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-slate-500">
        Trang bạn tìm có thể đã bị gỡ hoặc đường dẫn không đúng.
      </p>
      <Link to="/" className="mt-6 inline-block">
        <Button size="lg">Về trang chủ</Button>
      </Link>
    </div>
  )
}
