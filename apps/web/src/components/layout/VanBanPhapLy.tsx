import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Khung chung cho các trang văn bản dài (chính sách bảo mật, điều khoản).
 *
 * Bề rộng giới hạn ở `max-w-2xl`: dòng chữ dài quá 75–80 ký tự thì mắt khó bắt
 * được đầu dòng kế tiếp khi xuống dòng, và người đọc phải đọc lại. Đây là loại
 * trang không ai muốn đọc sẵn, nên đừng làm nó khó hơn mức cần thiết.
 */
export function VanBan({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon size={20} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </header>

      {/*
        Không dùng plugin `@tailwindcss/typography` chỉ vì hai trang này — thêm
        một phụ thuộc để tạo kiểu cho vài thẻ p/ul là không đáng. Mấy quy tắc
        dưới đây đủ dùng và đọc ra ngay được đang áp cho thẻ nào.
      */}
      <div
        className="space-y-6 text-[15px] leading-7 text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-slate-700 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-slate-800 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
      >
        {children}
      </div>
    </div>
  )
}

/** Một mục có tiêu đề trong văn bản. */
export function Muc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}
