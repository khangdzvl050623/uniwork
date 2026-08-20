import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coffee,
  FileText,
  GraduationCap,
  Headphones,
  Laptop,
  MapPin,
  PartyPopper,
  Play,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Users,
  Zap,
} from 'lucide-react'
import { JobCard } from '@/components/JobCard'
import { HeroAurora } from '@/components/HeroAurora'
import { Earth } from '@/components/Earth'
import { SloganBand } from '@/components/SloganBand'
import { Reveal } from '@/components/Reveal'
import { Countdown } from '@/components/Countdown'
import { Marquee } from '@/components/Marquee'
import { CountUp } from '@/components/CountUp'
import { MarketChart } from '@/components/MarketChart'
import { SpotlightCompanies } from '@/components/SpotlightCompanies'
import { Button } from '@/components/ui/Button'
import { DISTRICTS, JOBS } from '@/data/mock'
import { useSiteStats } from '@/hooks/useSiteStats'
import { cn, formatDate } from '@/lib/utils'

<<<<<<< HEAD
const JOB_TABS = ['IT', 'Logistics', 'Marketing', 'Sales']
const HOT_KEYWORDS = ['IT', 'Logistics', 'Marketing', 'Sales']
=======
const JOB_TABS = ['Phù hợp lịch của bạn', 'Việc mới nhất', 'Lương cao', 'Làm từ xa', 'Cuối tuần']
const HOT_KEYWORDS = ['Phục vụ quán', 'Gia sư', 'Trực page', 'Sự kiện', 'Nhập liệu', 'Bán hàng']
>>>>>>> dev

const HERO_POINTS = [
  'Lọc việc theo đúng khung giờ bạn rảnh',
  'Tin đăng đã kiểm duyệt giấy tờ doanh nghiệp',
  'Theo dõi trạng thái hồ sơ, không rơi vào inbox',
  'Miễn phí toàn bộ với sinh viên',
]

const BRAND_TABS = [
  'Tất cả',
<<<<<<< HEAD
  'IT',
  'Logistics',
  'Marketing',
  'Sales',
=======
  'Quán ăn & cà phê',
  'Giáo dục',
  'Bán lẻ',
  'Sự kiện',
  'Công nghệ',
  'Kho vận',
  'Dịch vụ ăn uống',
>>>>>>> dev
]

const BRANDS = [
  {
    name: 'The Corner Coffee',
    initial: 'C',
    color: 'bg-amber-500',
    tag: 'Chuỗi cà phê · 12 chi nhánh',
    jobs: 8,
  },
  {
    name: 'Trung tâm Trí Việt',
    initial: 'T',
    color: 'bg-brand-600',
    tag: 'Giáo dục · Gia sư',
    jobs: 14,
  },
  { name: 'Sao Việt Event', initial: 'S', color: 'bg-rose-500', tag: 'Tổ chức sự kiện', jobs: 21 },
  {
    name: 'DataLine Việt Nam',
    initial: 'D',
    color: 'bg-cyan-600',
    tag: 'Dịch vụ dữ liệu',
    jobs: 6,
  },
  {
    name: 'Siêu thị Minh Phát',
    initial: 'M',
    color: 'bg-emerald-600',
    tag: 'Bán lẻ · 5 cửa hàng',
    jobs: 11,
  },
  {
    name: 'Anh ngữ Sunrise',
    initial: 'A',
    color: 'bg-indigo-500',
    tag: 'Trung tâm ngoại ngữ',
    jobs: 9,
  },
  {
    name: 'Nhà sách Tân Việt',
    initial: 'N',
    color: 'bg-orange-500',
    tag: 'Bán lẻ · Nhà sách',
    jobs: 7,
  },
  {
    name: 'GreenBox Logistics',
    initial: 'G',
    color: 'bg-sky-600',
    tag: 'Kho vận · Giao nhận',
    jobs: 15,
  },
  {
    name: 'Bếp Việt Catering',
    initial: 'B',
    color: 'bg-red-500',
    tag: 'Dịch vụ ăn uống',
    jobs: 10,
  },
  {
    name: 'Studio Khoảnh Khắc',
    initial: 'K',
    color: 'bg-violet-600',
    tag: 'Nhiếp ảnh · Sự kiện',
    jobs: 5,
  },
]

