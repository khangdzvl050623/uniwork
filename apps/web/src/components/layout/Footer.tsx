import { Link } from 'react-router-dom'
<<<<<<< HEAD
import { Facebook, Mail, MapPin, Phone, Youtube, ArrowUpRight } from 'lucide-react'
=======
import { Facebook, Mail, MapPin, Phone, Youtube } from 'lucide-react'
>>>>>>> dev
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

<<<<<<< HEAD
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
=======
const TAGS = [
  'Việc làm part-time TP.HCM',
  'Việc làm ca tối',
  'Gia sư tại nhà',
  'Việc làm cuối tuần',
  'Phục vụ quán cà phê',
  'Việc làm online tại nhà',
  'Nhân viên sự kiện',
  'Trực page bán hàng',
  'Việc làm thời vụ Tết',
  'Trợ giảng tiếng Anh',
  'Nhập liệu tại nhà',
  'Việc làm không cần kinh nghiệm',
]

export function Footer() {
  return (
    <footer className="mt-12 bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-500 text-white">
                <UniWorkMark size={18} />
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                Uni<span className="text-brand-600">Work</span>
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Nền tảng việc làm bán thời gian ghép theo lịch rảnh thực tế của sinh viên.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-500">
              <li className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                Đồ án môn học — Khoa Công nghệ Thông tin
              </li>
              <li className="flex items-center gap-2">
                <Mail size={15} className="shrink-0 text-slate-400" />
                hotro@uniwork.vn
              </li>
              <li className="flex items-center gap-2">
                <Phone size={15} className="shrink-0 text-slate-400" />
                (028) 1234 5678
              </li>
            </ul>

            <div className="mt-4 flex gap-2">
              <a
                href="#"
                aria-label="Facebook"
                className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-600"
              >
                <Facebook size={16} />
              </a>
              <a
                href="#"
                aria-label="Youtube"
                className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-600"
              >
                <Youtube size={16} />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-slate-900">{col.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link, i) => (
                  <li key={i}>ext-brand-600">
                      {link.label}
>>>>>>> dev
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

<<<<<<< HEAD
      </div>

      {/* Bottom */}
                    <Link to={link.to} className="text-sm text-slate-500 hover:t
      <div className="relative border-t border-slate-100 bg-slate-50/80">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span className="text-xs leading-5 text-slate-400">
            © 2026 UniWork 
          </span>

          <div className="flex items-center justify-center sm:justify-end">
            <ApiStatus />
          </div>
=======
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-900">Tìm kiếm nhiều</h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {TAGS.map((tag) => (
              <Link
                key={tag}
                to="/viec-lam"
                className="text-xs text-slate-400 hover:text-brand-600"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50 py-4">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-2 px-4 text-center text-xs text-slate-400 sm:flex-row sm:justify-between sm:text-left">
          <span>
            © 2026 UniWork · Đồ án môn học, không phải sản phẩm thương mại · Dữ liệu hiển thị là dữ
            liệu mẫu
          </span>
          <ApiStatus />
>>>>>>> dev
        </div>
      </div>
    </footer>
  )
<<<<<<< HEAD
}
=======
}
>>>>>>> dev
