import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
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
  Sparkles,
  Truck,
} from 'lucide-react'
import { JobCard } from '@/components/JobCard'
import { HeroAurora } from '@/components/HeroAurora'
import { Earth } from '@/components/Earth'
import { SloganBand } from '@/components/SloganBand'
import { Reveal } from '@/components/Reveal'
import { Marquee } from '@/components/Marquee'
import { CountUp } from '@/components/CountUp'
import { Button } from '@/components/ui/Button'
import { DISTRICTS } from '@/lib/khu-vuc'
import { chuoiTruyVan, usePublicJobs } from '@/hooks/usePublicJobs'
import { useSkills } from '@/hooks/useProfile'
import { useSiteStats } from '@/hooks/useSiteStats'
import { cn } from '@/lib/utils'

/*
 * Chỉ giữ hai tab mà API thật sự làm được.
 *
 * Ba tab cũ — "Phù hợp lịch của bạn", "Lương cao", "Cuối tuần" — đều cần thứ
 * chưa có: phép giao lịch rảnh và sắp xếp theo lương thuộc Sprint 3. Để lại thì
 * bấm vào tab nào cũng ra đúng một danh sách, tức là năm cái nút giả vờ làm năm
 * việc khác nhau.
 */
const JOB_TABS: { label: string; district?: string }[] = [
  { label: 'Việc mới nhất' },
  { label: 'Làm từ xa', district: 'Làm từ xa' },
]

const HERO_POINTS = [
  'Lọc việc theo đúng khung giờ bạn rảnh',
  'Tin đăng đã kiểm duyệt giấy tờ doanh nghiệp',
  'Theo dõi trạng thái hồ sơ, không rơi vào inbox',
  'Miễn phí toàn bộ với sinh viên',
]

const CATEGORIES = [
  { icon: Coffee, label: 'Phục vụ, pha chế', count: 312 },
  { icon: GraduationCap, label: 'Gia sư, trợ giảng', count: 248 },
  { icon: ShoppingBag, label: 'Bán hàng, thu ngân', count: 196 },
  { icon: PartyPopper, label: 'Sự kiện, PG/PB', count: 174 },
  { icon: Laptop, label: 'Nhập liệu, online', count: 158 },
  { icon: Headphones, label: 'Chăm sóc khách hàng', count: 132 },
  { icon: Truck, label: 'Kho vận, giao hàng', count: 97 },
  { icon: BookOpen, label: 'Thiết kế, nội dung', count: 84 },
]

