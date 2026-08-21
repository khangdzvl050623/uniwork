import { useEffect } from 'react'
import { BadgeCheck, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { DOCUMENT_TYPES, employerProfileSchema } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { DocumentRow } from '@/components/profile/DocumentRow'
import { useMe, useUpdateEmployerProfile } from '@/hooks/useProfile'
import { useZodForm } from '@/hooks/useZodForm'

/**
 * Hồ sơ nhà tuyển dụng + nộp giấy tờ xác minh (T62).
 *
 * Yêu cầu nghiệp vụ: "nhìn phát biết mình đang thiếu giấy tờ nào". Nên trang
 * này luôn hiện đủ CẢ BA loại giấy tờ, kể cả loại chưa nộp — nếu chỉ liệt kê
 * những giấy đã nộp thì thứ đang thiếu trở nên vô hình, đúng thứ cần thấy nhất.
 */

function TinhTrangXacMinh({
  verifiedAt,
  soGiayDaNop,
}: {
  verifiedAt: string | null
  soGiayDaNop: number
}) {
  if (verifiedAt) {
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <BadgeCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-medium text-brand-900">Doanh nghiệp đã được xác minh</p>
          <p className="mt-0.5 text-sm text-brand-700">
            Tin tuyển dụng của bạn hiển thị công khai với sinh viên.
          </p>
        </div>
      </div>
    )
  }

  const conThieu = DOCUMENT_TYPES.length - soGiayDaNop

  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <Clock size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-medium text-amber-900">Chưa được xác minh</p>
        <p className="mt-0.5 text-sm text-amber-700">
          {conThieu > 0
            ? `Còn thiếu ${conThieu}/${DOCUMENT_TYPES.length} loại giấy tờ. Nộp đủ để admin xét duyệt.`
            : 'Đã nộp đủ giấy tờ, đang chờ admin xét duyệt.'}{' '}
          Trong lúc chờ, bạn vẫn sửa được hồ sơ nhưng chưa đăng tin được.
        </p>
      </div>
    </div>
  )
}

export function EmployerProfile() {
  const { data: me, isLoading } = useMe()
  const luu = useUpdateEmployerProfile()

  const form = useZodForm(employerProfileSchema, {
    companyName: '',
    description: '',
    address: '',
    website: '',
  })

  const dat = form.reset
  useEffect(() => {
    if (!me?.employerProfile) return
    const p = me.employerProfile
    form.setValue('companyName', p.companyName)
    form.setValue('description', p.description ?? '')
    form.setValue('address', p.address ?? '')
    form.setValue('website', p.website ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.employerProfile, dat])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin text-brand-600" />
      </div>
    )
  }

  if (!me?.employerProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-slate-500">
        Tài khoản này không có hồ sơ nhà tuyển dụng.
      </div>
    )
  }

  const hoSo = me.employerProfile

  const gui = (e: React.FormEvent) => {
    e.preventDefault()
    const duLieu = form.validate()
    if (!duLieu) return
    luu.mutate(duLieu as Parameters<typeof luu.mutate>[0], {
      onError: (err) => form.applyServerError(err),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Hồ sơ doanh nghiệp</h1>
        <p className="mt-1 text-sm text-slate-500">{me.email}</p>
      </header>

      <TinhTrangXacMinh verifiedAt={hoSo.verifiedAt} soGiayDaNop={hoSo.documents.length} />

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Thông tin công ty</h2>
          <p className="mt-0.5 mb-4 text-sm text-slate-500">
            Sinh viên thấy phần này ở mỗi tin tuyển dụng của bạn.
          </p>

          <form onSubmit={gui} noValidate className="space-y-4">
            {form.errors._ && (
              <p role="alert" className="text-sm text-red-600">
                {form.errors._}
              </p>
            )}

            <Field
              label="Tên công ty"
              autoComplete="organization"
              placeholder="The Corner Coffee"
              value={String(form.values.companyName ?? '')}
              onChange={(e) => form.setValue('companyName', e.target.value)}
              error={form.errors.companyName}
              disabled={luu.isPending}
            />

            <Field
              label="Địa chỉ"
              autoComplete="street-address"
              placeholder="12 Nguyễn Thị Minh Khai, Quận 1, TP.HCM"
              value={String(form.values.address ?? '')}
              onChange={(e) => form.setValue('address', e.target.value)}
              error={form.errors.address}
              disabled={luu.isPending}
            />

            <Field
              label="Website"
              type="url"
              autoComplete="url"
              placeholder="https://congty.vn"
              hint="Bỏ trống nếu chưa có"
              value={String(form.values.website ?? '')}
              onChange={(e) => form.setValue('website', e.target.value)}
              error={form.errors.website}
              disabled={luu.isPending}
            />

            <div>
              <label htmlFor="mo-ta" className="mb-1.5 block text-sm font-medium text-slate-700">
                Giới thiệu công ty
              </label>
              <textarea
                id="mo-ta"
                rows={4}
                placeholder="Quy mô, lĩnh vực, môi trường làm việc…"
                value={String(form.values.description ?? '')}
                onChange={(e) => form.setValue('description', e.target.value)}
                disabled={luu.isPending}
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
              />
              {form.errors.description && (
                <p role="alert" className="mt-1.5 text-xs text-red-600">
                  {form.errors.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={luu.isPending}>
                {luu.isPending && <Loader2 size={15} className="animate-spin" />}
                {luu.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
              </Button>

              {luu.isSuccess && !luu.isPending && (
                <span className="animate-in fade-in flex items-center gap-1 text-sm text-brand-600 duration-150">
                  <CheckCircle2 size={15} />
                  Đã lưu
                </span>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Giấy tờ xác minh</h2>
          <p className="mt-0.5 mb-4 text-sm text-slate-500">
            Nộp đủ ba loại để admin xét duyệt. Giấy tờ được lưu riêng tư — chỉ bạn và admin xem
            được.
          </p>

          <div className="space-y-3">
            {DOCUMENT_TYPES.map((type) => (
              <DocumentRow
                key={type}
                type={type}
                document={hoSo.documents.find((d) => d.type === type)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
