import { useEffect, useMemo, useState } from 'react'
import { Headset, Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/admin/Charts'
import { PageHeader } from '@/components/admin/Table'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useKenhHoiThoai } from '@/hooks/useKenhHoiThoai'
import { useChuyenDoiHoTro, useHangDoiHoTro, type MucHangDoiHoTro } from '@/hooks/useHoTroAdmin'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Hàng đợi hỗ trợ — admin trả lời người dùng đã bấm "Liên hệ hỗ trợ".
 *
 * ===========================================================================
 * ADMIN CHỈ ĐỌC ĐƯỢC PHIÊN HỖ TRỢ, KHÔNG ĐỌC ĐƯỢC HỘI THOẠI SV–NTD
 * ===========================================================================
 * Ranh giới đó cưỡng chế ở server (`quyenTruyCapPhien` trả `null` cho hai kênh
 * kia, có test canh), không phải ở màn hình này. Nhưng nó quyết định hình dạng
 * màn hình: KHÔNG có ô tìm kiếm hội thoại, KHÔNG có danh sách "tất cả phiên
 * chat". Chỉ những phiên người dùng chủ động mở ra xin giúp.
 *
 * Bày một ô tìm kiếm rồi để nó luôn trả về rỗng là mời admin đi tìm cách lách.
 */

const NHAN: Record<string, { chu: string; tone: 'ok' | 'wait' | 'bad' }> = {
  WAITING_ADMIN: { chu: 'Đang chờ', tone: 'wait' },
  HUMAN_ACTIVE: { chu: 'Đang trả lời', tone: 'ok' },
  CLOSED: { chu: 'Đã đóng', tone: 'bad' },
}

const TEN_VAI: Record<string, string> = {
  STUDENT: 'Sinh viên',
  EMPLOYER: 'Nhà tuyển dụng',
  ADMIN: 'Quản trị viên',
}

/** Chờ bao lâu rồi — con số này là thứ admin cần nhất để chọn ai trước. */
function choBaoLau(iso: string | null): string {
  if (!iso) return '—'
  const phut = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (phut < 1) return 'vừa xong'
  if (phut < 60) return `${phut} phút`
  const gio = Math.floor(phut / 60)
  if (gio < 24) return `${gio} giờ`
  return `${Math.floor(gio / 24)} ngày`
}

