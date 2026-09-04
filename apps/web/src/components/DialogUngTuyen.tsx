import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send } from 'lucide-react'
import type { PublicJobDetail } from '@uniwork/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { useApply } from '@/hooks/useApplications'
import { useMe } from '@/hooks/useProfile'
import { ApiClientError } from '@/lib/api'

interface Props {
  job: PublicJobDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TOI_DA_THU_NGO = 2000

/**
 * Hộp thoại nộp đơn.
 *
 * ---------------------------------------------------------------------------
 * CẢNH BÁO KHÔNG ĐỦ ĐIỀU KIỆN NẰM Ở ĐÂY, VÀ KHÔNG CHẶN
 * ---------------------------------------------------------------------------
 * Lịch rảnh là bản khai CÓ THỂ ĐÃ CŨ — sinh viên vừa đổi thời khoá biểu mà chưa
 * cập nhật là chuyện thường. Chặn cứng là để hệ thống từ chối thay nhà tuyển
 * dụng, trong khi NTD mới là người biết mình linh động tới đâu.
 *
 * Nên cảnh báo phải: (1) hiện TRƯỚC nút gửi, không hiện sau khi bấm; (2) nói rõ
 * thiếu bao nhiêu ca chứ không chỉ "bạn chưa phù hợp"; (3) không làm nút mờ đi.
 *
 * Đặt trong modal chứ không đặt cạnh nút ở trang: ở trang nó là một dòng chữ
 * người ta lướt qua, trong modal nó là thứ chắn giữa họ và nút gửi.
 */
export function DialogUngTuyen({ job, open, onOpenChange }: Props) {
  const [coverLetter, setCoverLetter] = useState('')
  const { data: me } = useMe()
  const apply = useApply()

  const thieuCa = job.eligible === false
  const coCv = Boolean(me?.studentProfile?.cvUrl)

  function gui() {
    apply.mutate(
      { jobId: job.id, coverLetter: coverLetter.trim() || null },
      { onSuccess: () => setCoverLetter('') },
    )
  }

  /* Nộp xong thì đổi hẳn nội dung modal thay vì đóng ngay: đóng ngay để lại
     người dùng ở đúng trang cũ với nút vẫn như trước, không có gì xác nhận việc
     họ vừa làm đã thành. */
  if (apply.isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              Đã gửi hồ sơ
            </DialogTitle>
            <DialogDescription>
              Hồ sơ của bạn đã tới <strong>{job.employer.companyName}</strong>. Nhà tuyển dụng sẽ
              xem và phản hồi qua email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ứng tuyển</DialogTitle>
          <DialogDescription>
            {job.title} · {job.employer.companyName}
          </DialogDescription>
        </DialogHeader>

        {thieuCa && (
          <div className="flex gap-2.5 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-inset ring-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-amber-900">
              <p className="font-medium">Lịch rảnh của bạn chưa đủ số ca tin này cần</p>
              <p className="mt-0.5 text-amber-800">
                Bạn rảnh {job.matchedShifts}/{job.totalJobShifts} ca, tin cần tối thiểu{' '}
                {job.minShiftsPerWeek ?? 1} ca mỗi tuần. Bạn vẫn nộp được — nhà tuyển dụng là người
                quyết định. Nếu lịch của bạn đã đổi, hãy{' '}
                <Link to="/lich-ranh" className="font-medium underline">
                  cập nhật lịch rảnh
                </Link>{' '}
                trước khi nộp.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="thu-ngo" className="text-sm font-medium text-slate-700">
            Thư ngỏ <span className="font-normal text-slate-400">(không bắt buộc)</span>
          </label>
          <textarea
            id="thu-ngo"
            rows={5}
            value={coverLetter}
            maxLength={TOI_DA_THU_NGO}
            onChange={(e) => setCoverLetter(e.target.value)}
            placeholder="Vài dòng về vì sao bạn hợp với công việc này, lịch bạn đi làm được…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <p className="text-right text-xs text-slate-400">
            {coverLetter.length}/{TOI_DA_THU_NGO}
          </p>
        </div>

        {/* CV lấy từ hồ sơ, không cho chọn file ở đây: một CV cho mọi đơn là
            đúng thực tế, và tải file trong modal là một luồng lỗi nữa phải lo. */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <FileText size={16} className="shrink-0 text-slate-400" />
          {coCv ? (
            <span className="text-slate-600">
              Nộp kèm CV trong hồ sơ của bạn.{' '}
              <Link to="/ho-so" className="font-medium text-brand-700 underline">
                Đổi CV
              </Link>
            </span>
          ) : (
            <span className="text-slate-600">
              Bạn chưa có CV.{' '}
              <Link to="/ho-so" className="font-medium text-brand-700 underline">
                Tải CV lên
              </Link>{' '}
              để hồ sơ đầy đủ hơn — vẫn nộp được nếu chưa có.
            </span>
          )}
        </div>

        {apply.isError && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            {apply.error instanceof ApiClientError
              ? apply.error.message
              : 'Không gửi được hồ sơ, thử lại sau ít phút.'}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={apply.isPending}>
            Huỷ
          </Button>
          <Button onClick={gui} disabled={apply.isPending}>
            {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Gửi hồ sơ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
