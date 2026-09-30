import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiClientError, apiFetch } from '@/lib/api'
import { layClientSessionId } from '@/lib/phien-chat'

const TRAN = 500

/**
 * Hỏi thẳng nhà tuyển dụng về một tin, không qua trợ lý.
 *
 * ===========================================================================
 * VÌ SAO NÚT NÀY KHÔNG PHẢI "NHẮN TIN"
 * ===========================================================================
 * Nó không mở một hộp chat tự do — nó CHUYỂN phiên trợ lý của sinh viên sang
 * nhà tuyển dụng sở hữu tin, đúng cùng đường mà trợ lý đề nghị. Một đường duy
 * nhất nghĩa là một bộ luật duy nhất: một hội thoại đang mở cho mỗi cặp
 * (sinh viên, nhà tuyển dụng), mốc `employerVisibleFromSeq` đóng băng ở lần
 * chuyển đầu, và nhà tuyển dụng chỉ đọc được từ mốc đó trở đi.
 *
 * Mở một đường thứ hai "nhắn trực tiếp" là dựng lại toàn bộ những luật ấy ở
 * chỗ thứ hai, và chúng sẽ lệch nhau.
 *
 * ---------------------------------------------------------------------------
 * SERVER CÓ THỂ TỪ CHỐI, VÀ ĐÓ LÀ CÂU TRẢ LỜI ĐÚNG
 * ---------------------------------------------------------------------------
 * Đã có hội thoại đang mở với chính nhà tuyển dụng này, tin đã đóng, doanh
 * nghiệp chưa xác minh — cả ba đều trả về một câu rõ nghĩa. Hiện nguyên câu
 * đó chứ không dịch lại: nó chính xác hơn bất cứ câu chung chung nào ta đoán.
 */
export function DialogHoiNTD({
  jobId,
  tenTin,
  congTy,
  open,
  onOpenChange,
}: {
  jobId: string
  tenTin: string
  congTy: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const dieuHuong = useNavigate()
  const [loiNhan, setLoiNhan] = useState('')
  const [dangGui, setDangGui] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function gui() {
    setLoi(null)
    setDangGui(true)
    try {
      /* Mở phiên trợ lý (idempotent theo `clientSessionId`) rồi chuyển đi. */
      const phien = await apiFetch<{ sessionId: string }>('/api/hoi-thoai', {
        method: 'POST',
        body: JSON.stringify({ kind: 'AI_STUDENT', clientSessionId: layClientSessionId('tro-ly') }),
      })
      await apiFetch(`/api/hoi-thoai/${phien.sessionId}/chuyen-ntd`, {
        method: 'POST',
        body: JSON.stringify({ jobId, loiNhan: loiNhan.trim() }),
      })
      onOpenChange(false)
      dieuHuong('/tro-ly')
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không gửi được yêu cầu')
    } finally {
      setDangGui(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare size={18} className="text-brand-600" aria-hidden="true" />
            Hỏi nhà tuyển dụng
          </DialogTitle>
          <DialogDescription>
            {tenTin} · {congTy}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Nhà tuyển dụng thấy tên viết tắt của bạn và những tin nhắn <strong>từ lúc này trở
          đi</strong> — không thấy đoạn bạn đã hỏi trợ lý trước đó. Tên đầy đủ và liên hệ chỉ mở
          khi bạn nộp đơn và được chuyển vào vòng trong.
        </p>

        <div>
          <label htmlFor="loi-nhan-ntd" className="text-sm font-medium text-slate-900">
            Bạn muốn hỏi gì? (không bắt buộc)
          </label>
          <textarea
            id="loi-nhan-ntd"
            rows={3}
            value={loiNhan}
            maxLength={TRAN}
            onChange={(e) => setLoiNhan(e.target.value)}
            placeholder="Ví dụ: em học sáng thứ 3 và thứ 5, ca chiều còn nhận không ạ?"
            className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500"
          />
        </div>

        {loi && (
          <p role="alert" className="text-sm text-rose-700">
            {loi}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={dangGui} onClick={() => void gui()}>
            {dangGui && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
            Gửi cho nhà tuyển dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
