import { useState } from 'react'
import { Download, Eye, Lock, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { APPLICANTS, STATUS_LABELS, type Applicant } from '@/data/mock'
import { cn } from '@/lib/utils'

const TABS: { key: Applicant['status'] | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xem' },
  { key: 'VIEWED', label: 'Đã xem' },
  { key: 'SHORTLISTED', label: 'Vào vòng trong' },
  { key: 'REJECTED', label: 'Đã từ chối' },
]

const statusTone: Record<Applicant['status'], 'neutral' | 'brand' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  VIEWED: 'brand',
  SHORTLISTED: 'success',
  ACCEPTED: 'success',
  REJECTED: 'danger',
}

export function Applicants() {
  const [tab, setTab] = useState<Applicant['status'] | 'ALL'>('ALL')
  const list = tab === 'ALL' ? APPLICANTS : APPLICANTS.filter((a) => a.status === tab)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Ứng viên</h1>
      <p className="mt-1 text-sm text-slate-500">
        Tin: <strong className="text-slate-700">Phục vụ quán cà phê ca tối</strong> ·{' '}
        {APPLICANTS.length} hồ sơ
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <Search size={15} className="text-slate-400" />
          <input
            placeholder="Tìm ứng viên"
            className="h-9 w-40 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Ứng viên</th>
                <th className="px-5 py-3 font-medium">Kỹ năng</th>
                <th className="px-5 py-3 font-medium">Phù hợp</th>
                <th className="px-5 py-3 font-medium">Ngày nộp</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-900">{a.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {a.university} · Năm {a.year}
                      {a.status !== 'SHORTLISTED' && a.status !== 'ACCEPTED' && (
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <Lock size={11} /> ẩn liên hệ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {a.skills.slice(0, 2).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                      {a.skills.length > 2 && <Badge>+{a.skills.length - 2}</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            a.matchScore >= 85 ? 'bg-emerald-500' : 'bg-accent-500',
                          )}
                          style={{ width: `${a.matchScore}%` }}
                        />
                      </div>
                      <span className="font-medium text-slate-700">{a.matchScore}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{a.appliedAt}</td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        aria-label="Xem hồ sơ"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        aria-label="Tải CV"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {list.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            Chưa có hồ sơ nào ở trạng thái này
          </p>
        )}
      </Card>

      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Lock size={13} />
        Số điện thoại và email của ứng viên chỉ hiển thị sau khi bạn chuyển hồ sơ sang “Vào vòng
        trong”.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline">Từ chối đã chọn</Button>
        <Button>Chuyển vào vòng trong</Button>
      </div>
    </div>
  )
}
