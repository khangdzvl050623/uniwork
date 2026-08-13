import { Link } from 'react-router-dom'
import { Briefcase, Facebook, Mail, MapPin, Phone, Youtube } from 'lucide-react'

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
                <Briefcase size={18} />
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
                  <li key={i}>
                    <Link to={link.to} className="text-sm text-slate-500 hover:text-brand-600">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

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
        <div className="mx-auto max-w-[1180px] px-4 text-center text-xs text-slate-400">
          © 2026 UniWork · Đồ án môn học, không phải sản phẩm thương mại · Dữ liệu hiển thị là dữ
          liệu mẫu
        </div>
      </div>
    </footer>
  )
}
