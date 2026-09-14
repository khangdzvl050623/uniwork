import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import { PUBLIC_JOB_SORTS, PUBLIC_JOB_SORT_LABELS, type PublicJobSort } from '@uniwork/shared'
import { FilterSidebar, type BoLoc } from '@/components/FilterSidebar'
import { JobCard } from '@/components/JobCard'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useAvailability, useSkills } from '@/hooks/useProfile'
import { chuoiTruyVan, usePublicJobs } from '@/hooks/usePublicJobs'
import { docBoLoc } from '@/lib/bo-loc-url'
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
  /*
   * ---------------------------------------------------------------------------
   * URL LÀ NGUỒN SỰ THẬT CHO BỘ LỌC — KHÔNG GIỮ BẢN SAO TRONG `useState`
   * ---------------------------------------------------------------------------
   * Bản đầu giữ bộ lọc trong `useState` khởi tạo từ URL rồi ghi ngược ra. Hai
   * lỗi thật sinh ra từ đó, cả hai đều do `useState` KHÔNG chạy lại hàm khởi
   * tạo khi component còn sống:
   *
   * 1. Đang ở `/viec-lam?skillIds=c1`, bấm "Việc làm" trên header để về
   *    `/viec-lam` — component không unmount, trạng thái vẫn giữ `skillIds`, và
   *    effect ghi ngược lập tức dán `?skillIds=c1` trở lại. Người dùng bấm xoá
   *    bộ lọc mà bộ lọc tự mọc lại.
   * 2. Nút Back của trình duyệt đổi URL nhưng trạng thái không đổi theo.
   *
   * Bỏ hẳn bản sao thì cả hai biến mất theo — không phải vá, mà là không còn
   * chỗ cho chúng tồn tại.
   */
  const [thamSo, datThamSo] = useSearchParams()

  const boLoc = useMemo(() => docBoLoc(thamSo), [thamSo])
  const sort: PublicJobSort = thamSo.get('sort') === 'match' ? 'match' : 'newest'

  /*
   * `q` là NGOẠI LỆ, cố ý: nó vẫn nằm trong state.
   *
   * Bộ lọc là những cú bấm rời rạc, đẩy thẳng vào URL không sao. Còn ô tìm kiếm
   * thì mỗi phím là một lần đổi — đẩy thẳng vào URL nghĩa là mỗi phím một lần
   * `history.replaceState()`, mà Safari chặn khoảng 100 lần trong 30 giây. Gõ
   * nhanh là trình duyệt bắt đầu bỏ qua, và thanh địa chỉ lệch khỏi ô nhập.
   *
   * Nên `q` gõ vào state, rồi 300ms sau mới hạ xuống URL. Con số 300ms lấy từ
   * `sprint-3.md` (tính năng 2) — chỗ đã đặc tả debounce mà chưa ai làm, nên
   * tới trước hôm nay mỗi phím gõ là một request xuống API.
   */
  const [q, setQ] = useState(() => thamSo.get('q') ?? '')

  /*
   * URL đổi từ bên ngoài (bấm Back, bấm link khác) thì ô tìm kiếm phải theo.
   *
   * Chỉ đồng bộ khi hai bên THẬT SỰ lệch: thiếu phép so này thì mỗi lần
   * `thamSo` đổi vì lý do khác (bấm một bộ lọc) sẽ ghi đè đúng chữ người dùng
   * đang gõ dở.
   */
  const qTrenUrl = thamSo.get('q') ?? ''
  useEffect(() => {
    setQ((dangGo) => (dangGo === qTrenUrl ? dangGo : qTrenUrl))
  }, [qTrenUrl])

  /** Ghi một bộ lọc mới lên URL. Mọi thay đổi bộ lọc đều đi qua đây. */
  function datBoLoc(moi: BoLoc) {
    // `replace` chứ không `push`: đổi bộ lọc không phải một trang mới, và nút
    // Back phải đưa người dùng về nơi họ tới từ đó chứ không phải lùi từng nấc
    // qua mọi lần bấm bộ lọc.
    datThamSo(chuoiTruyVan({ ...moi, q, sort }).replace(/^\?/, ''), { replace: true })
  }

  /*
   * Xoá SẠCH: cả cột lọc lẫn ô tìm kiếm.
   *
   * `datBoLoc({})` không đủ — nó giữ nguyên `q`. Mà `coBoLoc` (thứ quyết định
   * nút này có hiện hay không) lại tính cả `q` là một bộ lọc, nên người tìm
   * "xyzabc" ra 0 kết quả sẽ thấy nút "Xoá bộ lọc", bấm vào, và vẫn 0 kết quả.
   * Một nút không làm được đúng thứ nó ghi trên mặt.
   *
   * `sort` giữ lại: nó không thu hẹp kết quả, nó chỉ đổi thứ tự.
   */
  function xoaHetBoLoc() {
    setQ('')
    datThamSo(chuoiTruyVan({ sort }).replace(/^\?/, ''), { replace: true })
  }

  function datSort(moi: PublicJobSort) {
    datThamSo(chuoiTruyVan({ ...boLoc, q, sort: moi }).replace(/^\?/, ''), { replace: true })
  }

  const [hienLocDiDong, setHienLocDiDong] = useState(false)

  const { user, status: trangThaiDangNhap } = useAuth()
  const laSinhVien = user?.role === 'STUDENT'

  const { data: kyNang } = useSkills()
  // Chỉ hỏi lịch rảnh khi người xem là sinh viên: endpoint đòi vai STUDENT, gọi
  // từ tài khoản khác chỉ nhận 403 cho một thứ không liên quan tới họ.
  const { data: lichRanh, isFetched: daHoiXongLich } = useAvailability({ enabled: laSinhVien })

  const daKhaiLich = Boolean(lichRanh?.slots.length)
  const dungDuocLichRanh = laSinhVien && daKhaiLich

  /*
   * Hạ `q` xuống URL sau 300ms không gõ thêm.
   *
   * `chuoiTruyVan` bỏ `q` rỗng nên xoá sạch ô tìm kiếm cũng tự dọn URL.
   *
   * ⚠ Đây KHÔNG chỉ là chuyện thanh địa chỉ. `qTrenUrl` cũng chính là từ khoá
   * gửi xuống API (xem `usePublicJobs` bên dưới), nên chỗ này là cái duy nhất
   * quyết định bao nhiêu request được bắn đi.
   */
  useEffect(() => {
    if (q === qTrenUrl) return
    const hen = setTimeout(() => {
      datThamSo(chuoiTruyVan({ ...boLoc, q, sort }).replace(/^\?/, ''), { replace: true })
    }, 300)
    return () => clearTimeout(hen)
  }, [q, qTrenUrl, boLoc, sort, datThamSo])

  /*
   * Link chia sẻ có `matchAvailability=true` nhưng người mở KHÔNG dùng được bộ
   * lọc đó (khách, nhà tuyển dụng, hoặc sinh viên chưa khai lịch) thì phải gỡ —
   * không gỡ thì API trả 401/400 và họ thấy một trang lỗi cho việc duy nhất họ
   * làm là bấm vào link bạn gửi. Ô tick cũng đã bị khoá nên họ không tự tắt được.
   *
   * ⚠ NHƯNG PHẢI CHỜ BIẾT CHẮC ĐÃ.
   *
   * Bản đầu gỡ ngay khi `dungDuocLichRanh === false`, mà lúc trang vừa mở thì
   * phiên đăng nhập còn đang kiểm và lịch rảnh còn đang tải — `false` lúc đó
   * nghĩa là "chưa biết", không phải "không dùng được". Kết quả: sinh viên CÓ
   * lịch mở link lọc lịch rảnh thì bộ lọc bị xoá mất trước khi dữ liệu về, và
   * không có gì khôi phục nó.
   *
   * `daBietChac` là điều kiện "đã đủ căn cứ để kết luận":
   * - phiên đăng nhập không còn ở trạng thái `dang-kiem-tra`, VÀ
   * - hoặc không phải sinh viên (khỏi cần hỏi lịch), hoặc đã hỏi xong lịch.
   */
  const daBietChac = trangThaiDangNhap !== 'dang-kiem-tra' && (!laSinhVien || daHoiXongLich)

  useEffect(() => {
    if (daBietChac && !dungDuocLichRanh && boLoc.matchAvailability) {
      datThamSo(
        chuoiTruyVan({ ...boLoc, matchAvailability: undefined, q, sort }).replace(/^\?/, ''),
        { replace: true },
      )
    }
  }, [daBietChac, dungDuocLichRanh, boLoc, q, sort, datThamSo])

  /*
   * ---------------------------------------------------------------------------
   * TRUY VẤN DÙNG `qTrenUrl`, KHÔNG DÙNG `q` ĐANG GÕ
   * ---------------------------------------------------------------------------
   * `q` đổi theo TỪNG PHÍM. `queryKey` của TanStack Query chứa nguyên object
   * này, nên truyền `q` vào đây nghĩa là gõ "gia sư" bắn đi sáu request và tạo
   * sáu cache entry — năm cái đầu bị vứt ngay khi có phím kế tiếp.
   *
   * Bản trước mắc đúng lỗi đó: debounce 300ms chỉ hoãn việc GHI URL, còn truy
   * vấn vẫn chạy mỗi phím. Debounce nằm ở chỗ không ai được lợi.
   *
   * `qTrenUrl` là giá trị ĐÃ LẮNG — nó chỉ đổi sau 300ms không gõ thêm. Ô nhập
   * vẫn phản hồi tức thì vì nó đọc `q`; chỉ có request là chờ.
   *
   * Hệ quả phụ đáng giá: URL và tập kết quả luôn khớp nhau. Chép link ở thanh
   * địa chỉ ra gửi cho người khác thì họ thấy đúng thứ mình đang thấy.
   */
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePublicJobs({ ...boLoc, q: qTrenUrl, sort })

  const jobs = data?.pages.flatMap((page) => page.jobs) ?? []
  const total = data?.pages[0]?.total ?? 0

  const coBoLoc =
    Boolean(q.trim()) ||
    Object.values(boLoc).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Việc làm bán thời gian</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isLoading
          ? 'Đang tải…'
          : `Tìm thấy ${total} tin${total > jobs.length ? ` · đang hiện ${jobs.length}` : ''}`}
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
            onDoi={datBoLoc}
            kyNang={kyNang ?? []}
            dungDuocLichRanh={dungDuocLichRanh}
          />
        </div>

        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
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
                    onClick={() => datSort(s)}
                    disabled={khoa}
                    aria-pressed={sort === s}
                    title={khoa ? 'Khai lịch rảnh để sắp xếp theo độ phù hợp' : undefined}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                      'transition-colors duration-150 ease-out',
                      'active:scale-[0.97] motion-reduce:active:scale-100',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
                      'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
                      sort === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
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
                  onClick={xoaHetBoLoc}
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

          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="min-w-36"
              >
                {isFetchingNextPage ? 'Đang tải…' : 'Tải thêm'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
