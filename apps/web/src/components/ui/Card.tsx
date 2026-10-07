import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] transition-all duration-200',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100/90 px-6 py-4.5">
      <h2 className="font-bold tracking-tight text-slate-900">{title}</h2>
      {action}
    </div>
  )
}
