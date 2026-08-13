import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, ClipboardList, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { SearchBar } from '@/components/SearchBar'
import { JobCard } from '@/components/JobCard'
import { Button } from '@/components/ui/Button'
import { AvailabilityBanner } from '@/components/layout/Header'
import { JOBS } from '@/data/mock'

const QUICK_FILTERS = ['Ca tối', 'Cuối tuần', 'Làm từ xa', 'Gia sư', 'Phục vụ quán', 'Sự kiện']

const STEPS = [
  {
    icon: CalendarCheck,
    title: 'Khai lịch rảnh',
    desc: 'Chọn khung giờ trống theo từng thứ trong tuần. Sang học kỳ mới chỉ cần cập nhật lại.',
  },
  {
    icon: ClipboardList,
    title: 'Nhận việc khớp lịch',
    desc: 'Hệ thống chỉ hiện tin có ca làm nằm gọn trong giờ rảnh của bạn, kèm điểm phù hợp.',
  },
  {
    icon: UserRoundCheck,
    title: 'Ứng tuyển và theo dõi',
    desc: 'Biết rõ nhà tuyển dụng đã xem chưa, đang cân nhắc hay đã quyết định. Không rơi vào inbox.',
  },
]

export function Home() {
  const matching = [...JOBS].sort((a, b) => b.matchScore - a.matchScore).slice(0, 4)
  const latest = JOBS.slice(0, 4)

  return (
    <>
      <AvailabilityBanner />

      <section className="bg-linear-to-b from-brand-900 to-brand-800 px-4 pt-14 pb-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Việc làm bán thời gian <span className="text-accent-500">khớp lịch học</span> của bạn
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-brand-100">
            Khai báo giờ rảnh một lần, UniWork lọc sẵn những việc bạn thật sự đi làm được — không phải
            đọc từng tin rồi tự đối chiếu thời khoá biểu.
          </p>

          <div className="mt-8">
            <SearchBar />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {QUICK_FILTERS.map((f) => (
              <Link
                key={f}
                to="/viec-lam"
                className="rounded-full border border-white/25 px-3 py-1.5 text-sm text-brand-50 transition-colors hover:bg-white/10"
              >
                {f}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
          {[
            ['1.240', 'tin đang tuyển'],
            ['3.800', 'sinh viên'],
            ['92%', 'tin được duyệt'],
            ['48h', 'phản hồi trung bình'],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-brand-700">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Phù hợp lịch rảnh của bạn</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dựa trên khung giờ bạn đã khai trong học kỳ này
            </p>
          </div>
          <Link
            to="/viec-lam"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex"
          >
            Xem tất cả <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {matching.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <h2 className="text-center text-xl font-bold text-slate-900">UniWork hoạt động thế nào</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <step.icon size={22} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                {i + 1}. {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Việc làm mới nhất</h2>
          <Link
            to="/viec-lam"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:flex"
          >
            Xem tất cả <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {latest.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-slate-900 px-6 py-10 text-center sm:flex-row sm:text-left">
          <ShieldCheck size={40} className="shrink-0 text-accent-500" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Bạn là nhà tuyển dụng?</h2>
            <p className="mt-1 text-sm text-slate-300">
              Đăng tin kèm ca làm cụ thể, hệ thống tự đưa tin tới đúng sinh viên rảnh khung giờ đó. Tin
              được kiểm duyệt trước khi hiển thị.
            </p>
          </div>
          <Link to="/ntd/dang-tin" className="shrink-0">
            <Button variant="accent" size="lg">
              Đăng tin miễn phí
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
