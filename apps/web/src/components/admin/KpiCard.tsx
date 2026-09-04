import { useRef } from 'react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { KpiMetric } from '@uniwork/shared'
import { Sparkline } from '@/components/admin/Charts'
import { useTween } from '@/hooks/useTween'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Ô số liệu ở đầu trang tổng quan.
 *
 * Về thời lượng đếm số: lần đầu vào trang chạy 900ms — đủ chậm để mắt bắt được
 * là con số đang chạy lên chứ không phải đứng yên. Từ lần thứ hai trở đi (người
 * dùng đổi bộ lọc 7 ngày / 30 ngày) rút xuống 300ms, vì lúc này việc đếm không
 * còn giới thiệu gì nữa, nó chỉ đang cản người ta đọc con số mới. Cùng một hiệu
 * ứng, lần đầu là giải thích, lần sau là chướng ngại.
 */
export function KpiCard({
  label,
  metric,
  icon: Icon,
  color,
  /** Đảo ý nghĩa của dấu: với "tin chờ duyệt" thì tăng là tin xấu. */
  invertTone = false,
  hint,
}: {
  label: string
  /**
   * `changePercent` và `series` là TUỲ CHỌN.
   *
   * Không phải để tiện: có những con số chỉ tồn tại ở dạng tổng, chưa có lịch
   * sử theo ngày để mà vẽ xu hướng (số tin đang mở của một nhà tuyển dụng, tổng
   * lượt xem). Bắt buộc hai trường đó thì chỗ gọi buộc phải bịa ra một mảng và
   * một phần trăm — và một mũi tên xanh "↑18%" bịa đặt nằm cạnh con số thật sẽ
   * làm chính con số thật mất đáng tin.
   *
   * Thiếu thì ô chỉ hiện con số. Ít thông tin hơn, nhưng mọi thứ hiện ra đều
   * đúng.
   */
  metric: Pick<KpiMetric, 'value'> & Partial<KpiMetric>
  icon: LucideIcon
  color: string
  invertTone?: boolean
  /** Dòng chú thích nhỏ thay cho phần xu hướng, khi không có dữ liệu so sánh. */
  hint?: string
}) {
  const seen = useRef(false)
  const duration = seen.current ? 300 : 900
  seen.current = true

  const value = useTween(metric.value, duration)
  const coXuHuong = metric.changePercent !== undefined
  const rising = (metric.changePercent ?? 0) >= 0
  const good = invertTone ? !rising : rising

  return (
    <div className="dash-card dash-card-hover group p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-dash-muted text-sm">{label}</p>
        {/* Biểu tượng phình nhẹ khi rê chuột vào card. Đây là phần thưởng cho
            thao tác rê chuột chứ không phải thông tin, nên nó nhỏ và nhanh —
            thứ người ta cảm thấy chứ không phải thứ người ta nhìn thấy. */}
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform duration-200 ease-out group-hover:scale-110"
          style={{
            // color-mix pha nền ngay trong CSS, nên nền nhạt tự bám theo màu
            // biểu tượng kể cả khi đổi chế độ sáng/tối làm biến màu đổi giá trị.
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
            color,
          }}
        >
          <Icon size={16} />
        </span>
      </div>

      <div className="mt-4 text-[28px] leading-none font-bold tabular-nums">
        {formatNumber(Math.round(value))}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs">
        {coXuHuong ? (
          <>
            <span
              className={cn(
                'flex items-center gap-0.5 font-semibold',
                good ? 'text-dash-ok' : 'text-dash-bad',
              )}
            >
              {rising ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(metric.changePercent ?? 0)}%
            </span>
            <span className="text-dash-muted">so với kỳ trước</span>
          </>
        ) : (
          <span className="text-dash-muted">{hint ?? ' '}</span>
        )}
      </div>

      {metric.series && (
        <div className="mt-4">
          <Sparkline values={metric.series} color={color} />
        </div>
      )}
    </div>
  )
}