export function AdminHoTro() {
  const { data, isLoading } = useHangDoiHoTro()
  const [dangChon, setDangChon] = useState<string | null>(null)

  /*
   * `useMemo` không phải để tối ưu — nó để effect bên dưới KHÔNG chạy mỗi lần
   * render. `data?.hoTro ?? []` sinh một mảng mới mỗi lần, nên mảng phụ thuộc
   * của effect đổi liên tục.
   */
  const ds = useMemo(() => data?.hoTro ?? [], [data])

  /* Chỉ tự chọn khi chưa chọn gì — nếu không thì mỗi 30 giây màn hình lại nhảy. */
  useEffect(() => {
    if (dangChon === null && ds.length > 0) setDangChon(ds[0]!.sessionId)
  }, [ds, dangChon])

  const chon = ds.find((m) => m.sessionId === dangChon) ?? null
  const dangCho = ds.filter((m) => m.state === 'WAITING_ADMIN').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hàng đợi hỗ trợ"
        subtitle={
          dangCho > 0
            ? `${dangCho} người đang chờ trả lời.`
            : 'Không có ai đang chờ. Phiên đang trả lời vẫn hiện ở đây.'
        }
      />

      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        <DanhSach ds={ds} dangTai={isLoading} dangChon={dangChon} onChon={setDangChon} />

        {chon ? (
          <ChiTiet key={chon.sessionId} muc={chon} />
        ) : (
          <div className="dash-card flex min-h-80 items-center justify-center rounded-xl">
            <p className="text-dash-muted text-sm">
              {isLoading ? 'Đang tải…' : 'Không có phiên hỗ trợ nào đang mở.'}
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
  ds: MucHangDoiHoTro[]
  dangTai: boolean
  dangChon: string | null
  onChon: (id: string) => void
}) {
  if (dangTai) {
    return (
      <div className="dash-card flex h-40 items-center justify-center rounded-xl">
        <Loader2 size={20} className="text-dash-accent animate-spin" />
        <span className="sr-only">Đang tải hàng đợi</span>
      </div>
    )
  }

  if (ds.length === 0) {
    return (
      <div className="dash-card rounded-xl p-6 text-center">
        <Headset size={24} className="text-dash-muted mx-auto" aria-hidden="true" />
        <p className="text-dash-text mt-2 text-sm font-medium">Hàng đợi trống</p>
        <p className="text-dash-muted mt-1 text-xs">
          Yêu cầu mới sẽ hiện ở đây trong vòng 30 giây.
        </p>
      </div>
    )
  }

  return (
    <ul className="dash-card divide-dash-line divide-y overflow-hidden rounded-xl">
      {ds.map((m) => {
        const nhan = NHAN[m.state]
        const dangMo = m.sessionId === dangChon
        return (
          <li key={m.sessionId}>
            <button
              type="button"
              onClick={() => onChon(m.sessionId)}
              aria-current={dangMo ? 'true' : undefined}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors',
                'focus-visible:outline-dash-accent focus-visible:outline-2 focus-visible:-outline-offset-2',
                dangMo ? 'bg-dash-raised' : 'hover:bg-dash-raised/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-dash-text truncate text-sm font-semibold">
                  {TEN_VAI[m.ownerVai] ?? m.ownerVai}
                </span>
                <span className="text-dash-muted shrink-0 text-xs">
                  {choBaoLau(m.handoffRequestedAt)}
                </span>
              </div>
              <p className="text-dash-muted mt-0.5 line-clamp-2 text-xs">
                {m.moTaDau ?? 'Không ghi mô tả'}
              </p>
              {nhan && (
                <span className="mt-1.5 inline-block">
                  <StatusBadge tone={nhan.tone}>{nhan.chu}</StatusBadge>
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------- chi tiết -- */

function ChiTiet({ muc }: { muc: MucHangDoiHoTro }) {
  const kenh = useKenhHoiThoai(muc.sessionId)
  const { tiepNhan, ketThuc } = useChuyenDoiHoTro()
  const [loi, setLoi] = useState<string | null>(null)

  const trangThai = kenh.trangThai === '' ? muc.state : kenh.trangThai
  const { datTrangThai } = kenh

  async function chay(viec: () => Promise<{ state: string }>) {
    setLoi(null)
    try {
      datTrangThai((await viec()).state)
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không thực hiện được')
    }
  }

  const dangBan = tiepNhan.isPending || ketThuc.isPending
  const tenNguoi = TEN_VAI[muc.ownerVai] ?? 'Người dùng'

  /*
   * `duocGui` false ở trạng thái WAITING_ADMIN có HAI nguyên nhân khác hẳn
   * nhau: chưa ai nhận, hoặc admin KHÁC đã nhận rồi. Server phân biệt được
   * (`handoffAdminUserId === user.id`), màn hình thì không — nên câu giải
   * thích phải nói cả hai khả năng, đừng khẳng định cái mình không biết.
   */
  const lyDoKhoa =
    trangThai === 'WAITING_ADMIN'
      ? 'Bấm “Tiếp nhận” để trả lời. Nếu nút không ăn thì một quản trị viên khác đã nhận phiên này.'
      : trangThai === 'HUMAN_ACTIVE'
        ? 'Phiên này do quản trị viên khác đang trả lời.'
        : 'Phiên hỗ trợ đã đóng.'

  return (
    <div className="dash-card flex min-h-[32rem] flex-col rounded-xl p-4">
      <KhungChat
        kenh={kenh}
        bien="quan-tri"
        tenHo={tenNguoi}
        placeholder={`Trả lời ${tenNguoi.toLowerCase()}…`}
        lyDoKhoa={lyDoKhoa}
        trong={
          <p className="text-dash-muted py-8 text-center text-sm">
            Người dùng chưa nhắn gì trong phiên này.
          </p>
        }
        dauTrang={
          <div className="border-dash-line border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-dash-text truncate font-semibold">{tenNguoi} cần hỗ trợ</p>
                <p className="text-dash-muted truncate text-xs">
                  Chờ {choBaoLau(muc.handoffRequestedAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {trangThai === 'WAITING_ADMIN' && (
                  <button
                    type="button"
                    disabled={dangBan}
                    onClick={() => void chay(() => tiepNhan.mutateAsync(muc.sessionId))}
                    className="bg-dash-accent text-dash-accent-ink h-9 rounded-lg px-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Tiếp nhận
                  </button>
                )}
                {trangThai === 'HUMAN_ACTIVE' && kenh.duocGui && (
                  <button
                    type="button"
                    disabled={dangBan}
                    onClick={() => void chay(() => ketThuc.mutateAsync(muc.sessionId))}
                    className="border-dash-line text-dash-muted hover:text-dash-text h-9 rounded-lg border px-3 text-sm transition-colors disabled:opacity-50"
                  >
                    Kết thúc
                  </button>
                )}
              </div>
            </div>

            {muc.moTaDau && (
              <p className="bg-dash-raised text-dash-text mt-3 rounded-lg px-3 py-2 text-sm">
                <span className="text-dash-muted block text-xs">Họ mô tả lúc gửi yêu cầu</span>
                {muc.moTaDau}
              </p>
            )}

            {loi && (
              <p role="alert" className="text-dash-bad mt-2 text-sm">
                {loi}
              </p>
            )}
          </div>
        }
      />
    </div>
  )
}
