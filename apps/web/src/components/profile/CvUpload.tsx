import { useRef, useState, type DragEvent } from 'react'
import { AlertCircle, FileText, Loader2, Upload } from 'lucide-react'
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { useUploadCv } from '@/hooks/useProfile'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Tải CV lên, có thanh tiến độ (T59).
 *
 * ---------------------------------------------------------------------------
 * KIỂM Ở ĐÂY LÀ ĐỂ TIỆN, KHÔNG PHẢI ĐỂ AN TOÀN
 * ---------------------------------------------------------------------------
 * Hai phép kiểm bên dưới (đuôi file và dung lượng) chỉ nhằm cứu người dùng khỏi
 * việc tải xong 5MB rồi mới bị từ chối. Chúng KHÔNG bảo vệ được gì: ai cũng gọi
 * thẳng api được, và `file.type` do trình duyệt suy từ TÊN file chứ không đọc
 * nội dung — đổi `virus.exe` thành `virus.pdf` là qua được hết.
 *
 * Lớp chặn thật nằm ở api: nó đọc 5 byte đầu file để xác nhận đúng là PDF
 * (`profile.service.ts`). Bỏ lớp này thì giao diện phiền; bỏ lớp kia thì thủng.
 */
export function CvUpload({ cvUrl }: { cvUrl: string | null }) {
  const [tienDo, setTienDo] = useState(0)
  const [loi, setLoi] = useState<string>()
  const [dangKeoVao, setDangKeoVao] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useUploadCv(setTienDo)

  function chon(file: File | undefined) {
    if (!file) return
    setLoi(undefined)

    if (file.type !== 'application/pdf') {
      setLoi('CV phải là file PDF')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setLoi(`File nặng quá ${MAX_FILE_SIZE_LABEL}. Thử xuất lại PDF ở chất lượng thấp hơn.`)
      return
    }

    setTienDo(0)
    upload.mutate(file, {
      onError: (err) =>
        setLoi(err instanceof ApiClientError ? err.message : 'Không tải lên được, thử lại sau.'),
      // Dọn ô chọn file để chọn LẠI ĐÚNG file vừa rồi vẫn kích hoạt onChange.
      // Không dọn thì trình duyệt coi là "không có gì đổi" và im lặng.
      onSettled: () => {
        if (inputRef.current) inputRef.current.value = ''
      },
    })
  }

  function tha(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDangKeoVao(false)
    chon(e.dataTransfer.files[0])
  }

  return (
    <div>
      {cvUrl && !upload.isPending && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <FileText size={18} className="shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700">Đã có CV</p>
            <a
              href={cvUrl}
              target="_blank"
              // noreferrer đi kèm noopener: trang mở ra không đọc được
              // `window.opener` để điều khiển ngược lại tab này.
              rel="noopener noreferrer"
              className="text-xs text-brand-600 hover:underline"
            >
              Xem CV hiện tại
            </a>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDangKeoVao(true)
        }}
        onDragLeave={() => setDangKeoVao(false)}
        onDrop={tha}
        className={cn(
          'rounded-xl border-2 border-dashed px-4 py-6 text-center',
          'transition-[border-color,background-color] duration-150 ease-out',
          dangKeoVao ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white',
          loi && 'border-red-300',
        )}
      >
        {upload.isPending ? (
          <div className="mx-auto max-w-xs">
            <div className="mb-2 flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 size={15} className="animate-spin" />
              {/* 100% rồi mà chưa xong nghĩa là file đã gửi đi hết, giờ đang
                  chờ server đẩy lên Cloudinary — nói rõ để người dùng không
                  tưởng thanh tiến độ bị treo. */}
              {tienDo < 100 ? `Đang tải lên… ${tienDo}%` : 'Đang xử lý…'}
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              {/* Dùng scaleX chứ không phải width: transform chạy trên GPU, còn
                  đổi width bắt trình duyệt tính lại bố cục ở mỗi bước. */}
              <div
                className="h-full origin-left rounded-full bg-brand-500 transition-transform duration-200 ease-out"
                style={{ transform: `scaleX(${Math.max(tienDo, 3) / 100})` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload size={20} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">
              Kéo file PDF vào đây, hoặc{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand-600 hover:underline"
              >
                chọn từ máy
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-400">Chỉ nhận PDF, tối đa {MAX_FILE_SIZE_LABEL}</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => chon(e.target.files?.[0])}
        />
      </div>

      {loi && (
        <p
          role="alert"
          className="animate-in fade-in slide-in-from-top-1 mt-2 flex items-center gap-1.5 text-xs text-red-600 duration-150"
        >
          <AlertCircle size={13} className="shrink-0" />
          {loi}
        </p>
      )}

      {upload.isSuccess && !loi && !upload.isPending && (
        <p className="mt-2 text-xs text-brand-600">Đã cập nhật CV mới.</p>
      )}

      {!cvUrl && !upload.isPending && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full sm:hidden"
          onClick={() => inputRef.current?.click()}
        >
          Chọn file CV
        </Button>
      )}
    </div>
  )
}
