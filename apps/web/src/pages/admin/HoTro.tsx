import { useEffect, useMemo, useState } from 'react'
import { Headset, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react'
import { DANH_MUC_HO_TRO_LABELS, type DanhMucHoTro } from '@uniwork/shared'
import { StatusBadge } from '@/components/admin/Charts'
import { PageHeader } from '@/components/admin/Table'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useKenhHoiThoai } from '@/hooks/useKenhHoiThoai'
import {
  useChuyenDoiHoTro,
  useHangDoiHoTro,
  type MucHangDoiHoTro,
  type MucHoTroKhach,
} from '@/hooks/useHoTroAdmin'
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
 */

const NHAN: Record<string, { chu: string; tone: 'ok' | 'wait' | 'bad' }> = {
  WAITING_ADMIN: { chu: 'Đang chờ', tone: 'wait' },
  HUMAN_ACTIVE: { chu: 'Đang trả lời', tone: 'ok' },
  CLOSED: { chu: 'Đã đóng', tone: 'bad' },
  RESOLVED: { chu: 'Đã giải quyết', tone: 'ok' },
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
  const [tab, setTab] = useState<'THANH_VIEN' | 'KHACH'>('THANH_VIEN')
  const [dangChon, setDangChon] = useState<string | null>(null)
  const [dangChonKhach, setDangChonKhach] = useState<string | null>(null)

  const ds = useMemo(() => data?.hoTro ?? [], [data])
  const dsKhach = useMemo(() => data?.hoTroKhach ?? [], [data])

  useEffect(() => {
    if (dangChon === null && ds.length > 0) setDangChon(ds[0]!.sessionId)
  }, [ds, dangChon])

  useEffect(() => {
    if (dangChonKhach === null && dsKhach.length > 0) setDangChonKhach(dsKhach[0]!.id)
  }, [dsKhach, dangChonKhach])

  const chon = ds.find((m) => m.sessionId === dangChon) ?? null
  const chonKhach = dsKhach.find((m) => m.id === dangChonKhach) ?? null

  const dangCho = ds.filter((m) => m.state === 'WAITING_ADMIN').length
  const dangChoKhach = dsKhach.filter((m) => m.status === 'WAITING_ADMIN').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hàng đợi hỗ trợ UniWork"
        subtitle={
          dangCho + dangChoKhach > 0
            ? `${dangCho} phiên người dùng và ${dangChoKhach} yêu cầu của khách đang chờ xử lý.`
            : 'Hiện không có yêu cầu nào đang chờ xử lý.'
        }
      />

      {/* Ranh giới bảo mật */}
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
        <ShieldCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          <strong>Ranh giới bảo mật:</strong> Quản trị viên chỉ có quyền truy cập vào các phiên hỗ trợ
          chủ động tại đây. Tuyệt đối không có quyền đọc trộm hội thoại riêng SV–NTD hoặc lịch sử AI cá nhân.
        </span>
      </div>

      {/* Tab chuyển đổi */}
      <div className="flex border-dash-line border-b gap-4">
        <button
          type="button"
          onClick={() => setTab('THANH_VIEN')}
          className={cn(
            'pb-2.5 text-sm font-medium transition-colors border-b-2',
            tab === 'THANH_VIEN'
              ? 'border-dash-accent text-dash-text'
              : 'border-transparent text-dash-muted hover:text-dash-text',
          )}
        >
          Phiên thành viên ({ds.length})
          {dangCho > 0 && (
            <span className="ml-2 rounded-full bg-dash-wait/15 px-2 py-0.5 text-xs text-dash-wait">
              {dangCho} chờ
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('KHACH')}
          className={cn(
            'pb-2.5 text-sm font-medium transition-colors border-b-2',
            tab === 'KHACH'
              ? 'border-dash-accent text-dash-text'
              : 'border-transparent text-dash-muted hover:text-dash-text',
          )}
        >
          Khách chưa đăng nhập ({dsKhach.length})
          {dangChoKhach > 0 && (
            <span className="ml-2 rounded-full bg-dash-wait/15 px-2 py-0.5 text-xs text-dash-wait">
              {dangChoKhach} chờ
            </span>
          )}
        </button>
      </div>

      {tab === 'THANH_VIEN' && (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
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
      )}

      {tab === 'KHACH' && (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <DanhSachKhach
            ds={dsKhach}
            dangTai={isLoading}
            dangChon={dangChonKhach}
            onChon={setDangChonKhach}
          />

          {chonKhach ? (
            <ChiTietKhach key={chonKhach.id} muc={chonKhach} />
          ) : (
            <div className="dash-card flex min-h-80 items-center justify-center rounded-xl">
              <p className="text-dash-muted text-sm">
                {isLoading ? 'Đang tải…' : 'Chưa có yêu cầu hỗ trợ nào từ khách.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ danh sách thành viên -- */

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
        const tenDanhMuc = m.danhMuc
          ? DANH_MUC_HO_TRO_LABELS[m.danhMuc as DanhMucHoTro] ?? m.danhMuc
          : null

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

              {tenDanhMuc && (
                <span className="mt-1 inline-block rounded bg-dash-line/50 px-1.5 py-0.5 text-[11px] font-medium text-dash-muted">
                  {tenDanhMuc}
                </span>
              )}

              <p className="text-dash-muted mt-1 line-clamp-2 text-xs">
                {m.moTaDau ?? 'Không ghi mô tả'}
              </p>

              {nhan && (
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge tone={nhan.tone}>{nhan.chu}</StatusBadge>
                  {m.handoffAdminUserId && (
                    <span className="text-[11px] text-dash-muted">Đã nhận</span>
                  )}
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------- chi tiết thành viên -- */

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
  const tenDanhMuc = muc.danhMuc
    ? DANH_MUC_HO_TRO_LABELS[muc.danhMuc as DanhMucHoTro] ?? muc.danhMuc
    : null

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
                <div className="flex items-center gap-2">
                  <p className="text-dash-text truncate font-semibold">{tenNguoi} cần hỗ trợ</p>
                  {tenDanhMuc && (
                    <span className="rounded bg-dash-line/50 px-2 py-0.5 text-xs text-dash-muted">
                      {tenDanhMuc}
                    </span>
                  )}
                </div>
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
                    Đã giải quyết / Đóng
                  </button>
                )}
              </div>
            </div>

            {muc.moTaDau && (
              <p className="bg-dash-raised text-dash-text mt-3 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
                <span className="text-dash-muted block text-xs">Thông tin xác nhận khi gửi yêu cầu</span>
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

/* ------------------------------------------------------------ danh sách khách -- */

function DanhSachKhach({
  ds,
  dangTai,
  dangChon,
  onChon,
}: {
  ds: MucHoTroKhach[]
  dangTai: boolean
  dangChon: string | null
  onChon: (id: string) => void
}) {
  if (dangTai) {
    return (
      <div className="dash-card flex h-40 items-center justify-center rounded-xl">
        <Loader2 size={20} className="text-dash-accent animate-spin" />
        <span className="sr-only">Đang tải danh sách khách</span>
      </div>
    )
  }

  if (ds.length === 0) {
    return (
      <div className="dash-card rounded-xl p-6 text-center">
        <Headset size={24} className="text-dash-muted mx-auto" aria-hidden="true" />
        <p className="text-dash-text mt-2 text-sm font-medium">Chưa có yêu cầu nào từ khách</p>
        <p className="text-dash-muted mt-1 text-xs">
          Khách chưa đăng nhập xác minh OTP email sẽ hiển thị tại đây.
        </p>
      </div>
    )
  }

  return (
    <ul className="dash-card divide-dash-line divide-y overflow-hidden rounded-xl">
      {ds.map((m) => {
        const nhan = NHAN[m.status]
        const dangMo = m.id === dangChon
        const tenDanhMuc = DANH_MUC_HO_TRO_LABELS[m.danhMuc as DanhMucHoTro] ?? m.danhMuc

        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onChon(m.id)}
              aria-current={dangMo ? 'true' : undefined}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors',
                'focus-visible:outline-dash-accent focus-visible:outline-2 focus-visible:-outline-offset-2',
                dangMo ? 'bg-dash-raised' : 'hover:bg-dash-raised/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-dash-text truncate text-sm font-semibold">{m.hoTen}</span>
                <span className="text-dash-muted shrink-0 text-xs">{choBaoLau(m.createdAt)}</span>
              </div>
              <p className="text-dash-muted truncate text-xs">{m.email}</p>

              <span className="mt-1 inline-block rounded bg-dash-line/50 px-1.5 py-0.5 text-[11px] font-medium text-dash-muted">
                {tenDanhMuc}
              </span>

              <p className="text-dash-muted mt-1 line-clamp-2 text-xs">{m.moTa}</p>

              {nhan && (
                <div className="mt-2">
                  <StatusBadge tone={nhan.tone}>{nhan.chu}</StatusBadge>
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------- chi tiết khách -- */

function ChiTietKhach({ muc }: { muc: MucHoTroKhach }) {
  const { xuLyKhach } = useChuyenDoiHoTro()
  const [ghiChu, setGhiChu] = useState(muc.ghiChuXuLy ?? '')
  const [loi, setLoi] = useState<string | null>(null)

  const tenDanhMuc = DANH_MUC_HO_TRO_LABELS[muc.danhMuc as DanhMucHoTro] ?? muc.danhMuc
  const nhan = NHAN[muc.status]

  async function xuLy(status: 'RESOLVED' | 'CLOSED') {
    setLoi(null)
    try {
      await xuLyKhach.mutateAsync({
        ticketId: muc.id,
        status,
        ghiChu: ghiChu.trim() || undefined,
      })
    } catch (e) {
      setLoi(e instanceof ApiClientError ? e.message : 'Không cập nhật được yêu cầu')
    }
  }

  return (
    <div className="dash-card flex min-h-[32rem] flex-col rounded-xl p-5">
      <div className="border-dash-line flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-dash-text text-base font-bold">{muc.hoTen}</h2>
            <span className="rounded bg-dash-line/50 px-2 py-0.5 text-xs text-dash-muted">
              {tenDanhMuc}
            </span>
          </div>
          <p className="text-dash-muted text-xs">Gửi lúc: {choBaoLau(muc.createdAt)}</p>
        </div>

        {nhan && <StatusBadge tone={nhan.tone}>{nhan.chu}</StatusBadge>}
      </div>

      <div className="mt-4 space-y-4">
        {/* Thông tin liên hệ đã xác minh */}
        <div className="bg-dash-raised rounded-lg p-3 text-sm">
          <p className="text-dash-muted mb-2 text-xs font-semibold uppercase tracking-wider">
            Thông tin liên hệ (Đã xác thực OTP)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-dash-text text-xs">
              <Mail size={14} className="text-dash-muted" />
              <span>Email: <strong>{muc.email}</strong></span>
            </div>
            {muc.phone && (
              <div className="flex items-center gap-2 text-dash-text text-xs">
                <Phone size={14} className="text-dash-muted" />
                <span>SĐT: <strong>{muc.phone}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Nội dung vấn đề */}
        <div>
          <p className="text-dash-muted mb-1 text-xs font-semibold uppercase tracking-wider">
            Mô tả sự cố từ khách
          </p>
          <div className="bg-dash-raised text-dash-text rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {muc.moTa}
          </div>
        </div>

        {/* Ghi chú xử lý của admin */}
        <div>
          <label htmlFor="ghi-chu-xu-ly" className="text-dash-muted block mb-1 text-xs font-semibold uppercase tracking-wider">
            Ghi chú xử lý của Admin
          </label>
          <textarea
            id="ghi-chu-xu-ly"
            rows={3}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="Nhập ghi chú kết quả giải quyết hoặc nội dung phản hồi gửi qua email..."
            className="border-dash-line text-dash-text w-full resize-none rounded-lg border bg-transparent p-3 text-sm outline-none focus:border-dash-accent"
          />
        </div>

        {loi && (
          <p role="alert" className="text-dash-bad text-xs">
            {loi}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {muc.status === 'WAITING_ADMIN' && (
            <>
              <button
                type="button"
                disabled={xuLyKhach.isPending}
                onClick={() => void xuLy('CLOSED')}
                className="border-dash-line text-dash-muted hover:text-dash-text h-9 rounded-lg border px-3 text-sm transition-colors disabled:opacity-50"
              >
                Đóng yêu cầu
              </button>
              <button
                type="button"
                disabled={xuLyKhach.isPending}
                onClick={() => void xuLy('RESOLVED')}
                className="bg-dash-accent text-dash-accent-ink h-9 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Đã giải quyết
              </button>
            </>
          )}

          {muc.status !== 'WAITING_ADMIN' && (
            <button
              type="button"
              disabled={xuLyKhach.isPending}
              onClick={() => void xuLy(muc.status === 'RESOLVED' ? 'RESOLVED' : 'CLOSED')}
              className="border-dash-line text-dash-muted hover:text-dash-text h-9 rounded-lg border px-3 text-sm transition-colors disabled:opacity-50"
            >
              Cập nhật ghi chú
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
