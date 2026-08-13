import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 25000 -> "25.000" */
export function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

/** Hiển thị mức lương theo cách người Việt quen đọc. */
export function formatSalary(min: number, max: number, unit: 'HOUR' | 'SHIFT' | 'MONTH') {
  const suffix = { HOUR: '/giờ', SHIFT: '/ca', MONTH: '/tháng' }[unit]
  if (min === max) return `${formatNumber(min)}đ${suffix}`
  return `${formatNumber(min)} - ${formatNumber(max)}đ${suffix}`
}
