import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Các mảnh dùng chung cho mọi trang bảng trong khu quản trị.
 *
 * Cố ý KHÔNG dựng một component <DataTable columns={...} rows={...} /> tổng
 * quát. Bốn bảng ở đây khác nhau khá nhiều — bảng duyệt tin có cờ cảnh báo,
 * bảng doanh nghiệp có ô giấy tờ, bảng kỹ năng sửa tại chỗ. Nhét hết vào một
 * component thì nó biến thành một mớ props điều kiện, mỗi lần thêm bảng mới lại
 * phải sửa cái dùng chung và có nguy cơ làm vỡ ba bảng còn lại. Chia sẻ phần vỏ
 * và các mảnh nhỏ là đủ, phần thân để mỗi trang tự viết.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="dash-in flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-dash-muted mt-1 text-sm">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-card dash-in overflow-hidden" style={{ animationDelay: '60ms' }}>
      {/* overflow-x-auto nằm ở đây chứ không phải trên <table>: bảng phải tự
          cuộn ngang bên trong card, không được đẩy cả trang rộng ra. */}
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Toolbar({
  placeholder,
  value,
  onChange,
  children,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="border-dash-line flex flex-wrap items-center gap-3 border-b p-4">
      <label className="border-dash-line bg-dash-raised focus-within:border-dash-accent/60 flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 transition-colors duration-150 sm:max-w-xs">
        <Search size={15} className="text-dash-muted shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="placeholder:text-dash-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {children}
    </div>
  )
}

/** Nhóm nút lọc dạng viên thuốc. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  counts?: Partial<Record<T, number>>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium',
            'transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.96]',
            value === opt.value
              ? 'border-dash-accent/45 bg-dash-accent/12 text-dash-accent'
              : 'border-dash-line text-dash-muted hover:border-dash-muted/40 hover:text-dash-text',
          )}
        >
          {opt.label}
          {counts?.[opt.value] !== undefined && (
            <span className="ml-1.5 tabular-nums opacity-70">{counts[opt.value]}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'text-dash-muted border-dash-line border-b px-4 py-3 text-left text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn('border-dash-line border-b px-4 py-3 text-sm', className)}>{children}</td>
  )
}

/**
 * Avatar chữ cái đầu.
 *
 * Màu suy ra từ chính cái tên: cộng mã ký tự rồi chia lấy dư. Cùng một tên luôn
 * ra cùng một màu ở mọi trang và sau mọi lần tải lại. Dùng Math.random thì mỗi
 * lần vẽ lại là một màu khác, và avatar mất luôn tác dụng nhận diện vốn là lý
 * do duy nhất nó tồn tại.
 */
const AVATAR_TOKENS = [
  'var(--dash-teal)',
  'var(--dash-blue)',
  'var(--dash-violet)',
  'var(--dash-orange)',
  'var(--dash-accent)',
]

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const color = AVATAR_TOKENS[sum % AVATAR_TOKENS.length]

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color,
        // color-mix pha ngay trong CSS nên nền nhạt tự bám theo màu chữ, kể cả
        // khi đổi chế độ sáng/tối làm biến màu gốc đổi giá trị.
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-dash-muted px-4 py-14 text-center text-sm">
        {children}
      </td>
    </tr>
  )
}

/** Nút hành động nhỏ trong hàng bảng. */
export function RowAction({
  tone = 'plain',
  onClick,
  children,
}: {
  tone?: 'plain' | 'ok' | 'bad'
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap',
        'transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.95]',
        tone === 'plain' && 'text-dash-muted hover:bg-dash-raised hover:text-dash-text',
        tone === 'ok' && 'text-dash-ok hover:bg-dash-ok/12',
        tone === 'bad' && 'text-dash-bad hover:bg-dash-bad/12',
      )}
    >
      {children}
    </button>
  )
}
