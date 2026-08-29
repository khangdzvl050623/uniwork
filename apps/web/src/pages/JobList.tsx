import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  PUBLIC_JOB_SORTS,
  PUBLIC_JOB_SORT_LABELS,
  type PublicJobSort,
} from '@uniwork/shared'
import { FilterSidebar, type BoLoc } from '@/components/FilterSidebar'
import { JobCard } from '@/components/JobCard'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useAvailability, useSkills } from '@/hooks/useProfile'
import { usePublicJobs } from '@/hooks/usePublicJobs'
import { cn } from '@/lib/utils'

/**
 * Danh sách việc làm công khai.
 *
 * Không đòi đăng nhập — người chưa có tài khoản phải xem được việc làm, nếu
 * không thì trang chủ chẳng có gì để xem và cũng không ai có lý do đăng ký.
 *
 * ---------------------------------------------------------------------------
 * MỌI BỘ LỌC CHẠY Ở SERVER, KHÔNG LỌC LẠI Ở ĐÂY
 * ---------------------------------------------------------------------------
 * Kể cả bộ lọc theo lịch rảnh — thứ nhìn qua thì lọc ở trình duyệt được, vì mỗi
 * tin đã mang sẵn `shifts`. Nhưng lọc ở đây thì `total` do server đếm sẽ kể một
 * câu chuyện khác với số thẻ đang hiện, và tới lúc có phân trang thì mỗi trang
 * trả về một số lượng khác nhau sau khi lọc.
 *
 * Trang này chỉ làm hai việc: gom trạng thái bộ lọc, và vẽ thứ server trả về.
 */
export function JobList() {
  const [boLoc, setBoLoc] = useState<BoLoc>({})
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<PublicJobSort>('newest')
  const [hienLocDiDong, setHienLocDiDong] = useState(false)

  const { user } = useAuth()
  const laSinhVien = user?.role === 'STUDENT'

  const { data: kyNang } = useSkills()
  // Chỉ hỏi lịch rảnh khi người xem là sinh viên: endpoint đòi vai STUDENT, gọi
  // từ tài khoản khác chỉ nhận 403 cho một thứ không liên quan tới họ.
  const { data: lichRanh } = useAvailability({ enabled: laSinhVien })

  const daKhaiLich = Boolean(lichRanh?.slots.length)
  const dungDuocLichRanh = laSinhVien && daKhaiLich

  const { data, isLoading, isError, error } = usePublicJobs({ ...boLoc, q, sort })

  const jobs = data?.jobs ?? []
  const total = data?.total ?? 0

  const coBoLoc =
    Boolean(q.trim()) ||
    Object.values(boLoc).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== undefined,
    )

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

      {/*
        Lời mời khai lịch rảnh xuất hiện ĐÚNG MỘT LẦN ở đây, không lặp trên
        từng thẻ tin. Trang này vẽ tới 100 thẻ — nhắc 100 lần thì thành tiếng ồn
        và đẩy nội dung thật xuống dưới.

        Chỉ hiện với sinh viên CHƯA khai lịch: khách chưa đăng nhập thì việc cần
        làm là đăng ký (đã có nút ở header), còn nhà tuyển dụng thì không liên quan.
      */}
      {laSinhVien && !daKhaiLich && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
          <CalendarPlus size={18} className="shrink-0 text-brand-600" />
          <p className="min-w-0 flex-1 text-sm text-slate-700">
            Khai lịch rảnh một lần để xem tin nào khớp giờ của bạn, và lọc theo nó.
          </p>
          <Link
            to="/lich-ranh"
            className={cn(
              'shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white',
              'transition-colors duration-150 ease-out hover:bg-brand-700',
              'active:scale-[0.97] motion-reduce:active:scale-100',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            )}
          >
            Khai lịch rảnh
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className={hienLocDiDong ? 'block' : 'hidden lg:block'}>
          <FilterSidebar
            gaTri={boLoc}
            onDoi={setBoLoc}
            kyNang={kyNang ?? []}
            dungDuocLichRanh={dungDuocLichRanh}
          />
        </div>

        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm tên công việc hoặc mô tả"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-label="Tìm việc làm"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Xoá tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setHienLocDiDong((v) => !v)}
              >
                <SlidersHorizontal size={16} />
                Bộ lọc
              </Button>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3">
            {/*
              Sắp xếp nằm TRÊN danh sách chứ không nằm trong cột lọc: nó không
              thu hẹp kết quả, nó chỉ đổi thứ tự — trộn vào bộ lọc là để người
              dùng đi tìm nó ở sai chỗ.

              "Phù hợp lịch nhất" chỉ bật được khi đã khai lịch rảnh; không có
              lịch thì mọi tin đều chưa đo được điểm và thứ tự thành ngẫu nhiên.
            */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="hidden text-xs text-slate-500 sm:inline">Sắp xếp</span>
              {PUBLIC_JOB_SORTS.map((s) => {
                const khoa = s === 'match' && !dungDuocLichRanh
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    disabled={khoa}
                    aria-pressed={sort === s}
                    title={
                      khoa ? 'Khai lịch rảnh để sắp xếp theo độ phù hợp' : undefined
                    }
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                      'transition-colors duration-150 ease-out',
                      'active:scale-[0.97] motion-reduce:active:scale-100',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
                      'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
                      sort === s
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {PUBLIC_JOB_SORT_LABELS[s]}
                  </button>
                )
              })}
            </div>
          </div>

          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 size={26} className="animate-spin text-brand-600" />
            </div>
          )}

          {isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {/* Hiện câu của server khi có: nó nói đúng chuyện gì sai (ví dụ
                  "Bạn chưa khai lịch rảnh"), hữu ích hơn hẳn một câu chung. */}
              {error instanceof Error && error.message
                ? error.message
                : 'Không tải được danh sách việc làm. Kiểm tra kết nối rồi thử lại.'}
            </p>
          )}

          {!isLoading && !isError && jobs.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
              <p className="text-sm text-slate-600">
                {coBoLoc
                  ? 'Không có tin nào khớp bộ lọc hiện tại.'
                  : 'Chưa có tin tuyển dụng nào được đăng.'}
              </p>
              {coBoLoc && (
                <button
                  type="button"
                  onClick={() => setBoLoc({})}
                  className="mt-2 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
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
