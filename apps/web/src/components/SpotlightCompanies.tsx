import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Check, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Brand {
  name: string
  initial: string
  /** Class nền Tailwind, ví dụ 'bg-amber-500'. Dùng luôn làm nền thẻ nổi bật. */
  color: string
  tag: string
  jobs: number
}

/**
 * Số mili giây giữa hai lần đổi thương hiệu nổi bật.
 *
 * 8 giây chứ không phải 3–4 như carousel quảng cáo thường thấy: thẻ này có tên
 * công ty, ngành nghề và số tin: người đọc cần đủ thời gian đọc hết rồi mới
 * quyết định có bấm hay không. Đổi quá nhanh thì không ai kịp đọc, và khối này
 * chỉ còn là thứ nhấp nháy gây phân tâm.
 */
const ROTATE_MS = 8000

/**
 * Khối "Thương hiệu tiêu biểu": một thẻ lớn bên trái, lưới thẻ nhỏ bên phải.
 *
 * Vị trí thẻ lớn về sau là chỗ bán — doanh nghiệp trả phí để được đưa lên đây.
 * Nên component nhận cả danh sách rồi tự xoay vòng: khi có nhiều bên cùng mua,
 * ai cũng được hiện, không phải chọn một người duy nhất.
 *
 * Lưới bên phải KHÔNG đổi nội dung mỗi lần xoay. Để nó đổi theo thì cả khối
 * nhấp nháy và mắt người đọc bị kéo đi; ở đây lưới đứng yên, chỉ có viền sáng
 * chạy từ thẻ này sang thẻ khác.
 */
