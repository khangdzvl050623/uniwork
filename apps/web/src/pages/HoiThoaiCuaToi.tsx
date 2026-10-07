import { Link } from 'react-router-dom'
import { Bot, Headset, Loader2, MessagesSquare, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  useHoiThoaiCuaToi,
  type LoaiKenh,
  type MucHoiThoaiCuaToi,
} from '@/hooks/useHoiThoaiCuaToi'

/**
 * Danh sách hội thoại của chính người dùng.
 *
 * ===========================================================================
 * MÀN HÌNH NÀY SỬA MỘT LỖ, KHÔNG PHẢI THÊM MỘT TIỆN NGHI
 * ===========================================================================
 * Thiết kế CHO PHÉP nhiều hội thoại song song — mỗi nhà tuyển dụng một phiên,
 * vì nơi B không được đọc những gì đã chia sẻ với nơi A. Nhưng `/tro-ly` lại
 * buộc vào đúng một `clientSessionId` trong localStorage, nên hội thoại thứ
 * hai trở đi không có đường nào mở lại: chúng vẫn sống, vẫn nhận tin realtime,
 * và chủ của chúng không bao giờ nhìn thấy nữa.
 *
 * Chính server cũng đang bảo người dùng làm một việc bất khả — khi chuyển sang
 * nhà tuyển dụng thứ hai nó trả về *"Mở hội thoại mới để hỏi nơi này"*. Nút
 * "Hội thoại mới" ở đây là câu trả lời cho dòng chữ đó.
 */

const TEN_KENH: Record<LoaiKenh, { chu: string; icon: typeof Bot }> = {
  AI_STUDENT: { chu: 'Trợ lý AI', icon: Bot },
  AI_EMPLOYER: { chu: 'Trợ lý AI', icon: Bot },
  AI_SUPPORT: { chu: 'Hỗ trợ UniWork', icon: Headset },
  NTD: { chu: 'Nhà tuyển dụng', icon: MessagesSquare },
}

const NHAN_TRANG_THAI: Record<
  string,
  { chu: string; tone: 'brand' | 'warning' | 'success' | 'neutral' }
> = {
  AI_ACTIVE: { chu: 'Đang hỏi trợ lý', tone: 'brand' },
  WAITING_EMPLOYER: { chu: 'Chờ nhà tuyển dụng', tone: 'warning' },
  WAITING_ADMIN: { chu: 'Chờ quản trị viên', tone: 'warning' },
  HUMAN_ACTIVE: { chu: 'Đang trao đổi', tone: 'success' },
  CLOSED: { chu: 'Đã kết thúc', tone: 'neutral' },
}

function baoLau(iso: string): string {
  const giay = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (giay < 60) return 'vừa xong'
  if (giay < 3600) return `${Math.floor(giay / 60)} phút trước`
  if (giay < 86_400) return `${Math.floor(giay / 3600)} giờ trước`
  return `${Math.floor(giay / 86_400)} ngày trước`
}

export function HoiThoaiCuaToi() {
  const { data, isLoading } = useHoiThoaiCuaToi()
  const ds = data?.hoiThoai ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MessagesSquare size={20} className="text-brand-600" aria-hidden="true" />
            Hội thoại của tôi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi nhà tuyển dụng là một hội thoại riêng, sống mãi — nơi này không đọc được nội
            dung của nơi kia.
          </p>
        </div>

        {/*
          KHÔNG còn nút "Hội thoại mới", và đó là điểm chính của cả thay đổi.
          Không ai tạo hội thoại — người ta mở hội thoại VỚI MỘT NGƯỜI. Muốn
          hỏi một nhà tuyển dụng thì bấm "Hỏi nhà tuyển dụng" ở trang tin của
          họ; luồng tự mở, và nếu đã có thì tin nhắn vào đúng luồng cũ.
        */}
        <Link to="/viec-lam">
          <Button variant="outline" size="sm">
            <Search size={15} aria-hidden="true" />
            Tìm việc để hỏi
          </Button>
        </Link>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-600" />
          <span className="sr-only">Đang tải</span>
        </div>
      )}

      {!isLoading && ds.length === 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <MessagesSquare size={22} />
          </div>
          <p className="mt-3 text-base font-semibold text-slate-800">Chưa có hội thoại nào</p>
          <p className="mt-1 text-xs text-slate-500">
            Hỏi trợ lý một câu, hoặc bấm “Hỏi nhà tuyển dụng” ở trang một tin tuyển dụng.
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {ds.map((m) => (
          <MotHoiThoai key={m.sessionId} m={m} />
        ))}
      </ul>
    </div>
  )
}

function MotHoiThoai({ m }: { m: MucHoiThoaiCuaToi }) {
  const kenh = TEN_KENH[m.kind]
  const Icon = kenh.icon
  const nhan = NHAN_TRANG_THAI[m.state]

  /*
   * Tiêu đề ưu tiên NƠI ĐANG NÓI CHUYỆN, rồi mới tới tên tin.
   *
   * Người dùng tìm hội thoại theo "mình đang nói với ai", không theo mã phiên.
   * Hai hội thoại về cùng một tin với hai nơi khác nhau là chuyện có thật khi
   * tin được đăng lại.
   */
  const tieuDe = m.congTy ?? m.tenTin ?? kenh.chu

  /* Luồng trợ lý về trang trợ lý; hai kênh còn lại là người–người. */
  const duongDan = m.kind === 'NTD' || m.kind === 'AI_SUPPORT' ? `/hoi-thoai/${m.sessionId}` : '/tro-ly'

  return (
    <li>
      <Link
        to={duongDan}
        className="group block rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors duration-200 group-hover:bg-brand-50 group-hover:text-brand-600">
              <Icon size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 transition-colors group-hover:text-brand-700">{tieuDe}</p>
              {m.congTy && m.tenTin && (
                <p className="truncate text-xs text-slate-500">{m.tenTin}</p>
              )}
              <p className="mt-1 truncate text-sm text-slate-600">
                {m.tinCuoi ?? 'Chưa có tin nhắn nào'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-xs text-slate-400">{baoLau(m.lastMessageAt)}</span>
            {nhan && <Badge tone={nhan.tone}>{nhan.chu}</Badge>}
          </div>
        </div>
      </Link>
    </li>
  )
}