const TOOLS = [
  'Tạo CV cho người chưa kinh nghiệm',
  'Gợi ý việc theo lịch rảnh',
  'Nhắc hạn nộp hồ sơ',
  'Theo dõi trạng thái từng đơn',
  'Cảnh báo tin có dấu hiệu lừa đảo',
  'Thống kê giờ làm mỗi tuần',
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
  const navigate = useNavigate()

  /*
   * Ô tìm kiếm ở hero KHÔNG tự gọi API — nó chuyển sang `/viec-lam` kèm tham số.
   *
   * Trang chủ mà tự vẽ kết quả tìm kiếm thì phải dựng lại toàn bộ thứ
   * `/viec-lam` đã có: phân trang, cột lọc, sắp xếp, trạng thái rỗng. Ô này chỉ
   * là một LỐI VÀO — nhiệm vụ của nó kết thúc ở chỗ điều hướng đúng địa chỉ.
   */
  const [tuKhoa, setTuKhoa] = useState('')
  const [khuVuc, setKhuVuc] = useState('')

  function timViec() {
    // `chuoiTruyVan` là cùng hàm `JobList` dùng để ghi URL, nên link sinh ra ở
    // đây giống hệt link người dùng tự lọc rồi chép từ thanh địa chỉ.
    const duoi = chuoiTruyVan({
      q: tuKhoa.trim() || undefined,
      district: khuVuc || undefined,
    })
    navigate(`/viec-lam${duoi}`)
  }

  /*
   * Chip "Từ khoá phổ biến" lấy từ DANH MỤC kỹ năng, do admin tick ở trang quản
   * trị (`skills.featured`). Trước đây là sáu chuỗi ghi cứng, và bốn trong sáu
   * cái đó — "Phục vụ quán", "Trực page", "Sự kiện", "Nhập liệu" — không hề tồn
   * tại trong danh mục kỹ năng.
   *
   * Nghĩa là chúng KHÔNG lọc theo `skillIds` được. (Chúng vẫn có thể khớp bằng
   * tìm văn bản `q` — "Phục vụ quán" khớp tin "Phục vụ quán cà phê ca tối" —
   * nhưng đó là hai chuyện khác nhau, và tìm văn bản thì khớp cả những tin chỉ
   * tình cờ có cụm chữ đó trong phần mô tả.)
   *
   * Dùng lại `useSkills()` mà cột lọc ở `/viec-lam` đã gọi (cache 30 phút), nên
   * trang chủ không tốn thêm request nào.
   */
  const { data: danhMucKyNang } = useSkills()
  const kyNangNoiBat = (danhMucKyNang ?? []).filter((k) => k.featured)
  // Trang chủ chỉ khoe vài tin đầu; ai muốn xem hết thì sang /viec-lam.
  const { data: duLieuTin } = usePublicJobs({ district: JOB_TABS[jobTab].district })
  const jobs = (duLieuTin?.pages.flatMap((page) => page.jobs) ?? []).slice(0, 6)

  // Mọi con số hiện trên trang này đến từ đây, không chỗ nào ghi cứng. Hôm nay
  // là số mô phỏng, ngày api có endpoint đếm thì chỉ hook đổi — trang chủ không
  // biết và không cần biết nguồn nào.
  const stats = useSiteStats()

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
            <span className="sheen relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-teal-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold text-teal-900 shadow-2xs backdrop-blur-sm sm:text-sm">
              <span className="live-dot relative h-2 w-2 rounded-full bg-teal-500 text-teal-500" />
              <span>
                <CountUp to={stats.activeStudentsThisWeek} duration={1400} /> sinh viên đang tìm ca
                làm trong tuần này
              </span>
            </span>
          </div>

          <h1
            className="hero-rise mx-auto mt-6 max-w-3xl text-center text-3xl sm:text-5xl lg:text-[3.25rem] font-black tracking-tight leading-[1.12] text-slate-900"
            style={{ animationDelay: '80ms' }}
          >
            Việc làm bán thời gian <span className="text-gradient-fresh">khớp đúng lịch học</span>{' '}
            của bạn
          </h1>

          <p
            className="hero-rise mx-auto mt-4 max-w-xl text-center text-sm text-slate-600 sm:text-base font-normal"
            style={{ animationDelay: '140ms' }}
          >
            Khai lịch rảnh một lần. Hệ thống tự động ghép ca phù hợp nhất.
          </p>

          <div
            className="hero-rise mx-auto mt-9 max-w-3xl rounded-[2rem] bg-teal-600/10 p-2 backdrop-blur-md ring-1 ring-teal-200/70 shadow-[0_20px_50px_-20px_rgba(20,184,166,0.2)] transition-all duration-300"
            style={{ animationDelay: '200ms' }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                timViec()
              }}
              className="flex flex-col gap-2 rounded-[1.5rem] bg-white p-2 md:flex-row md:items-center shadow-xs"
            >
              <div className="flex flex-1 items-center gap-2 px-3.5">
                <Search size={18} className="shrink-0 text-slate-400" />
                <input
                  value={tuKhoa}
                  onChange={(e) => setTuKhoa(e.target.value)}
                  placeholder="Vị trí, kỹ năng hoặc tên công ty"
                  aria-label="Từ khoá tìm việc"
                  className="h-12 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 font-medium"
                />
              </div>
              <div className="flex items-center gap-2 px-3.5 md:border-l md:border-slate-200">
                <MapPin size={18} className="shrink-0 text-slate-400" />
                <select
                  value={khuVuc}
                  onChange={(e) => setKhuVuc(e.target.value)}
                  aria-label="Khu vực"
                  className="h-12 w-full cursor-pointer bg-transparent text-sm text-slate-700 font-medium outline-none md:w-44"
                >
                  <option value="">Tất cả khu vực</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="gradient" size="lg" className="shrink-0 md:px-8 rounded-xl shadow-xs group cursor-pointer active:scale-95 transition-all">
                <Search size={17} className="transition-transform duration-200 group-hover:scale-110" />
                Tìm kiếm
              </Button>
            </form>
          </div>

          {kyNangNoiBat.length > 0 && (
            <div
              className="hero-rise mt-5 flex flex-wrap items-center justify-center gap-2 text-sm"
              style={{ animationDelay: '260ms' }}
            >
              <span className="text-slate-500 font-medium">Từ khoá phổ biến:</span>
              {kyNangNoiBat.map((k) => (
                <Link
                  key={k.id}
                  to={`/viec-lam${chuoiTruyVan({ skillIds: [k.id] })}`}
                  className="rounded-full border border-teal-200/70 bg-white/70 px-3.5 py-1.5 font-medium text-slate-700 shadow-2xs backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-teal-400 hover:bg-white hover:text-teal-900 active:scale-[0.96]"
                >
                  {k.name}
                </Link>
              ))}
            </div>
          )}

          {/* Bốn lời hứa */}
          <ul
            className="hero-rise mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs text-slate-600 font-medium"
            style={{ animationDelay: '320ms' }}
          >
            {HERO_POINTS.map((p, i) => (
              <li key={p} className="flex items-center gap-2.5">
                {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-slate-300" />}
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="shrink-0 text-teal-600" />
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Đường lượn khép đáy hero */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0">
          <svg
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            className="block h-[56px] w-full sm:h-[90px]"
          >
            <path
              d="M0 90V44c180 30 360 42 540 26 180-16 360-58 540-58 120 0 240 18 360 40v38z"
              fill="#f8fafc"
            />
          </svg>
        </div>
      </section>

      {/* ==================================================== VIỆC LÀM TỐT NHẤT */}
      <section className="mx-auto mt-7 max-w-[1180px] px-4">
        <Reveal className="rounded-[2rem] border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Việc làm tốt nhất</h2>
            <div className="scroll-x flex gap-1.5 overflow-x-auto">
              {JOB_TABS.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setJobTab(i)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95',
                    jobTab === i
                      ? 'bg-teal-600 text-white shadow-xs font-semibold'
                      : 'border border-teal-100 bg-teal-50/50 text-slate-600 hover:bg-teal-100/60 hover:text-teal-900',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Link
              to="/viec-lam"
              className="ml-auto hidden items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline sm:flex"
            >
              Xem tất cả <ChevronRight size={15} />
            </Link>
          </div>

          <div className="mt-5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
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
              <Button variant="outline" className="rounded-xl shadow-2xs hover:shadow-xs">
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
      <section className="mx-auto mt-6 max-w-[1180px] px-4">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-teal-200/80 bg-gradient-to-br from-teal-50 via-emerald-50/60 to-sky-50/70 p-7 sm:p-10 shadow-sm shadow-teal-900/5">
            <div className="pattern-hex absolute inset-0 opacity-40" />

            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300/70 shadow-2xs">
                  <Sparkles size={12} className="text-amber-600" /> Chỉ có ở UniWork
                </span>
                <h2 className="mt-3 text-2xl leading-snug font-extrabold text-slate-900 sm:text-3xl">
                  Lọc việc theo <span className="text-gradient-fresh">đúng khung giờ</span>
                  <br />
                  bạn còn rảnh
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                  Khai lịch học một lần. Mỗi tin đăng tự chấm điểm phù hợp với lịch của bạn, khỏi
                  ngồi dò từng ca xem có trùng tiết nào không.
                </p>
                <Link to="/lich-ranh" className="mt-6 inline-block">
                  <Button variant="gradient" size="lg" className="rounded-xl shadow-xs group active:scale-95">
                    <CalendarCheck size={16} />
                    Khai lịch rảnh
                    <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>

              {/* Lưới lịch thu nhỏ */}
              <div className="shrink-0">
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 21 }).map((_, i) => {
                    const busy = [3, 5, 10, 12, 17, 19, 20].includes(i)
                    const free = [1, 8, 15].includes(i)
                    return (
                      <span
                        key={i}
                        className={cn(
                          'cell-pop h-7 w-7 rounded-md transition-all',
                          busy
                            ? 'bg-amber-300/90 shadow-2xs'
                            : free
                              ? 'bg-teal-400 shadow-2xs'
                              : 'bg-white/80 border border-slate-200/60',
                        )}
                        style={{ animationDelay: `${240 + i * 22}ms` }}
                      />
                    )
                  })}
                </div>
                <div className="mt-3.5 flex items-center gap-4 text-[11px] text-slate-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Ca cần làm
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Bạn rảnh
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================================================= TOP NGÀNH NGHỀ */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <Reveal>
          <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Top ngành nghề nổi bật</h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Nhóm việc được sinh viên tìm nhiều nhất tháng này
          </p>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.label} delay={i * 45}>
              <Link
                to="/viec-lam"
                className="card-lift group flex h-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-brand-300/80 hover:shadow-xs"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50/80 text-brand-600 transition-all duration-300 group-hover:scale-105 group-hover:bg-brand-500 group-hover:text-white shadow-2xs">
                  <c.icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                    {c.label}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{c.count} tin tuyển</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ==================================================== KHẨU HIỆU */}
      <div className="mt-12">
        <SloganBand />
      </div>

      {/* ============================================ XÂY DỰNG HỒ SƠ CÁ NHÂN */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <Reveal>
          <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Cùng UniWork xây dựng hồ sơ cá nhân
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Tối ưu hoá cơ hội việc làm với bộ công cụ chuẩn hoá dành cho sinh viên
          </p>
        </Reveal>

        <div className="mt-7 grid gap-4.5 lg:grid-cols-[1.4fr_1fr_1fr]">
          <Reveal className="h-full">
            <div className="card-lift flex h-full flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-100/90 via-emerald-100/50 to-sky-100/80 p-7 shadow-xs border border-teal-200/80">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200/80 shadow-2xs backdrop-blur-sm">
                  <FileText size={13} className="text-teal-600" /> Miễn phí
                </span>
                <h3 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">Trình tạo CV sinh viên</h3>
                <p className="mt-2.5 max-w-md text-sm text-slate-700 leading-relaxed font-normal">
                  Mẫu CV dành cho người chưa có kinh nghiệm — tự động điền kỹ năng và lịch rảnh đã
                  khai.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                {['Mẫu tối giản', 'Mẫu có ảnh', 'Mẫu song ngữ'].map((m) => (
                  <span key={m} className="rounded-lg bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-teal-200/80 shadow-2xs">
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
              <div className="card-lift flex h-full flex-col rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-2xs transition-all duration-300 hover:border-brand-300/80 hover:shadow-xs">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 shadow-2xs">
                  <c.icon size={22} />
                </span>
                <h3 className="mt-5 font-bold text-slate-900 text-lg tracking-tight">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{c.desc}</p>
                <Link
                  to="/dang-ky"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Thử ngay <ChevronRight size={15} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================================================== CÔNG CỤ VƯỢT TRỘI */}
      <section className="mx-auto mt-14 max-w-[1180px] px-4">
        <div className="rounded-[2.5rem] bg-gradient-to-b from-brand-50/70 via-emerald-50/40 to-teal-50/20 px-6 py-14 border border-brand-100/80 shadow-2xs">
          <Reveal>
            <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Công cụ vượt trội</h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              Những thứ một job board thông thường không làm cho bạn
            </p>
          </Reveal>

          <div className="mt-9 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-3.5">
              {TOOLS.slice(0, 3).map((t, i) => (
                <Reveal key={t} delay={i * 70}>
                  <div className="card-lift flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs">
                    <CheckCircle2 size={19} className="shrink-0 text-brand-600" />
                    <span className="text-sm font-semibold text-slate-800">{t}</span>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={120} className="mx-auto">
              <div className="relative grid h-44 w-44 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-xl shadow-brand-600/30">
                <div className="pulse-ring absolute inset-0 rounded-full" />
                <Sparkles size={56} className="text-white drop-shadow-md" />
              </div>
            </Reveal>

            <div className="space-y-3.5">
              {TOOLS.slice(3).map((t, i) => (
                <Reveal key={t} delay={i * 70}>
                  <div className="card-lift flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs">
                    <CheckCircle2 size={19} className="shrink-0 text-brand-600" />
                    <span className="text-sm font-semibold text-slate-800">{t}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== CON SỐ ẤN TƯỢNG */}
      <section className="relative overflow-hidden border-y border-teal-100/70 bg-gradient-to-b from-teal-50/50 via-sky-50/30 to-slate-50 px-4 py-14">
        <div className="pattern-hex absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-[1180px]">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold text-slate-900">Con số ấn tượng</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600">
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
                <div className="card-lift rounded-2xl border border-teal-100/80 bg-white p-5 py-7 text-center shadow-xs">
                  <div className="text-3xl font-extrabold bg-gradient-to-r from-teal-600 via-brand-600 to-cyan-600 bg-clip-text text-transparent">
                    <CountUp to={s.value} suffix="+" />
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-slate-600">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-12 flex flex-col items-center">
              <Earth>
                <button className="pulse-ring relative grid h-20 w-20 place-items-center rounded-full bg-teal-500/15 ring-1 ring-teal-400/50 backdrop-blur-sm transition-[transform,background-color] duration-200 ease-out hover:scale-105 hover:bg-teal-500/25 active:scale-95 shadow-sm">
                  <Play size={28} className="ml-1 text-teal-700" fill="currentColor" />
                </button>
              </Earth>
              <p className="mt-4 text-sm font-medium text-slate-600">Xem video giới thiệu sản phẩm</p>
            </div>
          </Reveal>
        </div>
      </section>

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
          <div className="flex flex-col items-center gap-6 rounded-[2rem] border border-teal-200/80 bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-sky-50/70 px-8 py-10 text-center sm:flex-row sm:text-left shadow-xs">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700 shadow-2xs">
              <Building2 size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900">Bạn là nhà tuyển dụng?</h2>
              <p className="mt-1 text-sm text-slate-600">
                Đăng tin kèm ca làm cụ thể, hệ thống đưa tin tới đúng sinh viên rảnh khung giờ đó.
              </p>
            </div>
            <Link to="/ntd/dang-tin" className="shrink-0">
              <Button variant="gradient" size="lg" className="rounded-xl shadow-xs">
                Đăng tin ngay
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
