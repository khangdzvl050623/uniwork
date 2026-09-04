import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BriefcaseBusiness,
  Download,
  Loader2,
  Lock,
  Mail,
  Phone,
  PhoneCall,
  Quote,
} from 'lucide-react'
import {
  APPLICATION_ACTION_LABELS,
  APPLICATION_STATUS_LABELS,
  TRANG_THAI_DANG_XU_LY,
  VIEC_TIEP_THEO,
  type ApplicantItem,
  type ApplicationStatus,
} from '@uniwork/shared'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChipPhuHop } from '@/components/ChipPhuHop'
import { DialogTuChoi } from '@/components/DialogTuChoi'
import { useApplicants, useUpdateApplicationStatus } from '@/hooks/useApplications'
import { useMyJobs } from '@/hooks/useEmployerJobs'
import { cn } from '@/lib/utils'

const TABS: { key: ApplicationStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xem' },
  { key: 'VIEWED', label: 'Đã xem' },
  { key: 'SHORTLISTED', label: 'Đã mời phỏng vấn' },
  // Chỉ hiện khi còn hàng cũ ở trạng thái này — tab rỗng tự ẩn.
  { key: 'ACCEPTED', label: 'Đã nhận' },
  { key: 'REJECTED', label: 'Đã từ chối' },
  { key: 'WITHDRAWN', label: 'Đã rút' },
]

const statusTone: Record<ApplicationStatus, 'neutral' | 'brand' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  VIEWED: 'brand',
  SHORTLISTED: 'success',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
}

export function Applicants() {
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job') ?? undefined
  const [tab, setTab] = useState<ApplicationStatus | 'ALL'>('ALL')

  const { data: tinCuaToi } = useMyJobs()
  const { data, isPending, isError, error } = useApplicants(jobId, {
    status: tab === 'ALL' ? undefined : tab,
  })

  /* Chưa chọn tin: trang này vào được từ menu mà không mang jobId, nên nó phải
     tự hỏi "ứng viên của tin nào" thay vì gọi API thiếu tham số. */
  if (!jobId) {
    return <ChonTin jobs={tinCuaToi?.jobs ?? []} onChon={(id) => setParams({ job: id })} />
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-slate-300" size={28} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-sm text-rose-600">
          {error instanceof Error ? error.message : 'Không tải được danh sách ứng viên'}
        </p>
        <button
          onClick={() => setParams({})}
          className="mt-3 text-sm text-brand-700 underline"
        >
          Chọn tin khác
        </button>
      </div>
    )
  }

  const { applicants, jobTitle, demTheoTrangThai } = data
  const tong = Object.values(demTheoTrangThai).reduce((a, b) => a + b, 0)
  const dangXuLy = TRANG_THAI_DANG_XU_LY.reduce((s, t) => s + demTheoTrangThai[t], 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Ứng viên</h1>
      <p className="mt-1 text-sm text-slate-500">
        Tin: <strong className="text-slate-700">{jobTitle}</strong> · {tong} hồ sơ
        {dangXuLy > 0 && <> · {dangXuLy} đang chờ bạn xử lý</>} ·{' '}
        <button onClick={() => setParams({})} className="text-brand-700 underline">
          đổi tin
        </button>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const so = t.key === 'ALL' ? tong : demTheoTrangThai[t.key]
          // Ẩn tab rỗng, TRỪ các tab đang xử lý — chúng phải hiện số 0 để nhà
          // tuyển dụng biết mình đã xử lý hết, chứ không phải tab biến mất.
          if (so === 0 && t.key !== 'ALL' && !TRANG_THAI_DANG_XU_LY.includes(t.key)) return null

          return (
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
              <span className={cn('ml-1.5', tab === t.key ? 'text-white/70' : 'text-slate-400')}>
                {so}
              </span>
            </button>
          )
        })}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Ứng viên</th>
                <th className="px-5 py-3 font-medium">Phù hợp</th>
                <th className="px-5 py-3 font-medium">Ngày nộp</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicants.map((a) => (
                <HangUngVien key={a.id} a={a} jobId={jobId} />
              ))}
            </tbody>
          </table>
        </div>

        {applicants.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            Chưa có hồ sơ nào ở trạng thái này
          </p>
        )}
      </Card>

      <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
        <Lock size={13} className="mt-0.5 shrink-0" />
        <span>
          Số điện thoại và email chỉ mở khi bạn bấm <strong>Mời phỏng vấn</strong>. Từ đó việc tuyển
          diễn ra giữa bạn và ứng viên — UniWork không theo dõi buổi gặp hay kết quả. Chỉ khi bạn
          quyết định <strong>không</strong> chọn ai đó, hãy quay lại bấm Từ chối: rất nhiều nơi im
          lặng luôn, và sinh viên chờ mãi một câu trả lời không bao giờ tới.
        </span>
      </p>
    </div>
  )
}

