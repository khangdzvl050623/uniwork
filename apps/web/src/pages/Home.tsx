import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  ChevronRight,
  Coffee,
  FileText,
  GraduationCap,
  Headphones,
  Laptop,
  MapPin,
  PartyPopper,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react'
import { JobCard } from '@/components/JobCard'
import { Button } from '@/components/ui/Button'
import { DISTRICTS, JOBS } from '@/data/mock'
import { cn } from '@/lib/utils'

const TABS = ['Phù hợp lịch của bạn', 'Việc mới nhất', 'Lương cao', 'Làm từ xa', 'Cuối tuần']

const HOT_KEYWORDS = ['Phục vụ quán', 'Gia sư', 'Trực page', 'Sự kiện', 'Nhập liệu', 'Bán hàng']

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
  { icon: CalendarCheck, title: 'Lịch rảnh thông minh', desc: 'Khai một lần, dùng cả học kỳ' },
  { icon: FileText, title: 'Tạo CV sinh viên', desc: 'Mẫu CV cho người chưa kinh nghiệm' },
  { icon: BarChart3, title: 'Điểm phù hợp', desc: 'Biết mình hợp bao nhiêu phần trăm' },
  { icon: ShieldCheck, title: 'Tin đã kiểm duyệt', desc: 'Doanh nghiệp xác minh giấy tờ' },
]

const COMPANIES = [
  { name: 'The Corner Coffee', initial: 'C', color: 'bg-amber-500' },
  { name: 'Trung tâm Trí Việt', initial: 'T', color: 'bg-brand-600' },
  { name: 'Sao Việt Event', initial: 'S', color: 'bg-rose-500' },
  { name: 'DataLine Việt Nam', initial: 'D', color: 'bg-teal-600' },
  { name: 'Siêu thị Minh Phát', initial: 'M', color: 'bg-emerald-600' },
  { name: 'Anh ngữ Sunrise', initial: 'A', color: 'bg-indigo-500' },
]

export function Home() {
  const [tab, setTab] = useState(0)
  const jobs = tab === 0 ? [...JOBS].sort((a, b) => b.matchScore - a.matchScore) : JOBS

  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="bg-brand-deep px-4 pt-8 pb-10">
        <div className="mx-auto max-w-[1180px]">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-lg md:flex-row"
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                placeholder="Vị trí, kỹ năng hoặc tên công ty"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 px-3 md:border-l md:border-slate-200">
              <MapPin size={18} className="shrink-0 text-slate-400" />
              <select className="h-10 w-full bg-transparent text-sm text-slate-600 outline-none md:w-44">
                <option value="">Tất cả khu vực</option>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="lg" className="shrink-0 md:px-8">
              <Search size={17} />
              Tìm kiếm
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-brand-100/80">Từ khoá phổ biến:</span>
            {HOT_KEYWORDS.map((k) => (
              <Link
                key={k}
                to="/viec-lam"
                className="rounded-full border border-white/25 px-3 py-1 text-brand-50 transition-colors hover:bg-white/10"
              >
                {k}
              </Link>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <div className="rounded-xl bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-sm">
              <h1 className="text-2xl font-extrabold leading-snug text-white sm:text-3xl">
                Tìm việc bán thời gian
                <br />
                <span className="text-accent-500">khớp đúng lịch học</span> của bạn
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-brand-50/85">
                Hơn 1.200 tin tuyển dụng đã kiểm duyệt từ các doanh nghiệp xác minh giấy tờ. Khai báo
                khung giờ rảnh một lần, hệ thống lọc sẵn việc bạn đi làm được.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/lich-ranh">
                  <Button variant="accent">
                    <CalendarCheck size={16} />
                    Khai lịch rảnh
                  </Button>
                </Link>
                <Link to="/viec-lam">
                  <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    Xem việc làm
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['1.240+', 'tin đang tuyển'],
                ['3.800+', 'sinh viên'],
                ['420+', 'doanh nghiệp'],
                ['48h', 'phản hồi trung bình'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="flex flex-col justify-center rounded-xl bg-white/10 px-4 py-5 ring-1 ring-white/15"
                >
                  <div className="text-2xl font-extrabold text-white">{value}</div>
                  <div className="mt-0.5 text-xs text-brand-50/80">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------- Việc làm tốt nhất ------------------------- */}
      <section className="mx-auto mt-8 max-w-[1180px] px-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Việc làm tốt nhất</h2>
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    tab === i
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

          <div className="mt-5 text-center">
            <Link to="/viec-lam">
              <Button variant="outline">
                Xem thêm việc làm <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* --------------------- Nhà tuyển dụng tiêu biểu --------------------- */}
      <section className="mx-auto mt-6 max-w-[1180px] px-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Nhà tuyển dụng tiêu biểu</h2>
            <Link
              to="/viec-lam"
              className="ml-auto hidden items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex"
            >
              Xem tất cả <ChevronRight size={15} />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COMPANIES.map((c) => (
              <div
                key={c.name}
                className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:border-brand-400"
              >
                <span
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-lg text-lg font-bold text-white',
                    c.color,
                  )}
                >
                  {c.initial}
                </span>
                <span className="text-xs font-medium leading-tight text-slate-600">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------ Dải thống kê xanh ------------------------ */}
      <section className="mt-10 bg-brand-deep px-4 py-12">
        <div className="mx-auto max-w-[1180px]">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-white">Thị trường việc làm sinh viên</h2>
            <p className="mt-2 text-sm text-brand-50/80">Cập nhật 13/08/2026</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ['3.342', 'lượt ứng tuyển tuần này'],
              ['48.692', 'giờ làm đã ghép thành công'],
              ['16.996', 'lượt xem tin tuyển dụng'],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl bg-white/10 px-5 py-6 text-center ring-1 ring-white/15"
              >
                <div className="text-3xl font-extrabold text-accent-500">{value}</div>
                <div className="mt-1 text-sm text-brand-50/85">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------- Top ngành nghề nổi bật --------------------- */}
      <section className="mx-auto mt-10 max-w-[1180px] px-4">
        <h2 className="text-center text-xl font-bold text-slate-900">Top ngành nghề nổi bật</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              to="/viec-lam"
              className="group flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <c.icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{c.label}</span>
                <span className="text-xs text-slate-400">{c.count} tin tuyển</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------- Công cụ ----------------------------- */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles size={13} /> Dành riêng cho sinh viên
            </span>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Công cụ hỗ trợ tìm việc</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((t) => (
              <div
                key={t.title}
                className="rounded-xl border border-slate-200 p-5 transition-colors hover:border-brand-400"
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-500 text-white">
                  <t.icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- CTA cuối ---------------------------- */}
      <section className="mx-auto mt-12 max-w-[1180px] px-4">
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-deep px-8 py-10 text-center sm:flex-row sm:text-left">
          <Building2 size={44} className="shrink-0 text-accent-500" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Bạn là nhà tuyển dụng?</h2>
            <p className="mt-1 text-sm text-brand-50/85">
              Đăng tin kèm ca làm cụ thể, hệ thống đưa tin tới đúng sinh viên rảnh khung giờ đó. Miễn phí
              hoàn toàn cho tin đầu tiên.
            </p>
          </div>
          <Link to="/ntd/dang-tin" className="shrink-0">
            <Button variant="accent" size="lg">
              Đăng tin ngay
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