const CATEGORIES = [
<<<<<<< HEAD
  { icon: Laptop, label: 'IT', count: 158 },
  { icon: Truck, label: 'Logistcs', count: 97 },
  { icon: BookOpen, label: 'Marketing', count: 84 },
  { icon: Headphones, label: 'Sales', count: 132 },
=======
  { icon: Coffee, label: 'Phục vụ, pha chế', count: 312 },
  { icon: GraduationCap, label: 'Gia sư, trợ giảng', count: 248 },
  { icon: ShoppingBag, label: 'Bán hàng, thu ngân', count: 196 },
  { icon: PartyPopper, label: 'Sự kiện, PG/PB', count: 174 },
  { icon: Laptop, label: 'Nhập liệu, online', count: 158 },
  { icon: Headphones, label: 'Chăm sóc khách hàng', count: 132 },
  { icon: Truck, label: 'Kho vận, giao hàng', count: 97 },
  { icon: BookOpen, label: 'Thiết kế, nội dung', count: 84 },
>>>>>>> dev
]

const TOOLS = [
  'Tạo CV cho người chưa kinh nghiệm',
  'Gợi ý việc theo lịch rảnh',
  'Nhắc hạn nộp hồ sơ',
  'Theo dõi trạng thái từng đơn',
  'Cảnh báo tin có dấu hiệu lừa đảo',
  'Thống kê giờ làm mỗi tuần',
]

const AWARDS = [
  { year: '2026', title: 'Giải Nhì Sinh viên NCKH cấp trường', org: 'Khoa Công nghệ Thông tin' },
  { year: '2026', title: 'Top 10 đồ án tiêu biểu học kỳ', org: 'Hội đồng chuyên môn' },
  { year: '2026', title: 'Giải Sản phẩm có tính ứng dụng', org: 'Ngày hội Khởi nghiệp SV' },
]

const ECOSYSTEM = [
  {
    name: 'UniWork Jobs',
    desc: 'Tìm và ứng tuyển việc bán thời gian',
    color: 'from-brand-500 to-brand-700',
  },
  {
    name: 'UniWork Schedule',
    desc: 'Quản lý lịch rảnh theo học kỳ',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    name: 'UniWork CV',
    desc: 'Mẫu CV dành riêng cho sinh viên',
    color: 'from-amber-500 to-orange-600',
  },
  {
    name: 'UniWork Employer',
    desc: 'Đăng tin và sàng lọc ứng viên',
    color: 'from-indigo-500 to-indigo-700',
  },
]

const PRESS = [
  'Bản tin Sinh viên',
  'Tạp chí Giáo dục',
  'Kênh 14 Campus',
  'Tuổi Trẻ Online',
  'VnExpress Số hoá',
  'Báo Thanh Niên',
]

