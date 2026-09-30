import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Inbox, Loader2, MessagesSquare, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useKenhHoiThoai } from '@/hooks/useKenhHoiThoai'
import { useChuyenDoiHopThu, useHopThuNTD, type MucHopThu } from '@/hooks/useHopThuNTD'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Hộp thư trao đổi của nhà tuyển dụng.
 *
 * ===========================================================================
 * MÀN HÌNH NÀY CỐ Ý KHÔNG HIỆN TÊN ĐẦY ĐỦ CỦA SINH VIÊN
 * ===========================================================================
 * Ở đây chưa có đơn ứng tuyển nào — sinh viên mới chỉ bấm "muốn hỏi về tin
 * này". Luật `TRANG_THAI_MO_LIEN_HE` mở thông tin liên hệ khi đơn vào vòng
 * trong; hội thoại không đi qua luật đó nên không được lặng lẽ mở rộng hơn.
 *
 * "N.V.A" đủ để phân biệt hai hội thoại trong hộp thư, và đó là toàn bộ việc
 * màn hình này cần làm. Server cũng chỉ trả về bấy nhiêu, nên kể cả sửa chỗ
 * này cũng không moi thêm được gì.
 */

const NHAN_TRANG_THAI: Record<string, { chu: string; tone: 'warning' | 'success' | 'neutral' }> = {
  WAITING_EMPLOYER: { chu: 'Chờ bạn tiếp nhận', tone: 'warning' },
  HUMAN_ACTIVE: { chu: 'Đang trao đổi', tone: 'success' },
  CLOSED: { chu: 'Đã kết thúc', tone: 'neutral' },
}

/** "3 phút trước", "hôm qua" — mốc thời gian tuyệt đối ở đây không nói lên gì. */
function baoLau(iso: string): string {
  const giay = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (giay < 60) return 'vừa xong'
  if (giay < 3600) return `${Math.floor(giay / 60)} phút trước`
  if (giay < 86_400) return `${Math.floor(giay / 3600)} giờ trước`
  return `${Math.floor(giay / 86_400)} ngày trước`
}

