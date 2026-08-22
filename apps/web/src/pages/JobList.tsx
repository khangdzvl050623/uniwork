import { useState } from 'react'
import { Loader2, SlidersHorizontal } from 'lucide-react'
import type { ScheduleType } from '@uniwork/shared'
import { FilterSidebar } from '@/components/FilterSidebar'
import { JobCard } from '@/components/JobCard'
import { Button } from '@/components/ui/Button'
import { usePublicJobs } from '@/hooks/usePublicJobs'

/**
 * Danh sách việc làm công khai (T84).
 *
 * Không đòi đăng nhập — người chưa có tài khoản phải xem được việc làm, nếu
 * không thì trang chủ chẳng có gì để xem và cũng không ai có lý do đăng ký.
 *
 * Bộ lọc giữ trên state chứ chưa đẩy lên URL. Đẩy lên URL (để chia sẻ được một
 * kết quả lọc) chỉ đáng làm khi bộ lọc đã đủ hình dạng cuối ở Sprint 3 — làm
 * bây giờ rồi đổi lại là viết hai lần.
 */
export function JobList() {
  const [district, setDistrict] = useState<string | undefined>()
  const [scheduleType, setScheduleType] = useState<ScheduleType | undefined>()
  const [showFilter, setShowFilter] = useState(false)

  const { data, isLoading, isError } = usePublicJobs({ district, scheduleType })

  const jobs = data?.jobs ?? []
  const total = data?.total ?? 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Việc làm bán thời gian</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isLoading
          ? 'Đang tải…'
          : /*
             * `total` là số tin THẬT khớp bộ lọc, có thể lớn hơn số thẻ đang
             * hiện vì server chặn cứng 100 hàng mỗi lần gọi. Nói rõ ra thay vì
             * để người dùng đếm thẻ rồi tưởng chỉ có bấy nhiêu.
             */
            `Tìm thấy ${total} tin${total > jobs.length ? ` · đang hiện ${jobs.length}` : ''}`}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className={showFilter ? 'block' : 'hidden lg:block'}>
          <FilterSidebar
            district={district}
            scheduleType={scheduleType}
            onDoiDistrict={setDistrict}
            onDoiScheduleType={setScheduleType}
          />
        </div>

        <div>
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setShowFilter((v) => !v)}
            >
              <SlidersHorizontal size={16} />
              Bộ lọc
            </Button>
          </div>

          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 size={26} className="animate-spin text-brand-600" />
            </div>
          )}

          {isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Không tải được danh sách việc làm. Kiểm tra kết nối rồi thử lại.
            </p>
          )}

          {!isLoading && !isError && jobs.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
              <p className="text-sm text-slate-600">
                {district || scheduleType
                  ? 'Không có tin nào khớp bộ lọc hiện tại.'
                  : 'Chưa có tin tuyển dụng nào được đăng.'}
              </p>
              {(district || scheduleType) && (
                <button
                  onClick={() => {
                    setDistrict(undefined)
                    setScheduleType(undefined)
                  }}
                  className="mt-2 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
                >
                  Xoá bộ lọc
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
