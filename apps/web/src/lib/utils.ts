import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Gộp class Tailwind, ưu tiên class ghi sau khi có xung đột.
 * clsx lo phần class có điều kiện, twMerge lo phần khử trùng (px-2 px-4 -> px-4).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ISO 8601 -> "13/08/2026".
 *
 * Định dạng theo múi giờ của máy người đọc, không phải theo UTC. Số liệu chốt
 * lúc 02:00 UTC thì ở Việt Nam đã là 09:00 cùng ngày — hiển thị theo UTC sẽ lùi
 * mất một ngày với những mốc chốt vào buổi tối.
 */
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

/** 25000 -> "25.000" */
export function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

/** Hiển thị mức lương theo cách người Việt quen đọc. */
/**
 * Chuỗi lương hiện trên thẻ tin.
 *
 * Nhận `null` cho hai con số vì tin có thể để "Thoả thuận" — khi đó
 * `salaryNegotiable = true` và CHECK trong database bắt cả hai cột phải null.
 * Đơn vị vẫn phải có: "thoả thuận theo giờ" khác "thoả thuận theo tháng".
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  unit: 'HOUR' | 'SHIFT' | 'MONTH',
  negotiable = false,
) {
  const suffix = { HOUR: '/giờ', SHIFT: '/ca', MONTH: '/tháng' }[unit]

  if (negotiable || min === null || max === null) return `Thoả thuận${suffix}`
  if (min === max) return `${formatNumber(min)}đ${suffix}`
  return `${formatNumber(min)} - ${formatNumber(max)}đ${suffix}`
}
