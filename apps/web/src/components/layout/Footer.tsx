import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'

const COLUMNS = [
  {
    title: 'Dành cho sinh viên',
    links: [
      { to: '/viec-lam', label: 'Tìm việc làm' },
      { to: '/lich-ranh', label: 'Khai báo lịch rảnh' },
      { to: '/dang-ky', label: 'Tạo hồ sơ' },
    ],
  },
  {
    title: 'Dành cho nhà tuyển dụng',
    links: [
      { to: '/ntd/dang-tin', label: 'Đăng tin tuyển dụng' },
      { to: '/ntd/ung-vien', label: 'Quản lý ứng viên' },
    ],
  },
  {
    title: 'Về UniWork',
    links: [
      { to: '/', label: 'Giới thiệu' },
      { to: '/', label: 'Điều khoản sử dụng' },
      { to: '/', label: 'Liên hệ' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Briefcase size={16} />
            </span>
            <span className="font-bold text-slate-900">
              Uni<span className="text-brand-600">Work</span>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Nền tảng việc làm bán thời gian ghép theo lịch rảnh thực tế của sinh viên.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-slate-900">{col.title}</h3>
            <ul className="mt-3 space-y-2">
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

      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        Đồ án môn học · Dữ liệu hiển thị là dữ liệu mẫu
      </div>
    </footer>
  )
}