/* ==================================================================== */

function HangUngVien({ a, jobId }: { a: ApplicantItem; jobId: string }) {
  const doi = useUpdateApplicationStatus(jobId)
  const [moTuChoi, setMoTuChoi] = useState(false)

  /*
   * Nút hiện đúng bằng `buocTiepTheo` SERVER trả về, không tự tra bảng chuyển
   * trạng thái ở web. Hai bên cùng đọc một bảng vẫn có thể lệch khi web dùng
   * bản cũ đang cache — và lệch ở đây nghĩa là mời người dùng bấm một nút server
   * sẽ từ chối.
   */
  const buoc = a.buocTiepTheo

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-4 align-top">
        <div className="font-medium text-slate-900">{a.fullName}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {[a.university, a.major, a.year && `Năm ${a.year}`].filter(Boolean).join(' · ')}
        </div>

        {a.coverLetter && <ThuNgo noiDung={a.coverLetter} />}

        {a.skills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {a.skills.slice(0, 3).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
            {a.skills.length > 3 && <Badge>+{a.skills.length - 3}</Badge>}
          </div>
        )}

        {/*
          Liên hệ: hiện Ô KHOÁ chứ không giấu hẳn.

          Giấu hẳn thì nhà tuyển dụng không biết thông tin đó tồn tại, cũng không
          biết cách mở. Ô khoá vừa nói có, vừa nói làm gì để có.
        */}
        {/* Việc phải làm NGOÀI ứng dụng.

            Đây là lỗ hổng của bản đầu: bấm xong thì màn hình im lặng, không ai
            nói cho nhà tuyển dụng biết bước kế là gọi điện. App không sắp lịch
            hộ được — nhưng ít nhất phải nói rằng tới lượt họ. */}
        {VIEC_TIEP_THEO[a.status] && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-brand-50 p-2 text-xs text-brand-800">
            <PhoneCall size={12} className="mt-0.5 shrink-0" />
            {VIEC_TIEP_THEO[a.status]}
          </p>
        )}

        <div className="mt-2 text-xs">
          {a.contact ? (
            <div className="flex flex-wrap items-center gap-3 text-slate-600">
              {a.contact.phone && (
                <a href={`tel:${a.contact.phone}`} className="flex items-center gap-1 hover:underline">
                  <Phone size={12} /> {a.contact.phone}
                </a>
              )}
              <a
                href={`mailto:${a.contact.email}`}
                className="flex items-center gap-1 hover:underline"
              >
                <Mail size={12} /> {a.contact.email}
              </a>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-slate-400">
              <Lock size={11} /> Liên hệ mở khi bạn bấm “Mời phỏng vấn”
            </span>
          )}
        </div>
      </td>

      {/*
        Cột "Phù hợp" hiện CHI TIẾT, không hiện con số tổng hợp.

        Con số 60% không nói được vì sao 60, và tệ hơn: điểm giữa hai ứng viên có
        ĐỘ PHỦ khác nhau thì không so sánh được với nhau — người khai đúng một
        tiêu chí và khớp hoàn hảo tiêu chí đó sẽ được 100. `ChipPhuHop` hiện độ
        phủ ngay cạnh, nên NTD biết con số nào đáng tin tới đâu.
      */}
      <td className="px-5 py-4 align-top">
        <ChipPhuHop breakdown={a.matchBreakdown} gon />
      </td>

      <td className="px-5 py-4 align-top text-slate-500 whitespace-nowrap">
        {new Date(a.createdAt).toLocaleDateString('vi-VN')}
      </td>

      <td className="px-5 py-4 align-top">
        <Badge tone={statusTone[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
      </td>

      <td className="px-5 py-4 align-top">
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
{/*
            Nút CV phải có CHỮ, không chỉ một biểu tượng.

            Mũi tên xuống một mình có thể là tải CV, tải đơn, xuất danh sách —
            người dùng phải bấm thử mới biết. `aria-label` cứu được trình đọc
            màn hình nhưng không cứu người nhìn thấy nó.

            Không có CV thì nói thẳng "Chưa có CV" thay vì để trống: khoảng trống
            đọc thành "chỗ này chưa vẽ xong", còn dòng chữ thì nói đúng sự thật
            về hồ sơ này.
          */}
          {a.cvUrl ? (
            <a
              href={a.cvUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-brand-700"
            >
              <Download size={14} />
              CV
            </a>
          ) : (
            <span className="px-2.5 text-sm text-slate-400">Chưa có CV</span>
          )}

{/*
            MỘT nút chính, phần còn lại lùi xuống.

            Bản trước cho cả ba nút cùng trọng lượng: "Đánh dấu đã xem" viền
            trắng, "Mời phỏng vấn" nền đặc, "Từ chối" chữ trơn — ba khối cùng
            đòi chú ý nên mắt không biết nhìn đâu, và nhà tuyển dụng phải ĐỌC cả
            ba mới quyết được. Hàng danh sách nên trả lời sẵn câu "việc nên làm
            tiếp là gì" bằng hình dạng, trước cả khi người ta đọc chữ.

            Thứ tự CỐ ĐỊNH — phụ, chính, từ chối — chứ không theo thứ tự server
            trả về. Nút ở mỗi hàng phải nằm đúng một chỗ, nếu không thì lướt dọc
            bảng là mỗi hàng một bố cục.
          */}
          {[...buoc]
            .sort((x, y) => hangNut(x) - hangNut(y))
            .map((s) =>
              // Từ chối phải kèm lý do (server chặn ở Zod), nên nó mở hộp thoại
              // thay vì gửi thẳng như các bước khác.
              s === 'REJECTED' ? (
                <Button
                  key={s}
                  size="sm"
                  variant="ghost"
                  disabled={doi.isPending}
                  onClick={() => setMoTuChoi(true)}
                  // Ý định phá huỷ chỉ đỏ lên khi con trỏ tới gần, không đỏ sẵn:
                  // đỏ sẵn thì mỗi hàng có một điểm báo động, mà từ chối là việc
                  // bình thường của tuyển dụng chứ không phải tai nạn.
                  className="text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                >
                  {APPLICATION_ACTION_LABELS[s]}
                </Button>
              ) : (
                <Button
                  key={s}
                  size="sm"
                  variant={laBuocChinh(s) ? 'primary' : 'ghost'}
                  disabled={doi.isPending}
                  onClick={() => doi.mutate({ applicationId: a.id, status: s })}
                  className={laBuocChinh(s) ? undefined : 'text-slate-500'}
                >
                  {/* Spinner nằm TRONG nút vừa bấm, không thay chỗ cả hàng nút:
                      thay cả hàng thì bảng co lại rồi bung ra, và người dùng mất
                      dấu nút mình vừa chạm. */}
                  {doi.isPending && doi.variables?.status === s && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {APPLICATION_ACTION_LABELS[s]}
                </Button>
              ),
            )}
        </div>

        {doi.isError && (
          <p className="mt-1 text-right text-xs text-rose-600">
            {doi.error instanceof Error ? doi.error.message : 'Không đổi được trạng thái'}
          </p>
        )}

        <DialogTuChoi
          open={moTuChoi}
          onOpenChange={setMoTuChoi}
          tenUngVien={a.fullName}
          dangGui={doi.isPending}
          onXacNhan={(note) =>
            doi.mutate(
              { applicationId: a.id, status: 'REJECTED', note },
              { onSuccess: () => setMoTuChoi(false) },
            )
          }
        />
      </td>
    </tr>
  )
}

/**
 * Bước nào là hành động CHÍNH của hàng — đúng một cái, và là bước đi TỚI.
 *
 * Chỉ `SHORTLISTED`. `VIEWED` là ghi sổ, không đẩy hồ sơ đi đâu; `REJECTED` là
 * đường lùi; `ACCEPTED` không đi tới được (xem `CHUYEN_TRANG_THAI_HOP_LE`).
 */
function laBuocChinh(s: ApplicationStatus): boolean {
  return s === 'SHORTLISTED'
}

/** Thứ tự cố định trên hàng: ghi sổ → hành động chính → từ chối. */
function hangNut(s: ApplicationStatus): number {
  if (s === 'REJECTED') return 2
  return laBuocChinh(s) ? 1 : 0
}

/**
 * Thư ngỏ của sinh viên.
 *
 * Bản đầu tiên của trang này KHÔNG vẽ nó ra — API đã trả `coverLetter` mà giao
 * diện bỏ quên. Nghĩa là sinh viên ngồi viết một lá thư không ai đọc được, và
 * không bên nào biết: sinh viên tưởng đã gửi, nhà tuyển dụng không biết có.
 *
 * Gập lại mặc định vì bảng này dày và phần lớn hàng còn có kỹ năng, liên hệ,
 * chip điểm. Nhưng phải cho thấy DÒNG ĐẦU chứ không chỉ một nút "xem thư" —
 * một dòng đủ để nhà tuyển dụng quyết định có mở hay không, còn nút trơn thì
 * họ phải mở từng cái mới biết cái nào đáng đọc.
 */
function ThuNgo({ noiDung }: { noiDung: string }) {
  const [mo, setMo] = useState(false)

  return (
    <div className="mt-2 max-w-xl rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
      <div className="flex items-start gap-1.5">
        <Quote size={12} className="mt-0.5 shrink-0 text-slate-400" />
        <p className={cn('whitespace-pre-wrap', !mo && 'line-clamp-1')}>{noiDung}</p>
      </div>
      {/* Chỉ hiện nút khi thư dài hơn một dòng thì tốt hơn, nhưng đo chiều cao
          thật đòi ref + ResizeObserver. Ngưỡng ký tự rẻ hơn nhiều và sai ở đây
          chỉ tốn một nút thừa, không sai dữ liệu. */}
      {noiDung.length > 90 && (
        <button
          onClick={() => setMo((v) => !v)}
          className="mt-1 pl-5 font-medium text-brand-700 hover:underline"
        >
          {mo ? 'Thu gọn' : 'Đọc thư ngỏ'}
        </button>
      )}
    </div>
  )
}

/* ==================================================================== */

function ChonTin({
  jobs,
  onChon,
}: {
  jobs: { id: string; title: string; status: string }[]
  onChon: (id: string) => void
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Ứng viên</h1>
      <p className="mt-1 text-sm text-slate-500">Chọn tin để xem hồ sơ đã nộp.</p>

      {jobs.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <BriefcaseBusiness className="mx-auto text-slate-300" size={32} />
          <p className="mt-3 text-sm text-slate-500">Bạn chưa có tin tuyển dụng nào.</p>
          <Link to="/ntd/dang-tin" className="mt-4 inline-block">
            <Button>Đăng tin đầu tiên</Button>
          </Link>
        </Card>
      ) : (
        <Card className="mt-6 divide-y divide-slate-100">
          {jobs.map((j) => (
            <button
              key={j.id}
              onClick={() => onChon(j.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{j.title}</span>
              <Badge tone={j.status === 'OPEN' ? 'success' : 'neutral'}>
                {j.status === 'OPEN' ? 'Đang hiển thị' : j.status}
              </Badge>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
