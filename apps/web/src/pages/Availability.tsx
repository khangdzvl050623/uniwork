import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import type { Shift, SlotId } from '@/data/mock'

const INITIAL: Shift[] = [
  { dayOfWeek: 2, slot: 'evening' },
  { dayOfWeek: 4, slot: 'evening' },
  { dayOfWeek: 6, slot: 'afternoon' },
  { dayOfWeek: 6, slot: 'evening' },
]

export function Availability() {
  const [shifts, setShifts] = useState<Shift[]>(INITIAL)

  const toggle = (dayOfWeek: number, slot: SlotId) => {
    setShifts((prev) => {
      const exists = prev.some((s) => s.dayOfWeek === dayOfWeek && s.slot === slot)
      return exists
        ? prev.filter((s) => !(s.dayOfWeek === dayOfWeek && s.slot === slot))
        : [...prev, { dayOfWeek, slot }]
    })
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Lịch rảnh của tôi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Bấm vào ô để đánh dấu khung giờ bạn có thể đi làm
      </p>

      <Card className="mt-6">
        <CardHeader
          title="Học kỳ 1 năm học 2026 – 2027"
          action={<span className="text-xs text-slate-400">Áp dụng từ 01/09/2026 đến 15/01/2027</span>}
        />
        <div className="px-5 py-5">
          <ScheduleGrid selected={shifts} onToggle={toggle} />

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-slate-500">
              Đã chọn <strong className="text-slate-800">{shifts.length}</strong> khung giờ trong tuần
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShifts([])}>
                Xoá hết
              </Button>
              <Button>Lưu lịch rảnh</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <div className="text-sm text-brand-900">
          <p className="font-medium">Lịch này áp dụng cho cả học kỳ</p>
          <p className="mt-1 text-brand-800/80">
            Bận đột xuất một buổi thì không cần sửa ở đây — vào mục{' '}
            <strong>Báo bận theo ngày</strong> để đánh dấu riêng ngày đó. Sang học kỳ mới, tạo lịch
            mới thay vì sửa đè lên lịch cũ.
          </p>
        </div>
      </div>
    </div>
  )
}
