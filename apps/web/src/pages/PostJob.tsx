import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import { DISTRICTS, SCHEDULE_TYPE_LABELS, SKILLS, type ScheduleType, type Shift, type SlotId } from '@/data/mock'
import { cn } from '@/lib/utils'

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const inputClass =
  'h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500'

export function PostJob() {
  const [scheduleType, setScheduleType] = useState<ScheduleType>('RECURRING')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [skills, setSkills] = useState<string[]>(['Giao tiếp'])

  const toggleShift = (dayOfWeek: number, slot: SlotId) =>
    setShifts((prev) =>
      prev.some((s) => s.dayOfWeek === dayOfWeek && s.slot === slot)
        ? prev.filter((s) => !(s.dayOfWeek === dayOfWeek && s.slot === slot))
        : [...prev, { dayOfWeek, slot }],
    )

  const toggleSkill = (skill: string) =>
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Đăng tin tuyển dụng</h1>
      <p className="mt-1 text-sm text-slate-500">
        Tin sẽ hiển thị sau khi được quản trị viên duyệt, thường trong vòng 24 giờ
      </p>

      <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader title="Thông tin cơ bản" />
          <div className="space-y-4 px-5 py-5">
            <Row label="Tiêu đề tin">
              <input className={inputClass} placeholder="VD: Phục vụ quán cà phê ca tối" />
            </Row>

            <Row label="Mô tả công việc">
              <textarea
                rows={5}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500"
                placeholder="Mô tả công việc cụ thể, môi trường làm việc, có đào tạo hay không..."
              />
            </Row>

            <div className="grid gap-4 sm:grid-cols-2">
              <Row label="Khu vực">
                <select className={inputClass}>
                  {DISTRICTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Row>
              <Row label="Số lượng cần tuyển">
                <input type="number" min={1} defaultValue={1} className={inputClass} />
              </Row>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Thời gian làm việc" />
          <div className="space-y-4 px-5 py-5">
            <Row label="Loại thời gian">
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScheduleType(key)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                      scheduleType === key
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {SCHEDULE_TYPE_LABELS[key]}
                  </button>
                ))}
              </div>
            </Row>

            {scheduleType === 'RECURRING' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Row label="Cam kết tối thiểu (tháng)" hint="Giúp lọc ra sinh viên còn làm đủ lâu">
                  <input type="number" min={1} defaultValue={3} className={inputClass} />
                </Row>
                <Row label="Số ca tối thiểu mỗi tuần">
                  <input type="number" min={1} defaultValue={3} className={inputClass} />
                </Row>
              </div>
            )}

            {scheduleType === 'SEASONAL' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Row label="Ngày bắt đầu">
                  <input type="date" className={inputClass} />
                </Row>
                <Row label="Ngày kết thúc">
                  <input type="date" className={inputClass} />
                </Row>
              </div>
            )}

            {scheduleType === 'ONE_TIME' && (
              <Row label="Ngày làm việc">
                <input type="date" className={inputClass} />
              </Row>
            )}

            <Row
              label="Ca làm cụ thể"
              hint="Bấm chọn khung giờ. Hệ thống dùng đúng dữ liệu này để tìm sinh viên rảnh."
            >
              <ScheduleGrid selected={shifts} onToggle={toggleShift} />
            </Row>
          </div>
        </Card>

        <Card>
          <CardHeader title="Lương và kỹ năng" />
          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Row label="Lương tối thiểu">
                <input type="number" placeholder="25000" className={inputClass} />
              </Row>
              <Row label="Lương tối đa">
                <input type="number" placeholder="30000" className={inputClass} />
              </Row>
              <Row label="Tính theo">
                <select className={inputClass}>
                  <option>Giờ</option>
                  <option>Ca</option>
                  <option>Tháng</option>
                </select>
              </Row>
            </div>

            <Row label="Kỹ năng yêu cầu">
              <div className="flex flex-wrap gap-1.5">
                {SKILLS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      skills.includes(s)
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-brand-400',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Hạn nhận hồ sơ">
              <input type="date" className={inputClass} />
            </Row>
          </div>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-accent-500/30 bg-accent-50 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-accent-600" />
          <p className="text-sm text-amber-900">
            Tin đăng phải kèm giấy phép kinh doanh hoặc mã số thuế đã xác minh. Tin có dấu hiệu lừa đảo
            sẽ bị gỡ và khoá tài khoản vĩnh viễn.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="lg">
            Lưu nháp
          </Button>
          <Button size="lg">Gửi duyệt</Button>
        </div>
      </form>
    </div>
  )
}
