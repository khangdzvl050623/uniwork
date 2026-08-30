import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenUngVien: string
  dangGui: boolean
  onXacNhan: (note: string) => void
}

const TOI_DA = 1000

/**
 * Hộp thoại từ chối hồ sơ.
 *
 * Tồn tại vì **lý do là bắt buộc** — server chặn ở Zod với câu "Từ chối phải kèm
 * lý do — sinh viên sẽ nhận được câu này".
 *
 * Vì sao bắt buộc chứ không phải tuỳ chọn: sinh viên nhận thông báo từ chối.
 * Không có lý do thì họ nhận một câu trống rỗng và không học được gì cho lần
 * nộp sau — đúng thứ trải nghiệm mà dự án này muốn thay thế.
 *
 * Nút xác nhận mờ đi khi chưa gõ gì, thay vì cho bấm rồi để server trả 400: lỗi
 * biết trước thì chặn ở chỗ người dùng đang nhìn, đừng bắt họ đi một vòng mạng
 * mới biết mình thiếu gì.
 */
export function DialogTuChoi({ open, onOpenChange, tenUngVien, dangGui, onXacNhan }: Props) {
  const [note, setNote] = useState('')
  const sanSang = note.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối hồ sơ</DialogTitle>
          <DialogDescription>
            {tenUngVien} sẽ nhận được lý do bạn viết dưới đây.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="ly-do" className="text-sm font-medium text-slate-700">
            Lý do
          </label>
          <textarea
            id="ly-do"
            rows={4}
            value={note}
            maxLength={TOI_DA}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Lịch rảnh chưa khớp ca tối cuối tuần bên mình cần."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <p className="text-right text-xs text-slate-400">
            {note.length}/{TOI_DA}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dangGui}>
            Huỷ
          </Button>
          <Button onClick={() => onXacNhan(note.trim())} disabled={!sanSang || dangGui}>
            {dangGui && <Loader2 size={16} className="animate-spin" />}
            Gửi từ chối
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
