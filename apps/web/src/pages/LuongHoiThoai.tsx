import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DialogChanNTD } from '@/components/hoi-thoai/DialogChanNTD'
import { KhungChat } from '@/components/hoi-thoai/KhungChat'
import { useKenhHoiThoai } from '@/hooks/useKenhHoiThoai'
import { useHoiThoaiCuaToi } from '@/hooks/useHoiThoaiCuaToi'
import { useChuyenDoiLuong } from '@/hooks/useChuyenDoiLuong'

/**
 * MỘT luồng người–người, nhìn từ phía người sở hữu nó.
 *
 * ===========================================================================
 * VÌ SAO KHÔNG DÙNG LẠI `/tro-ly`
 * ===========================================================================
 * Trang trợ lý có bộ đếm lượt, câu mồi, nút gửi lại, thẻ đề nghị chuyển — toàn
 * những thứ chỉ có nghĩa khi đầu kia là model. Nhồi thêm cờ để tắt từng cái
 * cho luồng nhà tuyển dụng là cách chắc chắn nhất để vài tháng nữa không ai
 * đọc nổi component đó.
 *
 * Hai trang, hai việc: `/tro-ly` nói chuyện với máy, trang này nói chuyện với
 * người.
 */
export function LuongHoiThoai() {
  const { id = '' } = useParams()
  const kenh = useKenhHoiThoai(id || null)
  const { data } = useHoiThoaiCuaToi()
  const { huyCho, ketThuc, chan, boChan } = useChuyenDoiLuong()
  const [moChan, setMoChan] = useState(false)

  const muc = data?.hoiThoai.find((h) => h.sessionId === id)
  const laHoTro = muc?.kind === 'AI_SUPPORT'
  const laNTD = muc?.kind === 'NTD'
  const daChan = muc?.daChan === true
  const tenHo = laHoTro ? 'Hỗ trợ UniWork' : (muc?.congTy ?? 'Nhà tuyển dụng')

  const trangThai = kenh.trangThai

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6">
      <Link
        to="/hoi-thoai"
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Hội thoại của tôi
      </Link>

      {kenh.dangTai && !muc ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-brand-600" />
          <span className="sr-only">Đang mở hội thoại</span>
        </div>
      ) : (
        <div className="flex min-h-[28rem] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4">
          <KhungChat
            kenh={kenh}
            bien="sang"
            tenHo={tenHo}
            placeholder={`Nhắn cho ${tenHo.toLowerCase()}…`}
            lyDoKhoa={
              daChan
                ? 'Bạn đã chặn nhà tuyển dụng này. Bỏ chặn để trao đổi lại.'
                : trangThai === 'WAITING_EMPLOYER'
                  ? 'Đang chờ nhà tuyển dụng tiếp nhận. Bạn nhắn được ngay khi họ trả lời.'
                  : trangThai === 'WAITING_ADMIN'
                    ? 'Yêu cầu đã vào hàng đợi. Bạn nhắn được ngay khi có quản trị viên tiếp nhận.'
                    : trangThai === 'CLOSED'
                      ? 'Hội thoại đã kết thúc. Hỏi lại nơi này thì chính hội thoại này mở lại, giữ nguyên lịch sử.'
                      : 'Hội thoại chưa ở trạng thái nhắn trực tiếp.'
            }
            trong={<p className="py-8 text-center text-sm text-slate-500">Chưa có tin nhắn nào.</p>}
            dauTrang={
              <div className="border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{tenHo}</p>
                    {muc?.tenTin && (
                      <p className="truncate text-xs text-slate-500">
                        {muc.jobId ? (
                          <Link
                            to={`/viec-lam/${muc.jobId}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {muc.tenTin}
                          </Link>
                        ) : (
                          muc.tenTin
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(trangThai === 'WAITING_EMPLOYER' || trangThai === 'WAITING_ADMIN') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void huyCho.mutateAsync({ sessionId: id, laHoTro })}
                      >
                        Huỷ yêu cầu
                      </Button>
                    )}
                    {trangThai === 'HUMAN_ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void ketThuc.mutateAsync(id)}
                      >
                        Kết thúc
                      </Button>
                    )}
                    {laNTD && !daChan && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMoChan(true)}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        <Ban size={14} aria-hidden="true" />
                        Chặn
                      </Button>
                    )}
                  </div>
                </div>

                {/*
                Đã chặn: nói rõ ngay đầu luồng, kèm lối bỏ chặn. Đây cũng là
                nơi nút "Mở hội thoại" đưa sinh viên tới khi họ hỏi lại một
                nơi đã chặn — nên nút bỏ chặn PHẢI nằm ở đây.
              */}
                {daChan && (
                  <div
                    role="status"
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900"
                  >
                    <p>
                      Bạn đã chặn {tenHo}. Họ không nhắn được cho bạn; đơn ứng tuyển không bị ảnh
                      hưởng.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={boChan.isPending}
                      onClick={() => void boChan.mutateAsync(id)}
                    >
                      Bỏ chặn
                    </Button>
                  </div>
                )}
              </div>
            }
          />
        </div>
      )}

      {laNTD && (
        <DialogChanNTD
          congTy={tenHo}
          open={moChan}
          onOpenChange={setMoChan}
          onChan={() => chan.mutateAsync(id)}
        />
      )}
    </div>
  )
}
