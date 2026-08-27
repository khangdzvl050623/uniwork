import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import {
  DAY_FULL_LABELS,
  SALARY_UNITS,
  SALARY_UNIT_LABELS,
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_HINTS,
  SCHEDULE_TYPE_LABELS,
  createJobSchema,
  type AvailabilitySlot,
  type CreateJobInput,
  type DayOfWeek,
  type SalaryUnit,
  type ScheduleType,
} from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { LuoiKhungGio } from '@/components/LuoiKhungGio'
import {
  useCreateJob,
  useMyJob,
  useSubmitJob,
  useUpdateJob,
} from '@/hooks/useEmployerJobs'
import { useMe, useSkills } from '@/hooks/useProfile'
import { useZodForm } from '@/hooks/useZodForm'
import { ApiClientError } from '@/lib/api'
import { DISTRICTS } from '@/lib/khu-vuc'
import { cn } from '@/lib/utils'

/**
 * Form đăng tin — dùng chung cho TẠO và SỬA (T73).
 *
 * ---------------------------------------------------------------------------
 * MỘT FORM, HAI CHẾ ĐỘ, PHÂN BIỆT BẰNG `?id=`
 * ---------------------------------------------------------------------------
 * Tách thành hai trang thì hai bản sao của cùng mười lăm ô nhập và cùng bộ luật
 * ẩn/hiện sẽ lệch nhau ngay lần đầu ai đó sửa một bên. Ở đây chỉ khác đúng hai
 * chỗ: dữ liệu ban đầu, và endpoint lúc gửi.
 *
 * ---------------------------------------------------------------------------
 * LUẬT ẨN/HIỆN TRƯỜNG THEO `scheduleType`
 * ---------------------------------------------------------------------------
 * |            | commitmentMonths | startDate | endDate  | workDate | minShifts |
 * |------------|------------------|-----------|----------|----------|-----------|
 * | RECURRING  | tuỳ chọn         | tuỳ chọn  | CẤM      | CẤM      | tuỳ chọn  |
 * | SEASONAL   | CẤM              | BẮT BUỘC  | BẮT BUỘC | CẤM      | tuỳ chọn  |
 * | ONE_TIME   | CẤM              | CẤM       | CẤM      | BẮT BUỘC | CẤM       |
 *
 * Ẩn ô trên form là TRẢI NGHIỆM, không phải ràng buộc — luật thật nằm ở
 * `createJobSchema` phía shared và CHECK `jobs_schedule_fields_check` trong
 * database. Nhưng ẩn cũng không được làm qua loa: đổi loại thời gian mà để lại
 * giá trị cũ trong ô đã ẩn thì form gửi lên một trường bị cấm và người dùng
 * nhận lỗi cho một ô họ không nhìn thấy.
 */

const inputClass =
  'h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500'

function Row({
  label,
  children,
  hint,
  error,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  error?: string
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  )
}

/** Giá trị form — đúng hình dạng `CreateJobInput` để `createJobSchema` kiểm thẳng. */
type GiaTriForm = CreateJobInput

const MAC_DINH: GiaTriForm = {
  title: '',
  description: '',
  requirements: [],
  benefits: [],
  city: 'TP.HCM',
  district: DISTRICTS[0],
  quantity: 1,
  salaryNegotiable: false,
  salaryMin: null,
  salaryMax: null,
  salaryUnit: 'HOUR',
  scheduleType: 'RECURRING',
  commitmentMonths: null,
  minShiftsPerWeek: null,
  startDate: null,
  endDate: null,
  workDate: null,
  deadline: '',
  shifts: [],
  skillIds: [],
}

/** `<input type="date">` cần `yyyy-mm-dd`; API trả ISO đầy đủ. */
function sangNgayForm(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}

/** Ô số để trống phải thành `null`, không phải `0` — `0` là một giá trị có nghĩa. */
function sangSo(v: string): number | null {
  const s = v.trim()
  return s === '' ? null : Number(s)
}

