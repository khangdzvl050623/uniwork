import { useEffect, useRef, useState } from 'react'
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
 * Số hàng tối đa mà thẻ hero được trải.
 *
 * 3 là con số TopCV dùng, và nó hợp lý: cao hơn nữa thì thẻ hero dài quá khung
 * nhìn, người dùng phải cuộn mới thấy hết một thẻ quảng cáo — phản tác dụng.
 */
const HERO_MAX_ROWS = 3

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

  /**
   * Vuốt để đổi thẻ trên điện thoại.
   *
   * Chỉ đo điểm đầu và điểm cuối chứ không kéo thẻ chạy theo ngón tay. Kéo theo
   * ngón cần xử lý thêm quán tính và bật lại khi thả giữa chừng — nhiều việc mà
   * người dùng gần như không phân biệt được với cách này.
   *
   * Ngưỡng 50px để một cú chạm hơi lệch tay không bị hiểu nhầm thành vuốt.
   */
  const dragFrom = useRef<number | null>(null)

  const onDragStart = (e: React.PointerEvent) => {
    dragFrom.current = e.clientX
  }

  const onDragEnd = (e: React.PointerEvent) => {
    if (dragFrom.current === null) return
    const delta = e.clientX - dragFrom.current
    dragFrom.current = null
    if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1)
  }

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

        {/* Track trượt ngang, cùng cấu trúc với slick-slider của TopCV.
            MỖI SLIDE LÀ MỘT TRANG HOÀN CHỈNH: thẻ hero bên trái kèm danh sách
            các thương hiệu còn lại bên phải. Trượt sang trái là đổi cả trang.

            Đây là điểm khác quan trọng so với việc chỉ trượt riêng thẻ hero: khi
            cả trang cùng trượt, danh sách bên phải đổi nội dung mà không nhấp
            nháy, vì nó rời đi như một khối chứ không thay chữ tại chỗ. */}
        <div
          className="slide-viewport relative mt-4 overflow-hidden"
          onPointerDown={onDragStart}
          onPointerUp={onDragEnd}
          onPointerCancel={() => (dragFrom.current = null)}
        >
          <div
            className="slide-track flex"
            style={{ transform: `translate3d(-${active * 100}%, 0, 0)` }}
          >
            {brands.map((featured, pageIndex) => {
              const others = brands.filter((b) => b.name !== featured.name)

              // Lưới 3 cột. Thẻ hero nằm cột 1 và trải tối đa HERO_MAX_ROWS
              // hàng; thẻ nhỏ lấp hai cột còn lại rồi tràn xuống dưới chiếm
              // hết bề ngang.
              //
              // Phải có trần: không chặn thì thêm thương hiệu là hero cao vống
              // lên theo, tới 20 thương hiệu là nó thành một cột dài ngoẵng.
              const heroRows = Math.min(HERO_MAX_ROWS, Math.max(1, Math.ceil(others.length / 2)))

              // Số ô nằm cạnh hero, và số thẻ phải tràn xuống dưới.
              const beside = heroRows * 2
              const overflow = Math.max(0, others.length - beside)

              // Tổng số ô của lưới, trừ đi phần hero chiếm, ra số ô dành cho
              // thẻ nhỏ. Chênh lệch với số thẻ thật chính là chỗ trống cuối.
              const totalRows = heroRows + Math.ceil(overflow / 3)
              const gap = totalRows * 3 - heroRows - others.length

              // Cho thẻ cuối giãn ra lấp đúng chỗ trống đó. Lấp kín mà không
              // phải bịa thêm dữ liệu hay chừa một ô trắng nhìn như lỗi.
              const lastSpan = gap > 0 ? Math.min(3, gap + 1) : 1

              return (
                <div key={featured.name} className="w-full shrink-0">
                  <div className="grid gap-3 pr-px lg:grid-cols-3">
                    <div
                      className="overflow-hidden rounded-xl lg:col-start-1"
                      style={{ gridRow: `span ${heroRows}` }}
                    >
                      <SpotlightCard
                        brand={featured}
                        following={followed.has(featured.name)}
                        onFollow={() => toggleFollow(featured.name)}
                      />
                    </div>

                    {others.map((b, i) => (
                      <div
                        key={b.name}
                        style={
                          i === others.length - 1 && lastSpan > 1
                            ? { gridColumn: `span ${lastSpan}` }
                            : undefined
                        }
                      >
                        <BrandCard
                          brand={b}
                          following={followed.has(b.name)}
                          onSelect={() => setActive(brands.indexOf(b))}
                          onFollow={() => toggleFollow(b.name)}
                        />
                      </div>
                    ))}
                  </div>
                  <span className="sr-only">
                    Trang {pageIndex + 1} trên {brands.length}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Chấm chỉ vị trí: cho biết có bao nhiêu trang, đang ở trang nào. */}
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

          {/* Thanh tiến trình cho biết còn bao lâu nữa sang trang. Không có nó,
              việc khối tự đổi trông như trang bị lỗi. key={active} ép dựng lại
              mỗi lần sang trang để hoạt ảnh chạy lại từ 0. */}
          <div className="mx-2 h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              key={active}
              className={cn('progress-fill h-full bg-accent-400', paused && 'is-paused')}
              style={{ animationDuration: `${ROTATE_MS}ms` }}
            />
          </div>

          <div className="flex gap-2">
            <ArrowButton label="Trang trước" onClick={() => go(-1)}>
              <ChevronLeft size={16} />
            </ArrowButton>
            <ArrowButton label="Trang sau" onClick={() => go(1)}>
              <ChevronRight size={16} />
            </ArrowButton>
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
    <div className="relative overflow-hidden rounded-t-2xl bg-[#2b2119] px-6 py-7">
      {/* Collage logo phủ nửa phải, làm mờ để không tranh chỗ với chữ. */}
      <div
        className="absolute inset-y-0 right-0 hidden w-3/5 flex-wrap content-center items-center gap-3 overflow-hidden pl-10 md:flex"
        aria-hidden
      >
        {[...brands, ...brands, ...brands].slice(0, 14).map((b, i) => (
          <span
            key={`${b.name}-${i}`}
            className={cn(
              'grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white opacity-45 shadow-xl',
              b.color,
            )}
            style={{
              // Nghiêng và lệch dọc xen kẽ để trông như một chồng thẻ chụp
              // nghiêng, thay vì một hàng xếp đều tăm tắp.
              transform: `rotate(${i % 2 ? 7 : -6}deg) translateY(${i % 3 === 0 ? -12 : 10}px)`,
            }}
          >
            {b.initial}
          </span>
        ))}
      </div>

      {/* Vệt sáng chéo cắt ngang giữa băng — chi tiết làm nền bớt phẳng. */}
      <div className="absolute inset-y-[-40%] left-[38%] w-24 rotate-12 bg-gradient-to-r from-transparent via-white/25 to-transparent blur-md" />

      {/* Lớp phủ tối kéo từ trái sang, giữ vùng sau chữ đủ tối để chữ luôn đọc
          được dù collage phía sau đổi theo dữ liệu. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#2b2119] via-[#2b2119]/92 to-transparent" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0e4a2c] md:text-[28px]">
            Thương hiệu lớn tiêu biểu
          </h2>
          <p className="mt-2 max-w-xl text-sm font-semibold text-white md:text-[15px]">
            Hàng trăm thương hiệu lớn tiêu biểu đang tuyển dụng trên UniWork Pro
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#fbd46a] to-[#e0a52e] px-6 py-3 text-base font-bold text-[#2b2119] shadow-lg">
          <Sparkles size={16} />
          Pro Company
        </span>
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
    <div className="relative flex h-full min-h-[420px] flex-col items-center justify-center overflow-hidden p-6 text-center text-white">
      {/* Nền nâu sepia CỐ ĐỊNH cho mọi thương hiệu, không đổi màu theo từng bên.
          Lý do: logo mỗi công ty một màu, nền cũng đổi màu theo thì hai thứ đá
          nhau và cả khối trông chắp vá. Nền tối đứng yên làm logo nổi lên. */}
      <div className="absolute inset-0 bg-[#2b2119]" />

      {/* Lớp phóng chậm. Màu đặc thôi thì phóng to không thấy gì — phải có vệt
          sáng và hoa văn bên trong mới nhìn ra chuyển động. */}
      <div className="ken-burns absolute inset-0">
        <div className="absolute -inset-1/4 bg-[radial-gradient(circle_at_35%_20%,rgba(214,178,110,0.38),transparent_62%)]" />
        <div className="pattern-hex absolute inset-0 opacity-20" />
      </div>

      {/* Chút màu thương hiệu hắt lên từ đáy, đủ để mỗi thẻ có sắc riêng mà
          không phá tông nâu chung. */}
      <div className={cn('absolute inset-x-0 bottom-0 h-1/3 opacity-25 blur-2xl', brand.color)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />

      <div className="relative flex flex-col items-center">
        <div className="stagger-1 grid h-28 w-28 place-items-center rounded-xl bg-white text-4xl font-extrabold text-slate-900 shadow-2xl">
          {brand.initial}
        </div>

        <h3 className="stagger-2 mt-6 max-w-[16rem] text-lg font-bold uppercase leading-snug tracking-wide">
          {brand.name}
        </h3>
        <p className="stagger-2 mt-1.5 text-sm text-white/75">{brand.tag}</p>

        <Link
          to="/viec-lam"
          className="stagger-3 mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium ring-1 ring-white/25 transition-colors hover:bg-white/25"
        >
          <Briefcase size={14} />
          {brand.jobs} việc làm
        </Link>

        <span className="stagger-3 mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#fbd46a] to-[#e0a52e] px-5 py-2 text-sm font-bold text-[#2b2119] shadow-lg">
          <Sparkles size={14} />
          Pro Company
        </span>

        <div className="stagger-3 mt-3">
          <FollowButton following={following} onClick={onFollow} tone="light" />
        </div>
      </div>
    </div>
  )
}

function BrandCard({
  brand,
  following,
  onSelect,
  onFollow,
}: {
  brand: Brand
  following: boolean
  onSelect: () => void
  onFollow: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        // Viền vàng nhạt thay vì xám: cả khối này thuộc gói Pro, viền vàng buộc
        // chúng thành một nhóm và tách khỏi các thẻ thường ở phần trên trang.
        // h-full để thẻ giãn kín ô lưới. Thiếu nó thì thẻ chỉ cao bằng nội dung
        // và hàng nào có tên công ty dài hai dòng sẽ cao hơn hẳn hàng bên cạnh.
        'card-lift flex h-full cursor-pointer flex-col justify-between rounded-xl border border-accent-100 p-3 transition-colors',
        'hover:border-accent-400',
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
