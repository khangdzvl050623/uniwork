import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'outline' | 'ghost' | 'accent' | 'gradient'
// icon / icon-sm là nút chỉ chứa một biểu tượng, không có chữ — cần vuông chứ
// không có padding ngang. Các component của shadcn (dialog, sheet) dùng tới.
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 shadow-sm',
  // Nút chính của các khối nổi bật.
  //
  // Hai điều đáng nói. Một: gradient nằm ở background-image nên vẫn phải khai
  // thêm một background-color đặc bên dưới — trình duyệt nào không dựng được
  // gradient thì chữ trắng vẫn nằm trên nền xanh đậm, không bao giờ trắng trên
  // trắng. Hai: hai điểm dừng đều là bậc đủ tối (brand-600 4.53:1, cyan-700
  // 5.37:1 với chữ trắng), nên chữ đọc rõ ở mọi vị trí dọc dải màu. Gradient
  // sáng hơn thì bắt mắt hơn nhưng chữ ở đầu sáng sẽ mờ đi.
  gradient:
    'bg-brand-600 bg-gradient-to-r from-brand-600 to-cyan-700 text-white shadow-lg shadow-brand-950/30 hover:brightness-110',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        // Nút phải phản hồi ngay lúc ngón tay còn đang ấn xuống, chứ không phải
        // sau khi thả ra. Thu 3% kèm 150ms ease-out là đủ để cảm nhận được mà
        // không ai kịp gọi tên là "animation". Liệt kê thuộc tính tường minh
        // thay vì transition-all: transition-all kéo theo cả những thứ không
        // định làm mượt, ví dụ chiều cao nút khi chữ bên trong đổi.
        'transition-[transform,background-color,border-color,color,filter,box-shadow] duration-150 ease-out',
        'active:scale-[0.97]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