export function PostJob() {
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get('id') ?? undefined
  const dangSua = Boolean(jobId)
  const navigate = useNavigate()

  const { data: tinCu, isLoading: dangTaiTin } = useMyJob(jobId)
  const { data: danhMucKyNang } = useSkills()
  const { data: toi } = useMe()
  const taoTin = useCreateJob()
  const suaTin = useUpdateJob()
  const guiDuyet = useSubmitJob()

  const form = useZodForm(createJobSchema, MAC_DINH)
  const { setValue, reset } = form

  /*
   * Đổ dữ liệu tin cũ vào form một lần khi tải xong.
   *
   * `reset` chứ không phải gán từng ô: gán lẻ sẽ chạy qua nhánh kiểm lỗi của
   * `useZodForm` mười lăm lần và làm form hiện lỗi cho dữ liệu người dùng chưa
   * hề chạm vào.
   */
  useEffect(() => {
    if (!tinCu) return

    reset({
      title: tinCu.title,
      description: tinCu.description,
      requirements: tinCu.requirements,
      benefits: tinCu.benefits,
      city: tinCu.city,
      district: tinCu.district,
      quantity: tinCu.quantity,
      salaryNegotiable: tinCu.salaryNegotiable,
      salaryMin: tinCu.salaryMin,
      salaryMax: tinCu.salaryMax,
      salaryUnit: tinCu.salaryUnit,
      scheduleType: tinCu.scheduleType,
      commitmentMonths: tinCu.commitmentMonths,
      minShiftsPerWeek: tinCu.minShiftsPerWeek,
      startDate: sangNgayForm(tinCu.startDate),
      endDate: sangNgayForm(tinCu.endDate),
      workDate: sangNgayForm(tinCu.workDate),
      deadline: sangNgayForm(tinCu.deadline),
      shifts: tinCu.shifts,
      skillIds: tinCu.skills.map((s) => s.id),
    })
  }, [tinCu, reset])

  /*
   * Đổi loại thời gian thì XOÁ luôn giá trị của những ô vừa bị ẩn.
   *
   * Không xoá thì form gửi lên `endDate` của một tin vừa chuyển sang ONE_TIME —
   * schema chặn, và người dùng nhận lỗi trỏ vào một ô không còn trên màn hình.
   */
  function doiLoaiThoiGian(loai: ScheduleType) {
    setValue('scheduleType', loai)

    if (loai !== 'RECURRING') setValue('commitmentMonths', null)
    if (loai === 'ONE_TIME') setValue('minShiftsPerWeek', null)
    if (loai !== 'SEASONAL') setValue('endDate', null)
    if (loai === 'ONE_TIME') setValue('startDate', null)
    if (loai !== 'ONE_TIME') setValue('workDate', null)
  }

  /*
   * Bật "Thoả thuận" thì xoá hai ô lương.
   *
   * CHECK `jobs_salary_check` cấm trạng thái nửa vời "thoả thuận nhưng vẫn ghi
   * 25000" — đúng kiểu dữ liệu làm bộ lọc lương trả kết quả không ai giải thích
   * được.
   */
  function doiThoaThuan(bat: boolean) {
    setValue('salaryNegotiable', bat)
    if (bat) {
      setValue('salaryMin', null)
      setValue('salaryMax', null)
    }
  }

  const kyNang = useMemo(() => danhMucKyNang ?? [], [danhMucKyNang])
  const loaiHienTai = form.values.scheduleType
  const ntd = toi?.employerProfile

  /**
   * Thứ trong tuần của ngày làm việc — chỉ có nghĩa với tin một buổi.
   *
   * `null` khi chưa chọn ngày, hoặc khi không phải loại ONE_TIME.
   */
  const thuLamViec: DayOfWeek | null = useMemo(() => {
    if (loaiHienTai !== 'ONE_TIME' || !form.values.workDate) return null
    const d = new Date(String(form.values.workDate))
    return Number.isNaN(d.getTime()) ? null : (d.getDay() as DayOfWeek)
  }, [loaiHienTai, form.values.workDate])

  /**
   * Đổi ngày làm việc thì BỎ những ca không còn rơi vào thứ đó.
   *
   * Không bỏ thì người dùng chọn ca Thứ Tư, đổi ngày sang một Thứ Sáu, và form
   * im lặng mang theo một ca Thứ Tư mà lưới đã khoá — họ không nhìn thấy nó
   * nữa nhưng vẫn bị `createJobSchema` chặn với một lỗi trỏ vào chỗ trống.
   */
  function doiNgayLamViec(giaTri: string) {
    setValue('workDate', giaTri || null)

    if (!giaTri) return
    const thu = new Date(giaTri).getDay()
    setValue(
      'shifts',
      form.values.shifts.filter((s) => s.dayOfWeek === thu),
    )
  }

  const dangGui = taoTin.isPending || suaTin.isPending || guiDuyet.isPending

  /** Lỗi cấp form từ server (409, 403…) — lỗi từng trường đã vào `form.errors`. */
  const [loiChung, setLoiChung] = useState<string | null>(null)

  /**
   * Lưu tin, rồi (nếu người dùng chọn) gửi luôn đi duyệt.
   *
   * Gửi duyệt là một endpoint RIÊNG chứ không phải một cờ trong body, vì nó có
   * luật riêng: đòi hồ sơ doanh nghiệp đã xác minh, và đòi hạn nhận hồ sơ chưa
   * qua. Gộp vào bước lưu thì một tin lưu được nhưng gửi duyệt hỏng sẽ để người
   * dùng không biết rốt cuộc đã lưu hay chưa.
   */
  async function luu(guiDuyetLuon: boolean) {
    setLoiChung(null)

    const duLieu = form.validate()
    if (!duLieu) return

    try {
      const tin = dangSua
        ? await suaTin.mutateAsync({ id: jobId!, ...(form.values as CreateJobInput) })
        : await taoTin.mutateAsync(form.values as CreateJobInput)

      if (guiDuyetLuon) await guiDuyet.mutateAsync(tin.id)

      navigate('/ntd/quan-ly')
    } catch (err) {
      if (err instanceof ApiClientError) {
        form.applyServerError(err)
        // Lỗi không gắn được vào ô nào (403 chưa xác minh, 409 tin đã đóng…)
        // thì phải hiện ở đâu đó, nếu không người dùng bấm mà không thấy gì.
        if (!err.details) setLoiChung(err.message)
      }
    }
  }

  if (dangSua && dangTaiTin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">
        {dangSua ? 'Sửa tin tuyển dụng' : 'Đăng tin tuyển dụng'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dangSua && tinCu?.status === 'OPEN'
          ? 'Tin đang hiển thị công khai. Sửa tiêu đề, mô tả, lương, địa điểm, khung giờ hoặc số lượng sẽ đưa tin về chờ duyệt lại.'
          : 'Tin sẽ hiển thị sau khi được quản trị viên duyệt, thường trong vòng 24 giờ'}
      </p>

      {dangSua && tinCu?.rejectionReason && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div className="text-sm text-red-900">
            <p className="font-semibold">Tin đã bị từ chối</p>
            <p className="mt-0.5">{tinCu.rejectionReason}</p>
          </div>
        </div>
      )}

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void luu(false)
        }}
      >
        <Card>
          <CardHeader title="Thông tin cơ bản" />
          <div className="space-y-4 px-5 py-5">
            <Row label="Tiêu đề tin" error={form.errors.title}>
              <input
                value={form.values.title}
                onChange={(e) => setValue('title', e.target.value)}
                className={inputClass}
                placeholder="VD: Phục vụ quán cà phê ca tối"
              />
            </Row>

            <Row label="Mô tả công việc" error={form.errors.description}>
              <textarea
                rows={5}
                value={form.values.description}
                onChange={(e) => setValue('description', e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500"
                placeholder="Mô tả công việc cụ thể, môi trường làm việc, có đào tạo hay không..."
              />
            </Row>

            <div className="grid gap-4 sm:grid-cols-2">
              <Row label="Khu vực" error={form.errors.district}>
                <select
                  value={form.values.district}
                  onChange={(e) => setValue('district', e.target.value)}
                  className={inputClass}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Row>
              <Row label="Số lượng cần tuyển" error={form.errors.quantity}>
                <input
                  type="number"
                  min={1}
                  value={form.values.quantity}
                  onChange={(e) => setValue('quantity', Number(e.target.value))}
                  className={inputClass}
                />
              </Row>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Thời gian làm việc" />
          <div className="space-y-4 px-5 py-5">
            <Row label="Loại thời gian">
              <div className="grid gap-2 sm:grid-cols-3">
                {SCHEDULE_TYPES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => doiLoaiThoiGian(key)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left',
                      'transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]',
                      loaiHienTai === key
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <span className="block text-sm font-medium">{SCHEDULE_TYPE_LABELS[key]}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {SCHEDULE_TYPE_HINTS[key]}
                    </span>
                  </button>
                ))}
              </div>
            </Row>

            {loaiHienTai === 'RECURRING' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Row
                  label="Cam kết tối thiểu (tháng)"
                  hint="Bỏ trống nếu không yêu cầu cam kết"
                  error={form.errors.commitmentMonths}
                >
                  <input
                    type="number"
                    min={1}
                    value={form.values.commitmentMonths ?? ''}
                    onChange={(e) => setValue('commitmentMonths', sangSo(e.target.value))}
                    className={inputClass}
                  />
                </Row>
                <Row label="Số ca tối thiểu mỗi tuần" error={form.errors.minShiftsPerWeek}>
                  <input
                    type="number"
                    min={1}
                    value={form.values.minShiftsPerWeek ?? ''}
                    onChange={(e) => setValue('minShiftsPerWeek', sangSo(e.target.value))}
                    className={inputClass}
                  />
                </Row>
              </div>
            )}

            {loaiHienTai === 'SEASONAL' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Row label="Ngày bắt đầu" error={form.errors.startDate}>
                  <input
                    type="date"
                    value={String(form.values.startDate ?? '')}
                    onChange={(e) => setValue('startDate', e.target.value || null)}
                    className={inputClass}
                  />
                </Row>
                <Row label="Ngày kết thúc" error={form.errors.endDate}>
                  <input
                    type="date"
                    value={String(form.values.endDate ?? '')}
                    onChange={(e) => setValue('endDate', e.target.value || null)}
                    className={inputClass}
                  />
                </Row>
                <Row label="Số ca tối thiểu mỗi tuần" error={form.errors.minShiftsPerWeek}>
                  <input
                    type="number"
                    min={1}
                    value={form.values.minShiftsPerWeek ?? ''}
                    onChange={(e) => setValue('minShiftsPerWeek', sangSo(e.target.value))}
                    className={inputClass}
                  />
                </Row>
              </div>
            )}

            {loaiHienTai === 'ONE_TIME' && (
              <Row
                label="Ngày làm việc"
                hint={
                  thuLamViec === null
                    ? 'Chọn ngày trước, rồi mới chọn được khung giờ bên dưới'
                    : `Khung giờ chỉ chọn được trong ${DAY_FULL_LABELS[thuLamViec]}`
                }
                error={form.errors.workDate}
              >
                <input
                  type="date"
                  value={String(form.values.workDate ?? '')}
                  onChange={(e) => doiNgayLamViec(e.target.value)}
                  className={inputClass}
                />
              </Row>
            )}

            {/*
              "Khung giờ cần người", KHÔNG phải "ca làm cụ thể".

              Đây là khung khai báo chuẩn hoá để ghép với lịch rảnh sinh viên —
              xem `TIME_SLOTS` phía shared. Quán cần người 10:00–16:00 thì chọn
              cả Sáng lẫn Chiều, nghĩa là "ứng viên phải rảnh được trong hai
              khung này", không phải một ca 12 tiếng. Gọi là "ca cụ thể" thì nhà
              tuyển dụng tưởng phải khai đúng giờ vào ca và sẽ khai thiếu.
            */}
            <Row
              label="Khung giờ cần người"
              hint={
                loaiHienTai === 'ONE_TIME'
                  ? thuLamViec === null
                    ? 'Chọn ngày làm việc ở trên trước.'
                    : `Việc một buổi nên chỉ chọn được khung trong ${DAY_FULL_LABELS[thuLamViec]}. Chọn nhiều khung trong ngày đó nếu công việc chạy cả ngày.`
                  : 'Chọn mọi khung bạn cần người — kéo chuột để chọn nhanh nhiều ô. Đây là khung để tìm sinh viên rảnh, giờ vào ca cụ thể hai bên trao đổi sau.'
              }
              error={form.errors.shifts}
            >
              <LuoiKhungGio
                ariaLabel="Chọn khung giờ cần người"
                value={form.values.shifts as AvailabilitySlot[]}
                onChange={(moi) => setValue('shifts', moi)}
                disabled={dangGui}
                /*
                 * Tin một buổi: khoá mọi thứ trừ thứ của ngày làm việc. Chưa
                 * chọn ngày thì khoá cả lưới — chọn ca trước rồi mới chọn ngày
                 * sẽ khiến những ca vừa chọn bị xoá ngay sau đó.
                 */
                ngayChoPhep={
                  loaiHienTai === 'ONE_TIME' ? (thuLamViec === null ? [] : [thuLamViec]) : undefined
                }
              />
            </Row>
          </div>
        </Card>

        <Card>
          <CardHeader title="Lương và kỹ năng" />
          <div className="space-y-4 px-5 py-5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.values.salaryNegotiable}
                onChange={(e) => doiThoaThuan(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="text-sm font-medium text-slate-700">Lương thoả thuận</span>
              <span className="text-xs text-slate-400">
                Chọn khi chưa chốt được con số cụ thể
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <Row label="Lương tối thiểu" error={form.errors.salaryMin}>
                <input
                  type="number"
                  min={0}
                  disabled={form.values.salaryNegotiable}
                  value={form.values.salaryMin ?? ''}
                  onChange={(e) => setValue('salaryMin', sangSo(e.target.value))}
                  placeholder="25000"
                  className={cn(inputClass, 'disabled:bg-slate-50 disabled:text-slate-400')}
                />
              </Row>
              <Row label="Lương tối đa" error={form.errors.salaryMax}>
                <input
                  type="number"
                  min={0}
                  disabled={form.values.salaryNegotiable}
                  value={form.values.salaryMax ?? ''}
                  onChange={(e) => setValue('salaryMax', sangSo(e.target.value))}
                  placeholder="30000"
                  className={cn(inputClass, 'disabled:bg-slate-50 disabled:text-slate-400')}
                />
              </Row>
              <Row
                label="Tính theo"
                // Bắt buộc kể cả khi thoả thuận: "thoả thuận theo giờ" khác
                // "thoả thuận theo tháng", sinh viên cần biết đang mặc cả trên
                // đơn vị nào.
                hint="Vẫn cần chọn khi thoả thuận"
                error={form.errors.salaryUnit}
              >
                <select
                  value={form.values.salaryUnit}
                  onChange={(e) => setValue('salaryUnit', e.target.value as SalaryUnit)}
                  className={inputClass}
                >
                  {SALARY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {SALARY_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </Row>
            </div>

            <Row label="Kỹ năng yêu cầu" error={form.errors.skillIds}>
              <div className="flex flex-wrap gap-1.5">
                {kyNang.map((s) => {
                  const chon = form.values.skillIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setValue(
                          'skillIds',
                          chon
                            ? form.values.skillIds.filter((id) => id !== s.id)
                            : [...form.values.skillIds, s.id],
                        )
                      }
                      className={cn(
                        'rounded-md border px-2.5 py-1.5 text-xs font-medium',
                        'transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]',
                        chon
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-brand-400',
                      )}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </Row>

            <Row label="Hạn nhận hồ sơ" error={form.errors.deadline}>
              <input
                type="date"
                value={String(form.values.deadline ?? '')}
                onChange={(e) => setValue('deadline', e.target.value)}
                className={inputClass}
              />
            </Row>
          </div>
        </Card>

        {/*
          Hai câu này CỐ Ý tách làm hai khối, vì chúng nói với hai người khác nhau.

          Câu về giấy tờ chỉ đúng với nhà tuyển dụng CHƯA xác minh — người đã
          nộp đủ và được admin duyệt mà vẫn bị nhắc "phải kèm giấy phép kinh
          doanh" thì hoặc họ tưởng mình làm thiếu, hoặc họ học được rằng cảnh
          báo trên trang này không đáng đọc. Cả hai đều tệ.

          Câu về tin lừa đảo thì đúng với mọi người, và luôn hiện.
        */}
        {ntd && !ntd.verifiedAt && (
          <div className="flex items-start gap-3 rounded-xl border border-accent-500/30 bg-accent-50 p-4">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-accent-600" />
            <p className="text-sm text-amber-900">
              Hồ sơ doanh nghiệp chưa được xác minh. Bạn vẫn lưu nháp được, nhưng phải nộp giấy
              phép kinh doanh hoặc mã số thuế và chờ duyệt trước khi gửi tin đi.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-600">
            Tin có dấu hiệu lừa đảo — thu phí trước, yêu cầu đặt cọc, mô tả không khớp thực tế — sẽ
            bị gỡ và khoá tài khoản vĩnh viễn.
          </p>
        </div>

        {(loiChung || form.errors._) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loiChung ?? form.errors._}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="submit" variant="outline" size="lg" disabled={dangGui}>
            {dangGui && <Loader2 size={16} className="animate-spin" />}
            Lưu nháp
          </Button>
          <Button type="button" size="lg" disabled={dangGui} onClick={() => void luu(true)}>
            {dangGui && <Loader2 size={16} className="animate-spin" />}
            Gửi duyệt
          </Button>
        </div>
      </form>
    </div>
  )
}
