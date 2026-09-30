import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import {
  JOB_REPORT_REASONS,
  JOB_REPORT_REASON_LABELS,
  type JobReportReasonValue,
} from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGuiBaoCao } from '@/hooks/useBaoCao'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

const TOI_THIEU = 20
const TRAN = 2000

/**
 * Báo cáo một tin tuyển dụng.
 *
 * ===========================================================================
 * HAI CÂU BẮT BUỘC PHẢI CÓ TRÊN MÀN HÌNH NÀY
 * ===========================================================================
 *   "Nhà tuyển dụng không biết ai báo cáo." — không nói thì sinh viên sợ bị
 *   trả đũa và im lặng, mà im lặng đúng với những tin đáng báo nhất.
 *
 *   "Mô tả ít nhất 20 ký tự." — nói TRƯỚC khi gõ, không phải sau khi bấm gửi.
 *   Một báo cáo chỉ có chữ "lừa đảo" không giúp admin quyết được gì, và cái
 *   giá của nó là một tin thật có thể bị gỡ oan.
 *
 * ---------------------------------------------------------------------------
 * `clientReportId` SINH MỘT LẦN CHO MỖI LẦN MỞ HỘP THOẠI
 * ---------------------------------------------------------------------------
 * Nó là khoá chống trùng phía server. Sinh lại ở mỗi lần bấm Gửi thì mạng chập
 * chờn + bấm hai lần = hai báo cáo cho cùng một tin, và hàng đợi admin nhân
 * đôi. Sinh một lần lúc mở thì lần bấm thứ hai nhận về chính bản đã ghi.
 */
export function DialogBaoCao({
  jobId,
  tenTin,
  open,
  onOpenChange,
}: {
  jobId: string
  tenTin: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  /*
   * `key` đổi theo `open` nên toàn bộ state bên trong được dựng lại mỗi lần
   * mở — kể cả `clientReportId`. Đóng rồi mở lại là một báo cáo MỚI, còn bấm
   * gửi hai lần trong cùng một lần mở thì vẫn là một.
   */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <NoiDung key={jobId} jobId={jobId} tenTin={tenTin} onDong={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function NoiDung({
  jobId,
  tenTin,
  onDong,
}: {
  jobId: string
  tenTin: string
  onDong: () => void
}) {
  const [clientReportId] = useState(() => `br-${crypto.randomUUID()}`)
  const [reason, setReason] = useState<JobReportReasonValue>('LUA_DAO')
  const [moTa, setMoTa] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [xong, setXong] = useState<'moi' | 'da-co' | null>(null)

  const gui = useGuiBaoCao()
  const chuaDu = moTa.trim().length < TOI_THIEU

  async function guiDi() {
    setLoi(null)
    try {
      const kq = await gui.mutateAsync({ jobId, clientReportId, reason, moTa: moTa.trim() })
      setXong(kq.daCo ? 'da-co' : 'moi')
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không gửi được báo cáo')
    }
  }

  if (xong) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
            {xong === 'moi' ? 'Đã gửi báo cáo' : 'Bạn đã báo cáo tin này rồi'}
          </DialogTitle>
          <DialogDescription>
            {xong === 'moi'
              ? 'Quản trị viên sẽ xem và trả lời bạn. Nhà tuyển dụng không biết ai đã báo cáo.'
              : 'Báo cáo cũ vẫn đang chờ xử lý — không cần gửi lại.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Link to="/bao-cao-cua-toi">
            <Button variant="outline">Xem báo cáo của tôi</Button>
          </Link>
          <Button onClick={onDong}>Đóng</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-rose-600" aria-hidden="true" />
          Báo cáo tin tuyển dụng
        </DialogTitle>
        <DialogDescription>{tenTin}</DialogDescription>
      </DialogHeader>

      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        Báo cáo đi thẳng tới quản trị viên UniWork. Nhà tuyển dụng{' '}
        <strong>không nhận được</strong> danh tính của bạn hay nội dung bạn viết.
      </p>

      <fieldset>
        <legend className="text-sm font-medium text-slate-900">Lý do</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {JOB_REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              aria-pressed={reason === r}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                reason === r
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400',
              )}
            >
              {JOB_REPORT_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="mo-ta-bao-cao" className="text-sm font-medium text-slate-900">
          Bạn thấy gì?
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Ít nhất {TOI_THIEU} ký tự. Nói rõ chi tiết nào khiến bạn nghi ngờ — đó là thứ quản trị
          viên dựa vào để quyết.
        </p>
        <textarea
          id="mo-ta-bao-cao"
          rows={4}
          value={moTa}
          maxLength={TRAN}
          onChange={(e) => setMoTa(e.target.value)}
          placeholder="Ví dụ: tin yêu cầu chuyển 200.000đ phí giữ chỗ trước khi phỏng vấn."
          className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500"
        />
        {/*
         * Đếm ngược tới ngưỡng tối thiểu, không đếm xuôi tới trần.
         *
         * Trần 2000 ký tự gần như không ai chạm; ngưỡng 20 thì ai cũng chạm và
         * là thứ chặn nút Gửi. Hiện đúng con số đang cản trở người dùng.
         */}
        <p className="mt-1 text-xs text-slate-400">
          {chuaDu
            ? `Cần thêm ${TOI_THIEU - moTa.trim().length} ký tự nữa`
            : `${moTa.length}/${TRAN} ký tự`}
        </p>
      </div>

      {loi && (
        <p role="alert" className="text-sm text-rose-700">
          {loi}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onDong}>
          Huỷ
        </Button>
        <Button disabled={chuaDu || gui.isPending} onClick={() => void guiDi()}>
          {gui.isPending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
          Gửi báo cáo
        </Button>
      </DialogFooter>
    </>
  )
}
