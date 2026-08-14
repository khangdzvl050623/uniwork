import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { FilterSidebar } from '@/components/FilterSidebar'
import { JobCard } from '@/components/JobCard'
import { Button } from '@/components/ui/Button'
import { JOBS } from '@/data/mock'

export function JobList() {
  const [onlyMatching, setOnlyMatching] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  // Bản tĩnh: lọc tạm theo điểm phù hợp. Sprint 3 sẽ thay bằng truy vấn giao lịch thật.
  const jobs = onlyMatching ? JOBS.filter((j) => j.matchScore >= 80) : JOBS

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Việc làm bán thời gian</h1>
      <p className="mt-1 text-sm text-slate-500">Tìm thấy {jobs.length} tin phù hợp</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className={showFilter ? 'block' : 'hidden lg:block'}>
          <FilterSidebar onlyMatchingSchedule={onlyMatching} onToggleMatching={setOnlyMatching} />
        </div>

        <div>
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setShowFilter((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              Bộ lọc
            </Button>

            <select className="ml-auto h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none">
              <option>Phù hợp nhất</option>
              <option>Mới nhất</option>
              <option>Lương cao nhất</option>
              <option>Sắp hết hạn</option>
            </select>
          </div>

          <div className="grid gap-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {jobs.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <p className="font-medium text-slate-600">Không có việc nào khớp lịch rảnh của bạn</p>
              <p className="mt-1 text-sm text-slate-400">
                Thử bỏ bớt bộ lọc hoặc cập nhật lại lịch rảnh
              </p>
            </div>
          )}

          <nav className="mt-6 flex items-center justify-center gap-1">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className={
                  p === 1
                    ? 'h-9 w-9 rounded-lg bg-brand-600 text-sm font-medium text-white'
                    : 'h-9 w-9 rounded-lg text-sm text-slate-600 hover:bg-slate-100'
                }
              >
                {p}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
