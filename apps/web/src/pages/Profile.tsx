import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react'
import { studentProfileSchema } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CvUpload } from '@/components/profile/CvUpload'
import { SkillPicker } from '@/components/profile/SkillPicker'
import { useMe, useUpdateStudentProfile } from '@/hooks/useProfile'
import { useZodForm } from '@/hooks/useZodForm'

/**
 * Hồ sơ sinh viên (T59, T60).
 *
 * Chia thành từng thẻ có nút Lưu riêng thay vì một nút Lưu chung ở cuối trang.
 * Lý do: ba khối này gọi ba endpoint khác nhau ở phía api (hồ sơ, kỹ năng, CV),
 * nên một nút chung sẽ phải bắn ba request và xử lý ca "hai cái thành công,
 * một cái hỏng" — trạng thái nửa vời rất khó báo cho người dùng hiểu.
 */

function The({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 mb-4 text-sm text-slate-500">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

function NhacXacThuc() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">Email chưa được xác thực</p>
        <p className="mt-0.5 text-sm text-amber-700">
          Hồ sơ chưa xác thực sẽ không hiện với nhà tuyển dụng.{' '}
          <Link to="/xac-thuc-email" className="font-medium underline">
            Xác thực ngay
          </Link>
        </p>
      </div>
    </div>
  )
}