export function Home() {
  const [jobTab, setJobTab] = useState(0)
  const jobs = jobTab === 0 ? [...JOBS].sort((a, b) => b.matchScore - a.matchScore) : JOBS

  // Mọi con số hiện trên trang này đến từ đây, không chỗ nào ghi cứng. Hôm nay
  // là số mô phỏng, ngày api có endpoint đếm thì chỉ hook đổi — trang chủ không
  // biết và không cần biết nguồn nào.
  const stats = useSiteStats()
  const marketRising = stats.market.changePercent >= 0

  return (
    <>
      {/* ================================================================ HERO */}
      {/* `isolate` không phải để trang trí: nó tạo một tầng xếp chồng riêng cho
          khối hero, nhờ đó mấy vệt sáng bên trong HeroAurora (dùng mix-blend-mode
          screen) chỉ hoà màu với nền hero chứ không ăn lan ra header phía trên. */}
      <section className="hero-sky relative isolate overflow-hidden px-4 pt-10 pb-24 sm:pt-14">
        <HeroAurora />

        <div className="relative mx-auto max-w-[1180px]">
          <div className="hero-rise flex justify-center" style={{ animationDelay: '0ms' }}>
            <span className="sheen relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm sm:text-sm">
              <span className="live-dot relative h-2 w-2 rounded-full bg-brand-300 text-brand-300" />
              <span>
                <CountUp to={stats.activeStudentsThisWeek} duration={1400} /> sinh viên đang tìm ca
                làm trong tuần này
              </span>
            </span>
          </div>

          <h1
            className="hero-rise mx-auto mt-5 max-w-3xl text-center text-[1.75rem] leading-[1.15] font-black tracking-tight text-white sm:text-4xl lg:text-[2.6rem]"
            style={{ animationDelay: '80ms' }}
          >
<<<<<<< HEAD
            Việc làm <span className="text-gradient-fresh">khớp đúng lịch</span>{' '}
=======
            Việc làm bán thời gian <span className="text-gradient-fresh">khớp đúng lịch học</span>{' '}
>>>>>>> dev
            của bạn
          </h1>

          <p
            className="hero-rise mx-auto mt-4 max-w-xl text-center text-sm text-white/70 sm:text-base"
            style={{ animationDelay: '140ms' }}
          >
<<<<<<< HEAD
            Khai lịch rảnh một lần - Miễn phí toàn bộ với sinh viên
=======
            Khai lịch rảnh một lần. Miễn phí toàn bộ với sinh viên.
>>>>>>> dev
          </p>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="hero-rise search-shell mx-auto mt-9 flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)] md:flex-row md:items-center"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                placeholder="Vị trí, kỹ năng hoặc tên công ty"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 px-3 md:border-l md:border-slate-200">
              <MapPin size={18} className="shrink-0 text-slate-400" />
              <select className="h-12 w-full cursor-pointer bg-transparent text-sm text-slate-600 outline-none md:w-44">
                <option value="">Tất cả khu vực</option>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="gradient" size="lg" className="shrink-0 md:px-9">
              <Search size={17} />
              Tìm kiếm
            </Button>
          </form>

          <div
            className="hero-rise mt-5 flex flex-wrap items-center justify-center gap-2 text-sm"
            style={{ animationDelay: '260ms' }}
          >
            <span className="text-white/55">Từ khoá phổ biến:</span>
            {HOT_KEYWORDS.map((k) => (
              <Link
                key={k}
                to="/viec-lam"
                className="rounded-full border border-white/25 bg-white/5 px-3.5 py-1.5 font-medium text-white/85 backdrop-blur-sm transition-[transform,background-color,border-color,color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-300/70 hover:bg-white/15 hover:text-white active:scale-[0.96]"
              >
                {k}
              </Link>
            ))}
          </div>

          {/* Bốn lời hứa, gộp thành một dòng mảnh phân cách bằng dấu chấm giữa.
              Bốn thẻ riêng như bản trước chiếm gần 100px chỉ để nói bốn ý ngắn —
              trong khi thứ người dùng vào đây để tìm là danh sách việc làm. */}
          <ul
            className="hero-rise mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs text-white/60"
            style={{ animationDelay: '320ms' }}
          >
            {HERO_POINTS.map((p, i) => (
              <li key={p} className="flex items-center gap-2.5">
                {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/25" />}
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="shrink-0 text-brand-300" />
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Đường lượn khép đáy hero. Cắt bằng đường thẳng thì hero trông như một
            dải băng dán lên trang; đường cong làm nó chảy vào phần nội dung
            trắng bên dưới. Màu tô đúng bằng nền body (slate-100). */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0">
          <svg
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            className="block h-[56px] w-full sm:h-[90px]"
          >
            <path
              d="M0 90V44c180 30 360 42 540 26 180-16 360-58 540-58 120 0 240 18 360 40v38z"
              fill="#f1f5f9"
            />
          </svg>
        </div>
      </section>

<<<<<<< HEAD
      {/* ================================================= TOP NGÀNH NGHỀ */}
      <section className="mx-auto mt-10 max-w-[1180px] px-4">
        <Reveal>
          <h2 className="text-center text-xl font-bold text-slate-900">Top ngành nghề nổi bật</h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Nhóm việc được sinh viên tìm nhiều nhất tháng này
          </p>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.label} delay={i * 45}>
              <Link
                to="/viec-lam"
                className="card-lift group flex h-full items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <c.icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {c.label}
                  </span>
                  <span className="text-xs text-slate-400">{c.count} tin tuyển</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

=======
>>>>>>> dev
      {/* ==================================================== VIỆC LÀM TỐT NHẤT */}
      <section className="mx-auto mt-7 max-w-[1180px] px-4">
        <Reveal className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
<<<<<<< HEAD
            <h2 className="text-lg font-bold text-slate-900">Việc thực tập cho sinh viên</h2>
=======
            <h2 className="text-lg font-bold text-slate-900">Việc làm tốt nhất</h2>
>>>>>>> dev
            <div className="scroll-x flex gap-1.5 overflow-x-auto">
              {JOB_TABS.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setJobTab(i)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    jobTab === i
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Link
              to="/viec-lam"
              className="ml-auto hidden items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex"
            >
              Xem tất cả <ChevronRight size={15} />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  d === 0 ? 'w-6 bg-brand-500' : 'w-1.5 bg-slate-300',
                )}
              />
            ))}
          </div>

          <div className="mt-4 text-center">
            <Link to="/viec-lam">
              <Button variant="outline">
                Xem thêm việc làm <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ================================================= LỌC THEO LỊCH RẢNH */}
      {/* Khối này trước nằm trong hero. Đưa xuống đây vì nó trả lời câu hỏi nảy
          ra ngay SAU khi người dùng nhìn thấy danh sách việc — "làm sao biết ca
          nào tôi đi được?" — chứ không phải câu hỏi họ mang theo lúc vừa vào
          trang. Đặt trên hero thì nó chỉ đẩy danh sách việc xuống dưới nếp gấp. */}
      <section className="mx-auto mt-5 max-w-[1180px] px-4">
        <Reveal>
          <div className="bg-brand-deep relative overflow-hidden rounded-2xl p-6 sm:p-9">
            <div className="pattern-hex absolute inset-0 opacity-60" />

            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
                  <Sparkles size={12} /> Chỉ có ở UniWork
                </span>
                <h2 className="mt-3 text-2xl leading-snug font-extrabold text-white sm:text-3xl">
                  Lọc việc theo <span className="text-gradient-fresh">đúng khung giờ</span>
                  <br />
                  bạn còn rảnh
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-50/75">
                  Khai lịch học một lần. Mỗi tin đăng tự chấm điểm phù hợp với lịch của bạn, khỏi
                  ngồi dò từng ca xem có trùng tiết nào không.
                </p>
                <Link to="/lich-ranh" className="mt-6 inline-block">
                  <Button variant="gradient" size="lg">
                    <CalendarCheck size={16} />
                    Khai lịch rảnh
                    <ArrowRight size={15} />
                  </Button>
                </Link>
              </div>

              {/* Lưới lịch thu nhỏ, cho thấy ngay ý tưởng thay vì tả bằng chữ.
                  Các ô nảy ra lần lượt chứ không ập ra cùng lúc — mắt đọc được
                  ra rằng lưới đang được dựng lên chứ không phải một tấm ảnh. */}
              <div className="shrink-0">
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 21 }).map((_, i) => {
                    const busy = [3, 5, 10, 12, 17, 19, 20].includes(i)
                    const free = [1, 8, 15].includes(i)
                    return (
                      <span
                        key={i}
                        className={cn(
                          'cell-pop h-7 w-7 rounded-md',
                          busy
                            ? 'bg-amber-400 shadow-[0_0_14px_-2px_rgba(251,191,36,0.85)]'
                            : free
                              ? 'bg-brand-400 shadow-[0_0_14px_-2px_rgba(20,196,171,0.85)]'
                              : 'bg-white/12',
                        )}
                        style={{ animationDelay: `${240 + i * 22}ms` }}
                      />
                    )
                  })}
                </div>
                <div className="mt-3.5 flex items-center gap-4 text-[11px] text-brand-50/70">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Ca cần làm
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-400" /> Bạn rảnh
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================================================ THƯƠNG HIỆU TIÊU BIỂU */}
      <section className="mx-auto mt-5 max-w-[1180px] px-4">
        <Reveal>
          <SpotlightCompanies brands={BRANDS} tabs={BRAND_TABS} />
        </Reveal>
      </section>

      {/* ============================================ THỊ TRƯỜNG VIỆC LÀM HÔM NAY */}
      <section className="mx-auto mt-5 max-w-[1180px] px-4">
        <Reveal className="overflow-hidden rounded-2xl bg-slate-900 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Thị trường việc làm hôm nay</h2>
              <p className="mt-1 text-sm text-slate-400">Cập nhật {formatDate(stats.computedAt)}</p>
            </div>
            {/* Chữ và màu bám theo dấu của changePercent. Ghi cứng "Tăng" rồi tới
                ngày service trả về số âm là giao diện nói ngược hẳn sự thật. */}
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                marketRising ? 'bg-brand-500/15 text-brand-300' : 'bg-rose-500/15 text-rose-300',
              )}
            >
              <TrendingUp size={13} className={cn(!marketRising && 'rotate-180')} />
              {marketRising ? 'Tăng' : 'Giảm'}{' '}
              <CountUp to={Math.abs(stats.market.changePercent)} duration={900} suffix="%" /> so với
              tuần trước
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-3">
              {[
                {
                  value: stats.market.applicationsThisWeek,
                  label: 'lượt ứng tuyển tuần này',
                  icon: Users,
                },
                {
                  value: stats.market.matchedHours,
                  label: 'giờ làm đã ghép thành công',
                  icon: Clock,
                },
                { value: stats.market.jobViews, label: 'lượt xem tin tuyển dụng', icon: BarChart3 },
              ].map(({ value, label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500/20 text-brand-400">
                    <Icon size={18} />
                  </span>
                  <span>
                    <CountUp to={value} className="block text-xl font-extrabold text-white" />
                    <span className="text-xs text-slate-400">{label}</span>
                  </span>
                </div>
              ))}
            </div>

            <MarketChart
              weeklyApplications={stats.market.weeklyApplications}
              changePercent={stats.market.changePercent}
            />
          </div>
        </Reveal>
      </section>

<<<<<<< HEAD
      
=======
      {/* ================================================== DẢI KHUYẾN KHÍCH */}
      <section className="mx-auto mt-5 max-w-[1180px] px-4">
        <Reveal className="relative overflow-hidden rounded-2xl bg-brand-deep p-6 sm:p-8">
          <div className="pattern-hex absolute inset-0 opacity-70" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/20 px-3 py-1 text-xs font-semibold text-accent-400">
                <Zap size={13} /> Đợt tuyển đầu học kỳ
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
                Huy hiệu <span className="text-gradient-gold">Ứng viên uy tín</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-brand-50/85">
                Hoàn thiện hồ sơ và khai đủ lịch rảnh trước hạn để nhận huy hiệu — hồ sơ có huy hiệu
                được nhà tuyển dụng xem trước tiên.
              </p>

              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  'Ưu tiên hiển thị trong danh sách',
                  'Tăng 40% tỉ lệ được phản hồi',
                  'Mở khoá bộ lọc nâng cao',
                  'Nhận gợi ý việc riêng mỗi tuần',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-brand-50/90">
                    <Star size={15} className="mt-0.5 shrink-0 text-accent-400" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-white/10 p-5 ring-1 ring-white/20">
              <p className="text-xs uppercase tracking-wide text-brand-100/80">Thời gian còn lại</p>
              <div className="mt-3">
                <Countdown />
              </div>
              <p className="mt-4 text-sm text-brand-50/85">
                <strong className="text-white">4.057</strong> sinh viên đã nhận huy hiệu trong đợt
                này
              </p>
              <Link to="/dang-ky" className="mt-4 block">
                <Button variant="accent" size="lg" className="w-full">
                  Nhận huy hiệu ngay
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================================================= TOP NGÀNH NGHỀ */}
      <section className="mx-auto mt-10 max-w-[1180px] px-4">
        <Reveal>
          <h2 className="text-center text-xl font-bold text-slate-900">Top ngành nghề nổi bật</h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Nhóm việc được sinh viên tìm nhiều nhất tháng này
          </p>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.label} delay={i * 45}>
              <Link
                to="/viec-lam"
                className="card-lift group flex h-full items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <c.icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {c.label}
                  </span>
                  <span className="text-xs text-slate-400">{c.count} tin tuyển</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
