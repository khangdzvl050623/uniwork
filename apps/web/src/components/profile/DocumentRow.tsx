import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Eye, Loader2, Upload, XCircle } from 'lucide-react'
import {
  DOCUMENT_TYPE_LABELS,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  type DocumentType,
  type EmployerDocumentResponse,
  type ReviewStatus,
} from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { useDocumentViewUrl, useUploadDocument } from '@/hooks/useProfile'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Ảnh chụp giấy tờ hoặc bản PDF scan — cùng bộ định dạng api chấp nhận. */
const DINH_DANG = ['application/pdf', 'image/jpeg', 'image/png']

const TRANG_THAI: Record<
  ReviewStatus,
  { nhan: string; icon: typeof Clock; mau: string; nen: string }
> = {
  PENDING: { nhan: 'Chờ duyệt', icon: Clock, mau: 'text-amber-700', nen: 'bg-amber-50' },
  APPROVED: { nhan: 'Đã duyệt', icon: CheckCircle2, mau: 'text-brand-700', nen: 'bg-brand-50' },
  REJECTED: { nhan: 'Bị từ chối', icon: XCircle, mau: 'text-red-700', nen: 'bg-red-50' },
}

/**
 * Một dòng giấy tờ: trạng thái + nút nộp/nộp lại + nút xem (T62).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO NÚT "XEM" PHẢI GỌI API MỖI LẦN BẤM
 * ---------------------------------------------------------------------------
 * Giấy tờ lưu trên Cloudinary ở chế độ `authenticated` — khác CV vốn công khai.
 * Không có đường dẫn cố định nào xem được; mỗi lần xem phải xin một URL đã ký,
 * sống 5 phút. Đó là chủ đích: CCCD lộ ra là nguy cơ giả mạo danh tính thật,
 * nên không được để tồn tại một link vĩnh viễn nằm trong lịch sử trình duyệt
 * hay log máy chủ.
 */
export function DocumentRow({
  type,
  document,
}: {
  type: DocumentType
  document?: EmployerDocumentResponse
}) {
  const [tienDo, setTienDo] = useState(0)
  const [loi, setLoi] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useUploadDocument(setTienDo)
  const xinLinkXem = useDocumentViewUrl()

  function chon(file: File | undefined) {
    if (!file) return
    setLoi(undefined)

    if (!DINH_DANG.includes(file.type)) {
      setLoi('Chỉ nhận PDF, JPG hoặc PNG')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setLoi(`File nặng quá ${MAX_FILE_SIZE_LABEL}`)
      return
    }

    setTienDo(0)
    upload.mutate(
      { type, file },
      {
        onError: (err) =>
          setLoi(err instanceof ApiClientError ? err.message : 'Không tải lên được'),
        onSettled: () => {
          if (inputRef.current) inputRef.current.value = ''
        },
      },
    )
  }

  function xem() {
    xinLinkXem.mutate(type, {
      onSuccess: (data) => window.open(data.url, '_blank', 'noopener,noreferrer'),
      onError: () => setLoi('Không mở được giấy tờ, thử lại sau'),
    })
  }

  const trangThai = document ? TRANG_THAI[document.status] : null
  const Icon = trangThai?.icon

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors duration-150',
        document ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{DOCUMENT_TYPE_LABELS[type]}</p>

          {trangThai && Icon ? (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                trangThai.nen,
                trangThai.mau,
              )}
            >
              <Icon size={12} />
              {trangThai.nhan}
            </span>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Chưa nộp</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {document && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={xem}
              disabled={xinLinkXem.isPending}
            >
              {xinLinkXem.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Eye size={14} />
              )}
              Xem
            </Button>
          )}

          <Button
            type="button"
            variant={document ? 'outline' : 'primary'}
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {document ? 'Nộp lại' : 'Nộp giấy tờ'}
          </Button>
        </div>
      </div>

      {/* Lý do admin từ chối. Đây là thứ duy nhất cho nhà tuyển dụng biết phải
          sửa gì — giấu đi thì họ nộp lại đúng cái vừa bị từ chối. */}
      {document?.status === 'REJECTED' && document.reviewNote && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-medium">Lý do:</span> {document.reviewNote}
        </p>
      )}

      {upload.isPending && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full origin-left rounded-full bg-brand-500 transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${Math.max(tienDo, 3) / 100})` }}
          />
        </div>
      )}

      {loi && (
        <p
          role="alert"
          className="animate-in fade-in slide-in-from-top-1 mt-2 flex items-center gap-1.5 text-xs text-red-600 duration-150"
        >
          <AlertCircle size={13} className="shrink-0" />
          {loi}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={DINH_DANG.join(',')}
        className="hidden"
        onChange={(e) => chon(e.target.files?.[0])}
      />
    </div>
  )
}
