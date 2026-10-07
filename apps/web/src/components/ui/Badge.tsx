import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100/80 text-slate-600 border border-slate-200/70',
  brand: 'bg-brand-50 text-brand-700 border border-brand-200/70',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200/70',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
