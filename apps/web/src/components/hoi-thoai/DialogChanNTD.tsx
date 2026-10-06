import { useState } from 'react'
import { Ban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiClientError } from '@/lib/api'

/**
 * Xác nhận chặn một nhà tuyển dụng.
 *
 * Hỏi lại trước khi làm: chặn đóng luôn cuộc trò chuyện đang mở, và người bấm
 * nhầm không nên phát hiện ra điều đó sau khi nhà tuyển dụng đã bị cắt ngang.
 *
 * Câu chữ nói đủ BA điều người ta lo nhất trước khi bấm: bên kia có biết không,
 * đơn ứng tuyển có bị ảnh hưởng không, và có quay lại được không. Thiếu điều
 * thứ hai thì sinh viên đang chờ kết quả phỏng vấn sẽ không dám bấm — dù họ
 * đang bị làm phiền.
 */
export function DialogChanNTD({
  congTy,
  open,
  onOpenChange,
  onChan,
}: {
  congTy: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onChan: () => Promise<unknown>
}) {
  const [dangChan, setDangChan] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function chan() {
    setLoi(null)
    setDangChan(true)
    try {
      await onChan()
      onOpenChange(false)
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không chặn được, thử lại giúp mình')
    } finally {
      setDangChan(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban size={18} className="text-rose-600" aria-hidden="true" />
            Chặn {congTy}?
          </DialogTitle>
          <DialogDescription>Chặn chỉ dừng phần nhắn tin.</DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Cuộc trò chuyện đang mở sẽ kết thúc; nơi này không nhắn được cho bạn nữa.</li>
          <li>Họ không nhận thông báo nào về việc bị chặn.</li>
          <li>
            Đơn ứng tuyển của bạn <strong>không bị ảnh hưởng</strong> — họ vẫn xem và xử lý đơn như
            thường.
          </li>
          <li>Bạn bỏ chặn được bất cứ lúc nào, ngay trong cuộc trò chuyện này.</li>
        </ul>

        {loi && (
          <p role="alert" className="text-sm text-rose-700">
            {loi}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            disabled={dangChan}
            onClick={() => void chan()}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {dangChan && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
            Chặn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