export function SpotlightCompanies({ brands, tabs }: { brands: Brand[]; tabs: string[] }) {
  const [active, setActive] = useState(0)
  const [tab, setTab] = useState(0)
  const [paused, setPaused] = useState(false)
  const [followed, setFollowed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (brands.length < 2 || paused) return

    // CỐ TÌNH vẫn xoay khi người dùng bật giảm chuyển động.
    //
    // Yêu cầu đó nói về hiệu ứng chuyển cảnh, không phải về việc nội dung được
    // thay. Dừng hẳn thì người đó chỉ nhìn thấy mãi một thương hiệu — mà đây là
    // vị trí trả phí, mọi bên đã mua đều phải được hiện.
    //
    // Phần hiệu ứng do CSS lo: khối @media prefers-reduced-motion trong
    // index.css tắt hết animation, nên nội dung đổi tức thì thay vì trôi mượt.
    const id = setInterval(() => setActive((i) => (i + 1) % brands.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [brands.length, paused, active])

  const go = (delta: number) => setActive((i) => (i + delta + brands.length) % brands.length)

  const toggleFollow = (name: string) =>
    setFollowed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const spotlight = brands[active]
  if (!spotlight) return null

  return (
    <div
      // Dừng xoay khi con trỏ ở trong khối. Đang đọc dở một thẻ mà nó tự nhảy
      // sang thẻ khác là kiểu khó chịu rất dễ gặp ở carousel.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <BannerHeader brands={brands} />

      <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-white p-4">
        {/* ------------------------------------------------------ TAB NGÀNH */}
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                tab === i
                  ? 'border-accent-500 bg-accent-500 text-white shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:border-accent-400 hover:text-accent-600',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          {/* Track trượt ngang, cùng nguyên lý với slick-slider.
              Mọi thẻ nằm cạnh nhau trên một hàng dài; đổi thương hiệu là dịch
              cả hàng sang trái đúng một bề rộng thẻ. Khung ngoài overflow-hidden
              nên chỉ thấy đúng một thẻ tại mỗi thời điểm.

              Cách này hơn kiểu mờ-dần-tại-chỗ ở một điểm: chuyển động có hướng,
              người xem hiểu ngay là đang sang thẻ kế tiếp chứ không phải nội
              dung tự nhiên đổi. */}
          <div className="relative overflow-hidden rounded-xl">
            <div
              className="slide-track flex"
              style={{ transform: `translate3d(-${active * 100}%, 0, 0)` }}
            >
              {brands.map((b) => (
                <div key={b.name} className="w-full shrink-0">
                  <SpotlightCard
                    brand={b}
                    following={followed.has(b.name)}
                    onFollow={() => toggleFollow(b.name)}
                  />
                </div>
              ))}
            </div>

            {/* Thanh tiến trình nằm NGOÀI track nên nó đứng yên khi track trượt.
                key={active} ép React dựng lại mỗi lần đổi thẻ, nhờ vậy hoạt ảnh
                chạy lại từ 0 thay vì tiếp tục từ chỗ dở. */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div
                key={active}
                className={cn('progress-fill h-full bg-accent-400', paused && 'is-paused')}
                style={{ animationDuration: `${ROTATE_MS}ms` }}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="grid gap-3 sm:grid-cols-2">
              {brands.map((b, i) => (
                <BrandCard
                  key={b.name}
                  brand={b}
                  active={i === active}
                  following={followed.has(b.name)}
                  onSelect={() => setActive(i)}
                  onFollow={() => toggleFollow(b.name)}
                />
              ))}
            </div>

            <div className="mt-auto flex items-center justify-between pt-4">
              {/* Chấm chỉ vị trí: cho biết có bao nhiêu thương hiệu, đang tới đâu. */}
              <div className="flex gap-1.5">
                {brands.map((b, i) => (
                  <button
                    key={b.name}
                    onClick={() => setActive(i)}
                    aria-label={`Xem ${b.name}`}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i === active ? 'w-6 bg-accent-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400',
                    )}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <ArrowButton label="Thương hiệu trước" onClick={() => go(-1)}>
                  <ChevronLeft size={16} />
                </ArrowButton>
                <ArrowButton label="Thương hiệu tiếp theo" onClick={() => go(1)}>
                  <ChevronRight size={16} />
                </ArrowButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Băng đầu khối.
 *
 * Nền dựng hoàn toàn bằng CSS chứ không dùng file ảnh: nhẹ hơn, không thêm một
 * request mạng, và tự co giãn đúng ở mọi bề rộng màn hình thay vì bị cắt cụt
 * như ảnh có tỉ lệ cố định.
 *
 * Phần trang trí bên phải là chính các thương hiệu trong dữ liệu, xếp nghiêng
 * và làm mờ. Nhờ vậy băng này luôn phản ánh nội dung thật bên dưới — thêm một
 * thương hiệu vào danh sách là băng tự đổi theo.
 */
function BannerHeader({ brands }: { brands: Brand[] }) {
  return (
    <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-[#f7e7b8] via-[#f0d488] to-[#e6bd5c] px-6 py-6">
      {/* Collage logo mờ dần về bên phải, nhắc tới ý "hàng trăm thương hiệu". */}
      <div
        className="absolute inset-y-0 right-0 hidden w-1/2 items-center gap-3 overflow-hidden pl-8 md:flex"
        aria-hidden
      >
        {[...brands, ...brands].slice(0, 9).map((b, i) => (
          <span
            key={`${b.name}-${i}`}
            className={cn(
              'grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-bold text-white/90 opacity-35 shadow-lg',
              b.color,
            )}
            style={{
              // Nghiêng và lệch dọc xen kẽ để trông như ảnh chụp một chồng thẻ,
              // thay vì một hàng đều tăm tắp.
              transform: `rotate(${i % 2 ? 6 : -5}deg) translateY(${i % 3 === 0 ? -10 : 8}px)`,
            }}
          >
            {b.initial}
          </span>
        ))}
      </div>

      {/* Lớp phủ kéo từ trái sang, giữ nền phía sau chữ đủ sáng và đều màu để
          chữ xanh đậm luôn đọc rõ, kể cả khi collage phía sau đổi theo dữ liệu. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#f7e7b8] via-[#f7e7b8]/90 to-transparent" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-extrabold text-[#0e4a2c] md:text-2xl">
            Thương hiệu lớn tiêu biểu
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0e4a2c] px-3 py-1 text-sm font-bold text-[#f0d488] shadow-sm">
            <Sparkles size={13} />
            Pro Company
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm font-semibold text-[#0e4a2c]/75">
          Hàng trăm thương hiệu lớn tiêu biểu đang tuyển dụng trên UniWork Pro
        </p>
      </div>
    </div>
  )
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:text-accent-600 hover:shadow-sm"
    >
      {children}
    </button>
  )
}

function SpotlightCard({
  brand,
  following,
  onFollow,
}: {
  brand: Brand
  following: boolean
  onFollow: () => void
}) {
  return (
    <div className="relative flex min-h-[340px] flex-col justify-between overflow-hidden p-6 text-white">
      {/* Nền tách riêng khỏi nội dung để phóng chậm được mà chữ vẫn đứng yên.
          Màu đặc thôi thì phóng to không nhìn thấy gì — phải có vệt sáng và hoa
          văn bên trong mới thấy được chuyển động. */}
      <div className={cn('absolute inset-0', brand.color)} />
      <div className="ken-burns absolute inset-0">
        <div className="absolute -inset-1/4 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.42),transparent_58%)]" />
        <div className="pattern-hex absolute inset-0 opacity-25" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/5" />

      <div className="relative flex items-start justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-bold shadow-sm">
          <Sparkles size={12} />
          Nổi bật
        </span>
      </div>

      <div className="relative">
        <div className="stagger-1 grid h-20 w-20 place-items-center rounded-2xl bg-white text-3xl font-extrabold text-slate-900 shadow-lg">
          {brand.initial}
        </div>

        <h3 className="stagger-2 mt-4 text-2xl font-bold leading-tight">{brand.name}</h3>
        <p className="stagger-2 mt-1 text-sm text-white/85">{brand.tag}</p>

        <div className="stagger-3 mt-5 flex flex-wrap items-center gap-2">
          <Link
            to="/viec-lam"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-0.5"
          >
            <Briefcase size={14} />
            {brand.jobs} việc làm
          </Link>
          <FollowButton following={following} onClick={onFollow} tone="light" />
        </div>
      </div>
    </div>
  )
}

function BrandCard({
  brand,
  active,
  following,
  onSelect,
  onFollow,
}: {
  brand: Brand
  active: boolean
  following: boolean
  onSelect: () => void
  onFollow: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'card-lift cursor-pointer rounded-xl border p-3 transition-colors',
        active
          ? 'border-accent-400 bg-accent-50/60 ring-1 ring-accent-400/30'
          : 'border-slate-200 hover:border-accent-300',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-lg text-lg font-bold text-white',
            brand.color,
          )}
        >
          {brand.initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{brand.name}</span>
          <span className="block truncate text-xs text-slate-500">{brand.tag}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Briefcase size={12} />
          {brand.jobs} việc làm
        </span>
        <FollowButton following={following} onClick={onFollow} tone="solid" />
      </div>
    </div>
  )
}

function FollowButton({
  following,
  onClick,
  tone,
}: {
  following: boolean
  onClick: () => void
  tone: 'light' | 'solid'
}) {
  return (
    <button
      onClick={(e) => {
        // Nút nằm trong thẻ có onClick riêng. Không chặn thì bấm "Theo dõi" sẽ
        // đồng thời đưa thẻ đó lên vị trí nổi bật — hai việc không liên quan.
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
        following
          ? 'bg-slate-100 text-slate-500'
          : tone === 'light'
            ? 'text-white ring-1 ring-white/50 hover:bg-white/15'
            : 'bg-accent-50 text-accent-600 hover:bg-accent-100',
      )}
    >
      {following ? <Check size={12} /> : <Plus size={12} />}
      {following ? 'Đang theo dõi' : 'Theo dõi'}
    </button>
  )
}