>>>>>>> dev

      {/* ==================================================== KHẨU HIỆU */}
      {/* Đặt ở giữa trang, ngay sau khi người đọc đã xem việc làm và nhóm nghề:
          lúc này họ đã biết sản phẩm làm gì, nên một câu nói về "vì sao" mới có
          chỗ bám. Để ngay đầu trang thì nó chỉ là chữ to chắn đường. */}
      <div className="mt-12">
        <SloganBand />
      </div>

      {/* ============================================ XÂY DỰNG HỒ SƠ CÁ NHÂN */}
      <section className="mx-auto mt-10 max-w-[1180px] px-4">
        <Reveal>
          <h2 className="text-center text-xl font-bold text-slate-900">
            Cùng UniWork xây dựng hồ sơ cá nhân
          </h2>
        </Reveal>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <Reveal className="h-full">
            <div className="card-lift flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                  <FileText size={13} /> Miễn phí
                </span>
                <h3 className="mt-3 text-xl font-bold text-white">Trình tạo CV sinh viên</h3>
                <p className="mt-2 max-w-md text-sm text-white/85">
                  Mẫu CV dành cho người chưa có kinh nghiệm — tự động điền kỹ năng và lịch rảnh đã
                  khai.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Mẫu tối giản', 'Mẫu có ảnh', 'Mẫu song ngữ'].map((m) => (
                  <span key={m} className="rounded-md bg-white/15 px-2.5 py-1 text-xs text-white">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {[
            {
              icon: BarChart3,
              title: 'Trắc nghiệm định hướng nghề',
              desc: 'Biết mình hợp nhóm việc nào trước khi ứng tuyển',
            },
            {
              icon: ShieldCheck,
              title: 'Đánh giá độ an toàn tin',
              desc: 'Nhận diện dấu hiệu tin lừa đảo, thu phí trước',
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={(i + 1) * 90} className="h-full">
              <div className="card-lift flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <c.icon size={20} />
                </span>
                <h3 className="mt-4 font-bold text-slate-900">{c.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">{c.desc}</p>
                <Link
                  to="/dang-ky"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                >
                  Thử ngay <ChevronRight size={15} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================================================== CÔNG CỤ VƯỢT TRỘI */}
      <section className="mt-12 bg-brand-50 px-4 py-12">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <h2 className="text-center text-xl font-bold text-slate-900">Công cụ vượt trội</h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              Những thứ một job board thông thường không làm cho bạn
            </p>
          </Reveal>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-3">
              {TOOLS.slice(0, 3).map((t, i) => (
                <Reveal key={t} delay={i * 70}>
                  <div className="card-lift flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                    <CheckCircle2 size={18} className="shrink-0 text-brand-500" />
                    <span className="text-sm font-medium text-slate-700">{t}</span>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={120} className="mx-auto">
              <div className="relative grid h-44 w-44 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700">
                <div className="pulse-ring absolute inset-0 rounded-full" />
                <Sparkles size={56} className="text-white" />
              </div>
            </Reveal>

            <div className="space-y-3">
              {TOOLS.slice(3).map((t, i) => (
                <Reveal key={t} delay={i * 70}>
                  <div className="card-lift flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                    <CheckCircle2 size={18} className="shrink-0 text-brand-500" />
                    <span className="text-sm font-medium text-slate-700">{t}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

<<<<<<< HEAD
=======
      {/* ================================================ GIẢI THƯỞNG & TẢI APP */}
      <section className="bg-brand-deep px-4 py-12">
        <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-xl font-bold text-white">Giải thưởng & ghi nhận</h2>
            <div className="mt-5 space-y-3">
              {AWARDS.map((a) => (
                <div
                  key={a.title}
                  className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-500/20 text-accent-400">
                    <Award size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{a.title}</span>
                    <span className="text-xs text-brand-50/70">
                      {a.org} · {a.year}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h2 className="text-xl font-bold text-white">Tải ứng dụng UniWork</h2>
            <p className="mt-2 text-sm text-brand-50/85">
              Nhận thông báo ngay khi nhà tuyển dụng xem hồ sơ, kể cả lúc không mở web.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-5">
              <div className="grid grid-cols-7 gap-0.5 rounded-lg bg-white p-2.5">
                {Array.from({ length: 49 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-2.5 w-2.5 rounded-[1px]',
                      [
                        0, 1, 2, 5, 6, 7, 9, 11, 13, 14, 16, 18, 20, 21, 23, 24, 26, 28, 30, 33, 35,
                        36, 37, 40, 42, 44, 46, 47, 48,
                      ].includes(i)
                        ? 'bg-slate-900'
                        : 'bg-white',
                    )}
                  />
                ))}
              </div>

              <div className="space-y-2">
                {['App Store', 'Google Play'].map((store) => (
                  <a
                    key={store}
                    href="#"
                    className="card-lift flex w-44 items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2.5 ring-1 ring-white/20"
                  >
                    <Smartphone size={18} className="shrink-0 text-white" />
                    <span>
                      <span className="block text-[10px] text-brand-50/70">Tải về trên</span>
                      <span className="block text-sm font-semibold text-white">{store}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================== CON SỐ ẤN TƯỢNG */}
      <section className="relative overflow-hidden bg-brand-950 px-4 py-14">
        <div className="pattern-hex absolute inset-0" />
        <div className="relative mx-auto max-w-[1180px]">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold text-white">Con số ấn tượng</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-brand-50/75">
              Số liệu mô phỏng phục vụ trình bày đồ án
            </p>
          </Reveal>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: stats.lifetime.jobSearches, label: 'lượt tìm việc' },
              { value: stats.lifetime.studentProfiles, label: 'hồ sơ sinh viên' },
              { value: stats.lifetime.matchedHours, label: 'giờ làm đã ghép' },
              { value: stats.lifetime.jobViews, label: 'lượt xem tin' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="card-lift rounded-2xl bg-white/8 px-5 py-7 text-center ring-1 ring-white/15">
                  <div className="text-gradient-gold text-2xl font-extrabold">
                    <CountUp to={s.value} suffix="+" />
                  </div>
                  <div className="mt-1.5 text-sm text-brand-50/80">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-12 flex flex-col items-center">
              <Earth>
                <button className="pulse-ring relative grid h-20 w-20 place-items-center rounded-full bg-brand-500/30 ring-1 ring-brand-200/50 backdrop-blur-sm transition-[transform,background-color] duration-200 ease-out hover:scale-105 hover:bg-brand-500/45 active:scale-95">
                  <Play size={28} className="ml-1 text-white" fill="currentColor" />
                </button>
              </Earth>
              <p className="mt-4 text-sm text-brand-50/80">Xem video giới thiệu sản phẩm</p>
            </div>
          </Reveal>
        </div>
      </section>

>>>>>>> dev
      {/* ==================================================== HỆ SINH THÁI */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <Reveal>
          <h2 className="text-center text-xl font-bold text-slate-900">Hệ sinh thái UniWork</h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Bốn sản phẩm phục vụ một vòng tuyển dụng
          </p>
        </Reveal>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ECOSYSTEM.map((p, i) => (
            <Reveal key={p.name} delay={i * 70}>
              <div className="card-lift overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className={cn('h-1.5 bg-gradient-to-r', p.color)} />
                <div className="p-5">
                  <h3 className="font-bold text-slate-900">{p.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{p.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ======================================================= BÁO CHÍ */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
          Báo chí nói về UniWork
        </h2>
        <div className="mt-5">
          <Marquee>
            {PRESS.map((p) => (
              <span
                key={p}
                className="flex h-14 w-52 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-400 shadow-sm"
              >
                {p}
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ========================================================== CTA NTD */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-deep px-8 py-10 text-center sm:flex-row sm:text-left">
            <Building2 size={44} className="shrink-0 text-accent-500" />
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">Bạn là nhà tuyển dụng?</h2>
              <p className="mt-1 text-sm text-brand-50/85">
                Đăng tin kèm ca làm cụ thể, hệ thống đưa tin tới đúng sinh viên rảnh khung giờ đó.
              </p>
            </div>
            <Link to="/ntd/dang-tin" className="shrink-0">
              <Button variant="accent" size="lg">
                Đăng tin ngay
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
