import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError, apiFetch } from '@/lib/api'
import { gopLichSu, type NguoiGui, type TinNhanUI } from '@/lib/gop-tin'
import { goiSocket, moSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'

/**
 * MỘT hội thoại đã mở: lịch sử, realtime hai chiều, và gửi tin cho người thật.
 *
 * ===========================================================================
 * VÌ SAO TÁCH RA KHỎI `useTroLy`
 * ===========================================================================
 * Bốn màn hình cùng cần đúng những luật này: trang trợ lý của sinh viên, hộp
 * thư nhà tuyển dụng, hàng đợi hỗ trợ của admin, và mọi chỗ mở lại một hội
 * thoại cũ. Chép sang mỗi nơi một bản thì bốn bản sẽ lệch nhau — và chúng lệch
 * theo kiểu không test nào bắt được, vì mỗi bản vẫn tự nhất quán.
 *
 * Đúng cái bẫy `chat.access.ts` phía api đã nêu, chỉ là ở phía web.
 *
 * Hook này KHÔNG biết gì về AI: không SSE, không hạn mức, không đề nghị
 * chuyển. `useTroLy` chồng những thứ đó lên trên. Ranh giới nằm ở chỗ đó vì nó
 * là ranh giới thật — nhà tuyển dụng và admin không bao giờ chạm tới model.
 */

export interface TinTuApi {
  id: string
  seq: number
  senderType: string
  body: string
  createdAt: string
}

interface TraTinNhan {
  tinNhan: TinTuApi[]
  cursor: string
  conNua: boolean
  duocGui: boolean
  state: string
}

export interface KenhHoiThoai {
  tinNhan: TinNhanUI[]
  /**
   * Trạng thái phiên do SERVER quyết. Client chỉ hiển thị, không tự suy.
   *
   * Chuỗi RỖNG nghĩa là chưa biết — chưa tải xong lịch sử. Không đặt mặc định
   * `'AI_ACTIVE'`: mọi màn hình sẽ vẽ "đang hỏi trợ lý" trong vài trăm mili
   * giây đầu, kể cả hộp thư của nhà tuyển dụng nơi trạng thái đó không tồn
   * tại.
   */
  trangThai: string
  duocGui: boolean
  dangTai: boolean
  loi: string | null
  /** Nhãn người gửi của chính người đang xem — để `gopLichSu` vẽ đúng bên. */
  toiLa: NguoiGui
  guiTin: (noiDung: string) => Promise<void>
  /** Sau một chuyển đổi REST (tiếp nhận, kết thúc…) — nhận state mới ngay. */
  datTrangThai: (state: string) => void
  themTin: (capNhat: (ds: TinNhanUI[]) => TinNhanUI[]) => void
  datLoi: (loi: string | null) => void
  /** Ghi nhận cursor mới; dùng khi một đường khác (SSE) đã đọc tới đó. */
  datCursor: (cursor: string) => void
  layCursor: () => string | undefined
}

export function useKenhHoiThoai(sessionId: string | null): KenhHoiThoai {
  /*
   * "Tôi là ai" lấy từ phiên đăng nhập, KHÔNG đặt cứng theo màn hình.
   *
   * `RequireAuth` đã chặn render tới khi biết phiên, nên tới đây `user` luôn
   * có. Giá trị dự phòng chỉ để chiều kiểu — nếu nó thật sự được dùng thì màn
   * hình lẽ ra đã không được vẽ.
   */
  const { user } = useAuth()
  const toiLa: NguoiGui = user?.role ?? 'STUDENT'

  const [tinNhan, setTinNhan] = useState<TinNhanUI[]>([])
  const [trangThai, setTrangThai] = useState<string>('')
  const [duocGui, setDuocGui] = useState(false)
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  /*
   * Cursor ĐỤC — chỉ cất rồi gửi lại, không đọc, không so sánh, không tính.
   *
   * Nó mã hoá "seq lớn nhất server ĐÃ XÉT", không phải "seq lớn nhất client đã
   * nhận" — hai thứ khác nhau khi có tin bị lọc mất vì `visibleToEmployer`.
   * Tự suy ra cursor từ danh sách tin đang có là bỏ sót đúng những tin đó.
   *
   * Để trong ref chứ không state: đổi nó không cần vẽ lại gì, và nó phải đọc
   * được ngay trong callback socket mà không dính giá trị cũ của closure.
   */
  const cursor = useRef<string | undefined>(undefined)

  /* ------------------------------------------------- tải lịch sử ------- */

  useEffect(() => {
    if (!sessionId) return
    let huy = false

    /*
     * Đổi phiên thì XOÁ danh sách cũ trước khi tải.
     *
     * Admin bấm từ ticket này sang ticket kia: không xoá thì tin của người
     * trước nằm lại lẫn với người sau, và `gopLichSu` khử trùng theo `seq` nên
     * nó còn GHI ĐÈ tin cùng số thứ tự — hai cuộc trò chuyện trộn thành một.
     */
    setTinNhan([])
    cursor.current = undefined
    setDangTai(true)
    setLoi(null)

    void (async () => {
      try {
        const cu = await apiFetch<TraTinNhan>(`/api/hoi-thoai/${sessionId}/tin-nhan`)
        if (huy) return
        setTinNhan((ds) => gopLichSu(ds, cu.tinNhan, toiLa))
        cursor.current = cu.cursor
        setDuocGui(cu.duocGui)
        setTrangThai(cu.state)
      } catch (e) {
        if (!huy) setLoi(e instanceof ApiClientError ? e.message : 'Không mở được hội thoại')
      } finally {
        if (!huy) setDangTai(false)
      }
    })()

    return () => {
      huy = true
    }
  }, [sessionId, toiLa])

  /* ------------------------------------------------------- socket ------ */

  useEffect(() => {
    if (!sessionId) return
    const s = moSocket()

    /* Tải bù: mảng RỖNG kèm cursor tiến là kết quả ĐÚNG, không phải lỗi. */
    const taiBu = async () => {
      const kq = await goiSocket<{ tinNhan: TinTuApi[]; cursor: string; conNua: boolean }>(
        s,
        'hoi-thoai:tai-bu',
        { sessionId, cursor: cursor.current },
      )
      if (!kq.ok) return
      cursor.current = kq.cursor
      if (kq.tinNhan.length > 0) setTinNhan((ds) => gopLichSu(ds, kq.tinNhan, toiLa))
    }

    /*
     * Tên phòng do SERVER trả về, client KHÔNG tự ghép chuỗi.
     *
     * Bản đầu để handler tự ghép `hoi-thoai:<id>` trong khi chỗ phát bắn vào
     * `:chu` / `:ntd`. `join` báo thành công, client không nhận được gì, và
     * triệu chứng duy nhất là "realtime không chạy" — không log, không lỗi.
     */
    const vaoPhong = async () => {
      const kq = await goiSocket<{
        cursor: string
        duocGui: boolean
        vai: string
        state: string
      }>(s, 'hoi-thoai:vao', { sessionId })
      if (!kq.ok) {
        setLoi(kq.message ?? 'Không vào được hội thoại')
        return
      }
      /*
       * Cursor server trả về có thể đã đi trước cursor ta đang giữ — nghĩa là
       * có tin mới trong lúc mất kết nối. Tải bù rồi mới nhận cursor đó.
       */
      if (kq.cursor !== cursor.current) await taiBu()
      else cursor.current = kq.cursor
      setDuocGui(kq.duocGui)
      setTrangThai(kq.state)
    }

    const tinMoi = (du: unknown) => {
      const { sessionId: sid, message } = du as { sessionId: string; message: TinTuApi }
      /* Lọc theo id phiên: một socket có thể đang ở nhiều phòng. */
      if (sid !== sessionId) return
      setTinNhan((ds) => gopLichSu(ds, [message], toiLa))
    }

    const doiTrangThai = (du: unknown) => {
      const { state } = du as { state: string }
      setTrangThai(state)
      setDuocGui(state === 'HUMAN_ACTIVE')
    }

    s.on('connect', () => void vaoPhong())
    s.on('hoi-thoai:tin-moi', tinMoi)
    s.on('hoi-thoai:trang-thai', doiTrangThai)
    if (s.connected) void vaoPhong()

    return () => {
      s.off('hoi-thoai:tin-moi', tinMoi)
      s.off('hoi-thoai:trang-thai', doiTrangThai)
      s.emit('hoi-thoai:ra', { sessionId })
    }
  }, [sessionId, toiLa])

  /* ------------------------------------------------------ gửi tin ------ */

  /**
   * ACK tới SAU khi server commit, nên `kq.ok` nghĩa là tin đã nằm trong
   * database — không phải "đã rời khỏi trình duyệt". Đó là khác biệt giữa dấu
   * tick đúng và dấu tick nói dối.
   *
   * KHÔNG tự vẽ tin trước: server phát lại qua `hoi-thoai:tin-moi` với id và
   * `seq` thật, và `gopLichSu` khử trùng theo `seq`.
   */
  const guiTin = useCallback(
    async (noiDung: string) => {
      if (!sessionId) return
      const s = moSocket()
      const kq = await goiSocket<{ messageId: string; seq: number; cursor: string }>(
        s,
        'hoi-thoai:gui',
        { sessionId, clientMessageId: `cm-${crypto.randomUUID()}`, noiDung },
      )
      if (!kq.ok) {
        setLoi(kq.message ?? 'Không gửi được tin nhắn')
        return
      }
      cursor.current = kq.cursor
    },
    [sessionId],
  )

  return {
    tinNhan,
    trangThai,
    duocGui,
    dangTai,
    loi,
    toiLa,
    guiTin,
    datTrangThai: useCallback((state: string) => {
      setTrangThai(state)
      setDuocGui(state === 'HUMAN_ACTIVE')
    }, []),
    themTin: setTinNhan,
    datLoi: setLoi,
    datCursor: useCallback((c: string) => {
      cursor.current = c
    }, []),
    layCursor: useCallback(() => cursor.current, []),
  }
}
