import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Info, Loader2, MousePointerClick } from 'lucide-react'
import type { AvailabilitySlot } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { AvailabilityGrid } from '@/components/profile/AvailabilityGrid'
import { useAvailability, useUpdateAvailability } from '@/hooks/useProfile'

const khoa = (s: AvailabilitySlot) => `${s.dayOfWeek}:${s.slot}`

/**
 * Khai lịch rảnh (T61).
 *
 * Toàn bộ lưới được gửi lên trong MỘT request — api thay sạch rồi ghi lại
 * trong một transaction. Cách này đơn giản hơn hẳn so với gửi từng ô một
 * (thêm/xoá), và tránh được trạng thái nửa vời khi mất mạng giữa chừng.
 */
export function Availability() {
  const { data, isLoading } = useAvailability()
  const luu = useUpdateAvailability()

  const [slots, setSlots] = useState<AvailabilitySlot[]>([])

  // Đổ dữ liệu server vào lưới sau khi tải xong. Chỉ chạy khi `data` đổi, nên
  // thao tác đang chỉnh dở của người dùng không bị ghi đè.
  useEffect(() => {
    if (data?.slots) setSlots(data.slots)
  }, [data])

  /*
   * So sánh theo tập hợp, không theo thứ tự mảng.
   *
   * Bỏ chọn một ô rồi chọn lại thì mảng đổi thứ tự nhưng nội dung y hệt ban
   * đầu — so mảng thẳng sẽ bật nút Lưu cho một thay đổi không tồn tại.
   */
  const coThayDoi = useMemo(() => {
    const goc = new Set((data?.slots ?? []).map(khoa))
    return slots.length !== goc.size || slots.some((s) => !goc.has(khoa(s)))
  }, [slots, data])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Lịch rảnh của tôi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Đánh dấu khung giờ bạn có thể đi làm. Hệ thống chỉ gợi ý những ca khớp với lịch này.
      </p>

      <Card className="mt-6">
        <CardHeader
          title="Lịch tuần"
          action={
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
              <MousePointerClick size={13} />
              Kéo chuột để chọn nhiều ô
            </span>
          }
        />

        <div className="px-5 py-5">
          <AvailabilityGrid value={slots} onChange={setSlots} disabled={luu.isPending} />

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-slate-500">
              Đã chọn <strong className="tabular-nums text-slate-800">{slots.length}</strong> khung
              giờ trong tuần
            </p>

            {/* `flex-wrap`: trên màn 320px, hai nút cộng nhãn "Đã lưu" vượt quá
                bề ngang còn lại và đẩy cả trang cuộn ngang. */}
            <div className="flex flex-wrap items-center gap-2">
              {luu.isSuccess && !coThayDoi && !luu.isPending && (
                <span className="animate-in fade-in mr-1 flex items-center gap-1 text-sm text-brand-600 duration-150">
                  <CheckCircle2 size={15} />
                  Đã lưu
                </span>
              )}

              <Button
                variant="outline"
                onClick={() => setSlots([])}
                disabled={slots.length === 0 || luu.isPending}
              >
                Xoá hết
              </Button>

              <Button onClick={() => luu.mutate(slots)} disabled={!coThayDoi || luu.isPending}>
                {luu.isPending && <Loader2 size={15} className="animate-spin" />}
                {luu.isPending ? 'Đang lưu…' : 'Lưu lịch rảnh'}
              </Button>
            </div>
          </div>

          {luu.isError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              Không lưu được lịch rảnh. Kiểm tra mạng rồi thử lại.
            </p>
          )}
        </div>
      </Card>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <div className="text-sm text-brand-900">
          <p className="font-medium">Lịch này áp dụng cho cả học kỳ</p>
          <p className="mt-1 text-brand-800/80">
            Bận đột xuất một buổi thì chưa cần sửa ở đây — tính năng báo bận theo ngày nằm ở sprint
            sau. Sang học kỳ mới, cập nhật lại lưới này cho khớp thời khoá biểu mới.
          </p>
        </div>
      </div>
    </div>
  )
}