export function HopThuNTD() {
  const { data, isLoading } = useHopThuNTD()
  const [dangChon, setDangChon] = useState<string | null>(null)

  /*
   * `useMemo` không phải để tối ưu — nó để effect bên dưới KHÔNG chạy mỗi lần
   * render. `data?.hoiThoai ?? []` sinh một mảng mới mỗi lần, nên mảng phụ
   * thuộc của effect đổi liên tục.
   */
  const ds = useMemo(() => data?.hoiThoai ?? [], [data])

  /*
   * Tự chọn hội thoại đầu tiên, nhưng CHỈ khi chưa chọn gì.
   *
   * Không có điều kiện đó thì mỗi lần `refetchInterval` chạy, danh sách mới về
   * và màn hình nhảy về hội thoại đầu — ngay giữa lúc người ta đang gõ dở cho
   * một hội thoại khác.
   */
  useEffect(() => {
    if (dangChon === null && ds.length > 0) setDangChon(ds[0]!.sessionId)
  }, [ds, dangChon])

  const chon = ds.find((m) => m.sessionId === dangChon) ?? null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <MessagesSquare size={22} className="text-brand-600" aria-hidden="true" />
          Hộp thư trao đổi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sinh viên hỏi thêm về tin tuyển dụng của bạn trước khi ứng tuyển. Tên đầy đủ và thông tin
          liên hệ chỉ mở khi họ nộp đơn và bạn chuyển đơn vào vòng trong.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <DanhSach ds={ds} dangTai={isLoading} dangChon={dangChon} onChon={setDangChon} />
        {chon ? (
          <ChiTiet key={chon.sessionId} muc={chon} />
        ) : (
          <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-300">
            <p className="text-sm text-slate-500">
              {isLoading ? 'Đang tải…' : 'Chọn một hội thoại ở bên trái.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ danh sách -- */

function DanhSach({
  ds,
  dangTai,
  dangChon,
  onChon,
}: {
  ds: MucHopThu[]
  dangTai: boolean
  dangChon: string | null
  onChon: (id: string) => void
}) {
  if (dangTai) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200">
        <Loader2 size={20} className="animate-spin text-brand-600" />
        <span className="sr-only">Đang tải hộp thư</span>
      </div>
    )
  }

  if (ds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
        <Inbox size={24} className="mx-auto text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-slate-700">Chưa có yêu cầu nào</p>
        <p className="mt-1 text-xs text-slate-500">
          Khi sinh viên muốn hỏi thêm về một tin của bạn, hội thoại sẽ hiện ở đây.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {ds.map((m) => {
        const nhan = NHAN_TRANG_THAI[m.state]
        const dangMo = m.sessionId === dangChon
        return (
          <li key={m.sessionId}>
            <button
              type="button"
              onClick={() => onChon(m.sessionId)}
              aria-current={dangMo ? 'true' : undefined}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                dangMo ? 'bg-brand-50' : 'hover:bg-slate-50',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">
                  {m.hoTenVietTat}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{baoLau(m.lastMessageAt)}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {m.tenTin ?? 'Chưa gắn tin cụ thể'}
              </p>
              {nhan && (
                <Badge tone={nhan.tone} className="mt-1.5">
                  {nhan.chu}
                </Badge>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------- chi tiết -- */

function ChiTiet({ muc }: { muc: MucHopThu }) {
  const kenh = useKenhHoiThoai(muc.sessionId)
  const { tiepNhan, tuChoi, ketThuc } = useChuyenDoiHopThu()
  const [moTuChoi, setMoTuChoi] = useState(false)
  const [lyDo, setLyDo] = useState('')
  const [loi, setLoi] = useState<string | null>(null)

  /*
   * Trạng thái lấy từ KÊNH, không từ `muc.state` của danh sách.
   *
   * Danh sách chỉ làm mới mỗi 60 giây; kênh nhận `hoi-thoai:trang-thai` ngay
   * lập tức. Đọc từ danh sách thì bấm "Tiếp nhận" xong ô nhập vẫn khoá cả
   * phút — và người dùng bấm thêm mấy lần nữa.
   *
   * Chuỗi rỗng = kênh chưa tải xong; lúc đó mượn tạm giá trị của danh sách để
   * thanh nút không nhấp nháy khi mới mở.
   */
  const trangThai = kenh.trangThai === '' ? muc.state : kenh.trangThai
  const { datTrangThai } = kenh

  async function chay(viec: () => Promise<{ state: string }>) {
    setLoi(null)
    try {
      datTrangThai((await viec()).state)
      setMoTuChoi(false)
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không thực hiện được')
    }
  }

  const dangBan = tiepNhan.isPending || tuChoi.isPending || ketThuc.isPending

  return (
    <div className="flex min-h-[32rem] flex-col rounded-xl border border-slate-200 bg-white p-4">
      <KhungChat
        kenh={kenh}
        bien="sang"
        tenHo={`Sinh viên ${muc.hoTenVietTat}`}
        placeholder="Trả lời sinh viên…"
        lyDoKhoa={
          trangThai === 'WAITING_EMPLOYER'
            ? 'Bấm “Tiếp nhận” để bắt đầu trao đổi. Trước đó sinh viên không nhận được tin nào.'
            : trangThai === 'CLOSED'
              ? 'Hội thoại đã kết thúc.'
              : 'Hội thoại chưa ở trạng thái nhắn trực tiếp.'
        }
        trong={
          <p className="py-8 text-center text-sm text-slate-500">
            Sinh viên chưa nhắn gì trong phần được chia sẻ với bạn.
          </p>
        }
        dauTrang={
          <div className="border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  Sinh viên {muc.hoTenVietTat}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {muc.jobId ? (
                    <Link
                      to={`/viec-lam/${muc.jobId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {muc.tenTin ?? 'Xem tin'}
                    </Link>
                  ) : (
                    'Chưa gắn tin cụ thể'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {trangThai === 'WAITING_EMPLOYER' && (
                  <>
                    <Button
                      size="sm"
                      disabled={dangBan}
                      onClick={() => void chay(() => tiepNhan.mutateAsync(muc.sessionId))}
                    >
                      <Check size={15} aria-hidden="true" />
                      Tiếp nhận
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dangBan}
                      onClick={() => setMoTuChoi((v) => !v)}
                    >
                      <X size={15} aria-hidden="true" />
                      Từ chối
                    </Button>
                  </>
                )}
                {trangThai === 'HUMAN_ACTIVE' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={dangBan}
                    onClick={() => void chay(() => ketThuc.mutateAsync(muc.sessionId))}
                  >
                    Kết thúc
                  </Button>
                )}
              </div>
            </div>

            {moTuChoi && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <label htmlFor="ly-do-tu-choi" className="text-xs font-medium text-slate-700">
                  Lý do (không bắt buộc — sinh viên sẽ đọc câu này)
                </label>
                <textarea
                  id="ly-do-tu-choi"
                  rows={2}
                  value={lyDo}
                  maxLength={500}
                  onChange={(e) => setLyDo(e.target.value)}
                  placeholder="Ví dụ: tin này đã tuyển đủ rồi bạn nhé."
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setMoTuChoi(false)}>
                    Huỷ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={dangBan}
                    onClick={() =>
                      void chay(() => tuChoi.mutateAsync({ sessionId: muc.sessionId, lyDo }))
                    }
                  >
                    Gửi từ chối
                  </Button>
                </div>
              </div>
            )}

            {loi && (
              <p role="alert" className="mt-2 text-sm text-rose-700">
                {loi}
              </p>
            )}
          </div>
        }
      />
    </div>
  )
}