export function Profile() {
  const { data: me, isLoading } = useMe()
  const luuHoSo = useUpdateStudentProfile()

  const form = useZodForm(studentProfileSchema, {
    university: '',
    major: '',
    // Ô số để trống trả chuỗi rỗng, còn "đã xoá" là `null` — schema phân biệt
    // hai thứ đó, nên kiểu phải mang được cả ba.
    year: '' as string | number | null,
    bio: '',
    phone: '',
    availableUntil: '' as string | Date | null,
    expectedHourlyRate: '' as string | number | null,
  })

  /*
   * Đổ dữ liệu từ server vào form khi tải xong.
   *
   * `reset` không nằm trong deps là có chủ đích — nó ổn định qua các lần render.
   * Đưa `form` vào deps sẽ chạy lại effect ở mỗi lần gõ phím và xoá sạch những
   * gì người dùng vừa nhập.
   */
  const dat = form.reset
  useEffect(() => {
    if (!me?.studentProfile) return
    const p = me.studentProfile
    form.setValue('university', p.university ?? '')
    form.setValue('major', p.major ?? '')
    form.setValue('year', p.year ?? '')
    form.setValue('bio', p.bio ?? '')
    form.setValue('phone', p.phone ?? '')
    // `<input type="date">` chỉ nhận YYYY-MM-DD, không nhận ISO đầy đủ.
    form.setValue('availableUntil', p.availableUntil ? p.availableUntil.slice(0, 10) : '')
    form.setValue('expectedHourlyRate', p.expectedHourlyRate ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.studentProfile, dat])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin text-brand-600" />
      </div>
    )
  }

  if (!me?.studentProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-slate-500">
        Tài khoản này không có hồ sơ sinh viên.
      </div>
    )
  }

  const hoSo = me.studentProfile

  const guiHoSo = (e: React.FormEvent) => {
    e.preventDefault()
    const duLieu = form.validate()
    if (!duLieu) return
    luuHoSo.mutate(duLieu as Parameters<typeof luuHoSo.mutate>[0], {
      onError: (err) => form.applyServerError(err),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Hồ sơ của tôi</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{hoSo.fullName}</span>
          <span aria-hidden>·</span>
          <span>{me.email}</span>
          {me.emailVerifiedAt && (
            <span className="inline-flex items-center gap-1 text-brand-600">
              <CheckCircle2 size={14} />
              Đã xác thực
            </span>
          )}
        </p>
      </header>

      {!me.emailVerifiedAt && <NhacXacThuc />}

      <div className="space-y-5">
        <The title="Thông tin học tập" description="Nhà tuyển dụng dùng phần này để lọc ứng viên.">
          <form onSubmit={guiHoSo} noValidate className="space-y-4">
            {form.errors._ && (
              <p role="alert" className="text-sm text-red-600">
                {form.errors._}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Trường"
                autoComplete="organization"
                placeholder="Đại học Bách khoa TP.HCM"
                value={String(form.values.university ?? '')}
                onChange={(e) => form.setValue('university', e.target.value)}
                error={form.errors.university}
                disabled={luuHoSo.isPending}
              />
              <Field
                label="Ngành"
                placeholder="Công nghệ thông tin"
                value={String(form.values.major ?? '')}
                onChange={(e) => form.setValue('major', e.target.value)}
                error={form.errors.major}
                disabled={luuHoSo.isPending}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/*
                Ô số điện thoại — MỚI ở Sprint 4.

                Cột `phone` có trong `StudentProfile` từ Sprint 0 và được đọc ở
                nhiều nơi, nhưng chưa từng có đường ghi: không nằm trong Zod,
                không nằm trong `update`, không có ô nhập. Cả 6 hồ sơ thật đều
                rỗng — nên cơ chế mở khoá liên hệ của Sprint 4 thực chất chỉ mở
                ra một địa chỉ email.

                `hint` nói thẳng ai thấy và thấy khi nào: xin số điện thoại mà
                không nói dùng làm gì là đúng thứ dự án này muốn thay thế.
              */}
              <Field
                label="Số điện thoại"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0901234567"
                hint="Chỉ hiện với nhà tuyển dụng sau khi họ mời bạn phỏng vấn"
                value={String(form.values.phone ?? '')}
                onChange={(e) => form.setValue('phone', e.target.value)}
                error={form.errors.phone}
                disabled={luuHoSo.isPending}
              />
              <Field
                label="Năm học"
                type="number"
                min={1}
                max={10}
                placeholder="3"
                value={String(form.values.year ?? '')}
                onChange={(e) =>
                  // Ô số trống trả chuỗi rỗng, không phải 0. Ép sang `null` để
                  // schema hiểu là "chưa khai" thay vì "năm học số 0".
                  form.setValue('year', e.target.value === '' ? null : Number(e.target.value))
                }
                error={form.errors.year}
                disabled={luuHoSo.isPending}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/*
                Hai ô MỚI ở Sprint 4, và `availableUntil` là ô quan trọng nhất
                trang này.

                Nó là đầu vào của thành phần `commitment` khi chấm điểm phù hợp.
                Trước đây cột này chỉ `seed.ts` ghi, nên mọi sinh viên đăng ký
                thật đều thiếu — một phần ba công thức không bao giờ chạy, mà
                không có biểu hiện gì vì ba hồ sơ mẫu có sẵn dữ liệu.
              */}
              <Field
                label="Đi làm được tới ngày"
                type="date"
                hint="Dùng để chấm mức phù hợp với tin yêu cầu cam kết dài"
                value={String(form.values.availableUntil ?? '')}
                onChange={(e) => form.setValue('availableUntil', e.target.value)}
                error={form.errors.availableUntil}
                disabled={luuHoSo.isPending}
              />
              <Field
                label="Lương mong muốn (đ/giờ)"
                type="number"
                min={0}
                step={1000}
                placeholder="30000"
                hint="Chưa dùng để lọc — chỉ để nhà tuyển dụng tham khảo"
                value={String(form.values.expectedHourlyRate ?? '')}
                onChange={(e) =>
                  form.setValue(
                    'expectedHourlyRate',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
                error={form.errors.expectedHourlyRate}
                disabled={luuHoSo.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="gioi-thieu"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Giới thiệu bản thân
              </label>
              <textarea
                id="gioi-thieu"
                rows={4}
                placeholder="Vài dòng về kinh nghiệm, điểm mạnh, và loại công việc bạn đang tìm."
                value={String(form.values.bio ?? '')}
                onChange={(e) => form.setValue('bio', e.target.value)}
                disabled={luuHoSo.isPending}
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
              />
              {form.errors.bio && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {form.errors.bio}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={luuHoSo.isPending}>
                {luuHoSo.isPending && <Loader2 size={15} className="animate-spin" />}
                {luuHoSo.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
              </Button>

              {luuHoSo.isSuccess && !luuHoSo.isPending && (
                <span className="animate-in fade-in flex items-center gap-1 text-sm text-brand-600 duration-150">
                  <CheckCircle2 size={15} />
                  Đã lưu
                </span>
              )}
            </div>
          </form>
        </The>

        <The title="CV" description="Nhà tuyển dụng xem CV này khi bạn ứng tuyển.">
          <CvUpload cvUrl={hoSo.cvUrl} />
        </The>

        <The title="Kỹ năng" description="Chọn từ danh mục để tin tuyển dụng khớp đúng với bạn.">
          <SkillPicker daChon={hoSo.skills} />
        </The>

        <The title="Lịch rảnh">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Khai lịch rảnh để hệ thống chỉ gợi ý những ca bạn thật sự đi làm được.
            </p>
            <Link to="/lich-ranh">
              <Button variant="outline" size="sm" type="button">
                <CalendarDays size={15} />
                Khai lịch rảnh
              </Button>
            </Link>
          </div>
        </The>
      </div>
    </div>
  )
}
