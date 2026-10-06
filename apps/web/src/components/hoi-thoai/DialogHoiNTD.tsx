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

const TRAN = 500

/**
 * Hỏi thẳng nhà tuyển dụng về một tin, không qua trợ lý.
 *
 * ===========================================================================
 * MỘT LUỒNG CHO MỖI NHÀ TUYỂN DỤNG, VÀ NÓ SỐNG MÃI
 * ===========================================================================
 * Bấm nút này lần đầu thì luồng mở ra. Bấm lại sau vài tháng — hoặc sau khi
 * hai bên đã kết thúc — thì CHÍNH luồng ấy mở lại, mang theo toàn bộ lịch sử.
 *
 * Không có "hội thoại mới" nào cả, đúng như mọi ứng dụng nhắn tin: danh tính
 * cuộc trò chuyện là NGƯỜI ở đầu kia, không phải lần bấm.
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
    const cauHoi = loiNhan.trim()
    if (!cauHoi) {
      setLoi('Vui lòng nhập câu hỏi mở đầu để gửi yêu cầu trao đổi.')
      return
    }
    setDangGui(true)
    try {
      /*
       * Một lời gọi duy nhất. `jobId` xác định nhà tuyển dụng, nhà tuyển dụng
       * xác định luồng — server mở luồng nếu chưa có, mở LẠI nếu đã đóng.
       */
      const kq = await apiFetch<{ sessionId: string }>('/api/hoi-thoai/hoi-ntd', {
        method: 'POST',
        body: JSON.stringify({ jobId, loiNhan: cauHoi }),
      })
      onOpenChange(false)
      dieuHuong(`/hoi-thoai/${kq.sessionId}`)
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
            Trao đổi với nhà tuyển dụng
          </DialogTitle>
          <DialogDescription>
            {tenTin} · {congTy}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Sau khi ứng tuyển thành công, bạn gửi yêu cầu trao đổi kèm một câu hỏi mở đầu. Yêu cầu sẽ ở
          trạng thái chờ nhà tuyển dụng tiếp nhận (WAITING_EMPLOYER). Khi tiếp nhận (HUMAN_ACTIVE), hai
          bên sẽ nhắn tin trực tiếp.
        </p>

        <p className="text-xs text-slate-500">
          * Nhà tuyển dụng chỉ thấy tên viết tắt và ngữ cảnh tin tuyển dụng — không thể đọc lịch sử
          AI riêng, và quyền chat không tự mở thêm quyền xem CV hoặc thông tin liên hệ của bạn.
        </p>

        <div>
          <label htmlFor="loi-nhan-ntd" className="text-sm font-medium text-slate-900">
            Câu hỏi mở đầu cho nhà tuyển dụng <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="loi-nhan-ntd"
            rows={3}
            value={loiNhan}
            maxLength={TRAN}
            onChange={(e) => setLoiNhan(e.target.value)}
            placeholder="Ví dụ: Em đã nộp đơn ứng tuyển cho tin này, em muốn hỏi thêm về lịch làm việc chi tiết ca chiều ạ..."
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
            Gửi yêu cầu trao đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
