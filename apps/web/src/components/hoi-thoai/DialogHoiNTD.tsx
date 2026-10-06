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
import { luongDangCo } from '@/lib/luong-ntd'

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
 *
 * Ca "đã có hội thoại" thì kèm luôn nút mở nó — kế hoạch: nút trao đổi "mở
 * hội thoại hiện có hoặc gửi yêu cầu mới". KHÔNG tự chuyển trang: người dùng
 * vừa gõ một câu hỏi, chuyển đi là câu đó mất trước khi họ kịp chép lại.
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
  const [luongCo, setLuongCo] = useState<string | null>(null)

  async function gui() {
    setLoi(null)
    setLuongCo(null)
    setDangGui(true)
    try {
      /*
       * Một lời gọi duy nhất. `jobId` xác định nhà tuyển dụng, nhà tuyển dụng
       * xác định luồng — server mở luồng nếu chưa có, mở LẠI nếu đã đóng.
       */
      const kq = await apiFetch<{ sessionId: string }>('/api/hoi-thoai/hoi-ntd', {
        method: 'POST',
        body: JSON.stringify({ jobId, loiNhan: loiNhan.trim() }),
      })
      onOpenChange(false)
      dieuHuong(`/hoi-thoai/${kq.sessionId}`)
    } catch (e) {
      setLuongCo(luongDangCo(e))
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
          Nhà tuyển dụng thấy tên viết tắt của bạn và <strong>chỉ cuộc trò chuyện này</strong> —
          không thấy đoạn bạn hỏi trợ lý, cũng không thấy bạn nói gì với nơi khác. Tên đầy đủ và
          liên hệ chỉ mở khi bạn nộp đơn và được chuyển vào vòng trong.
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
          {luongCo ? (
            <Button
              onClick={() => {
                onOpenChange(false)
                dieuHuong(`/hoi-thoai/${luongCo}`)
              }}
            >
              Mở hội thoại
            </Button>
          ) : (
            <Button disabled={dangGui} onClick={() => void gui()}>
              {dangGui && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
              Gửi cho nhà tuyển dụng
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
