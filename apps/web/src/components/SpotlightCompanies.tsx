import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Brand {
  name: string
  initial: string
  /** Class nền Tailwind, ví dụ 'bg-amber-500'. Dùng luôn làm màu nền thẻ nổi bật. */
  color: string
  tag: string
  jobs: number
}

/** Số mili giây giữa hai lần tự đổi công ty nổi bật. */
const ROTATE_MS = 5000

/**
 * Khối "Nhà tuyển dụng nổi bật": một thẻ lớn bên trái, lưới thẻ nhỏ bên phải.
 *
 * Vị trí nổi bật này về sau là chỗ bán — nhà tuyển dụng trả phí để được đưa lên
 * đây. Nên nó nhận cả danh sách rồi tự xoay vòng: khi có nhiều bên cùng mua, ai
 * cũng được hiện, không phải chọn một người duy nhất.
 *
 * Khác một điểm so với các trang tuyển dụng khác: lưới bên phải KHÔNG đổi nội
 * dung mỗi lần xoay. Nếu để nó đổi theo, cả khối nhấp nháy liên tục và mắt
 * người đọc bị kéo đi mất. Ở đây lưới đứng yên, chỉ có viền sáng chạy từ thẻ
 * này sang thẻ khác — đủ để thấy có gì đang chuyển động mà không gây rối.
 */
export function SpotlightCompanies({ brands }: { brands: Brand[] }) {
  const [active, setActive] = useState(0)
  const paused = useRef(false)

  useEffect(() => {
    if (brands.length < 2) return

    // Người bật giảm chuyển động thì không tự xoay. Với họ, một khối tự đổi sau
    // lưng khi đang đọc gây khó chịu hơn là đẹp — vẫn bấm mũi tên xem được.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => {
      if (paused.current) return
      setActive((i) => (i + 1) % brands.length)
    }, ROTATE_MS)

    return () => clearInterval(id)
  }, [brands.length])

  const go = (delta: number) => setActive((i) => (i + delta + brands.length) % brands.length)

  const spotlight = brands[active]
  if (!spotlight) return null

  return (
    <div
      // Dừng xoay khi con trỏ đang ở trong khối. Đang đọc dở một thẻ mà nó tự
      // nhảy sang thẻ khác là kiểu khó chịu rất dễ gặp ở carousel.
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
    >
      <SpotlightCard brand={spotlight} />

      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b, i) => (
            <button
              key={b.name}
              onClick={() => setActive(i)}
              className={cn(
                'card-lift flex items-center gap-3 rounded-xl border p-3 text-left',
                i === active
                  ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/20'
                  : 'border-slate-200 hover:border-brand-300',
              )}
            >
              <span
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-lg text-base font-bold text-white',
                  b.color,
                )}
              >
                {b.initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{b.name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Briefcase size={12} />
                  {b.jobs} tin
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          {/* Chấm chỉ vị trí: cho biết có bao nhiêu công ty và đang tới đâu. */}
          <div className="flex gap-1.5">
            {brands.map((b, i) => (
              <button
                key={b.name}
                onClick={() => setActive(i)}
                aria-label={`Xem ${b.name}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === active ? 'w-5 bg-brand-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400',
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => go(-1)}
              aria-label="Công ty trước"
              className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Công ty tiếp theo"
              className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpotlightCard({ brand }: { brand: Brand }) {
  return (
    <div
      // key ép React dựng lại nút này mỗi lần đổi công ty, nhờ vậy hoạt ảnh
      // fade-in chạy lại từ đầu. Không có key thì React tái sử dụng DOM cũ và
      // chỉ thay chữ, nhìn như nội dung bị "nhảy" chứ không phải chuyển cảnh.
      key={brand.name}
      className={cn(
        'spotlight-in relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 text-white',
        brand.color,
      )}
    >
      {/* Lớp phủ tối dần từ dưới lên, để chữ trắng luôn đọc được dù nền màu gì. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

      <div className="relative">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/30">
          <Sparkles size={12} />
          Nhà tuyển dụng nổi bật
        </span>
      </div>

      <div className="relative mt-8">
        <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/95 text-2xl font-extrabold text-slate-900">
          {brand.initial}
        </div>
        <h3 className="mt-4 text-xl font-bold leading-snug">{brand.name}</h3>
        <p className="mt-1 text-sm text-white/80">{brand.tag}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            to="/viec-lam"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-white/90"
          >
            <Briefcase size={14} />
            {brand.jobs} tin đang tuyển
          </Link>
          <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-white/45 transition-colors hover:bg-white/15">
            <Plus size={14} />
            Theo dõi
          </button>
        </div>
      </div>
    </div>
  )
}
