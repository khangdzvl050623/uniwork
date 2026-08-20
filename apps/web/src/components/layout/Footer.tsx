import { Link } from 'react-router-dom'
import { Facebook, Mail, MapPin, Phone, Youtube, ArrowUpRight } from 'lucide-react'
import { ApiStatus } from '@/components/ApiStatus'
import { UniWorkMark } from '@/components/UniWorkMark'

const COLUMNS = [
  {
    title: 'Về UniWork',
    links: [
      { to: '/', label: 'Giới thiệu' },
      { to: '/', label: 'Điều khoản sử dụng' },
      { to: '/', label: 'Chính sách bảo mật' },
      { to: '/', label: 'Quy chế hoạt động' },
    ],
  },
  {
    title: 'Dành cho sinh viên',
    links: [
      { to: '/viec-lam', label: 'Tìm việc làm' },
      { to: '/lich-ranh', label: 'Khai báo lịch rảnh' },
      { to: '/dang-ky', label: 'Tạo hồ sơ & CV' },
      { to: '/viec-lam', label: 'Việc làm đã lưu' },
    ],
  },
  {
    title: 'Dành cho nhà tuyển dụng',
    links: [
      { to: '/ntd/dang-tin', label: 'Đăng tin tuyển dụng' },
      { to: '/ntd/ung-vien', label: 'Quản lý ứng viên' },
      { to: '/', label: 'Xác minh doanh nghiệp' },
      { to: '/', label: 'Bảng giá dịch vụ' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-slate-200 bg-white">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-brand-50/70 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-sky-50/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-4 py-12 lg:py-5">
        {/* Main footer */}
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr_1fr_1fr] lg:gap-12">
          {/* Brand */}
          <div className="max-w-sm">
            <Link
              to="/"
              className="group inline-flex items-center gap-3"
            >

              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Uni<span className="text-brand-600">Work</span>
              </span>
            </Link>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Nền tảng việc giúp sinh viên tìm kiếm công việc
              phù hợp với lịch rảnh thực tế.
            </p>

            {/* Contact */}
            <ul className="mt-1 space-y-1 text-sm text-slate-500">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                  <MapPin size={14} />
                </span>

                <span className="leading-7">
                  TP. Hồ Chí Minh
                </span>
              </li>

              <li className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                  <Mail size={14} />
                </span>

                <a
                  href="mailto:hotro@uniwork.vn"
                  className="transition-colors hover:text-brand-600"
                >
                  hotro@uniwork.vn
                </a>
              </li>

              <li className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                  <Phone size={14} />
                </span>

                <a
                  href="tel:02812345678"
                  className="transition-colors hover:text-brand-600"
                >
                  (028) 1234 5678
                </a>
              </li>
            </ul>

          </div>

          {/* Columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-slate-900">
                {col.title}
              </h3>

              <div className="mt-3 h-0.5 w-7 rounded-full bg-brand-500" />

              <ul className="mt-4 space-y-3">
                {col.links.map((link, i) => (
                  <li key={i}>
                    <Link
                      to={link.to}
                      className="group inline-flex items-center gap-1 text-sm text-slate-500 transition-all duration-200 hover:translate-x-1 hover:text-brand-600"
                    >
                      <span>{link.label}</span>

                      <ArrowUpRight
                        size={13}
                        className="opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>

      {/* Bottom */}
      <div className="relative border-t border-slate-100 bg-slate-50/80">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span className="text-xs leading-5 text-slate-400">
            © 2026 UniWork 
          </span>

          <div className="flex items-center justify-center sm:justify-end">
            <ApiStatus />
          </div>
        </div>
      </div>
    </footer>
  )
}