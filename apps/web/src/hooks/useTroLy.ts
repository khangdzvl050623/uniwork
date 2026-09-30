import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, apiFetch } from '@/lib/api'
import { danhDauXong, danhSoTin, gopChu } from '@/lib/gop-tin'
import { moKenhSSE } from '@/lib/sse'
import { layClientSessionId } from '@/lib/phien-chat'
import { useKenhHoiThoai } from '@/hooks/useKenhHoiThoai'

/**
 * Một lượt hỏi trợ lý, từ lúc gõ tới lúc chữ ngừng chảy.
 *
 * Hook này lo phần RIÊNG của trợ lý AI: tạo phiên, chạy SSE, đếm hạn mức,
 * nhận đề nghị chuyển sang nhà tuyển dụng. Phần chung với mọi hội thoại khác —
 * lịch sử, phòng socket, gửi tin cho người thật — nằm ở `useKenhHoiThoai`, vì
 * hộp thư nhà tuyển dụng và hàng đợi hỗ trợ của admin cũng cần đúng luật đó.
 *
 * Phần khó không nằm ở việc gọi API — nó nằm ở ba chỗ:
 *
 *   1. Chờ 15–25 giây trước chữ đầu tiên. Đo thật 2026-09-28: độ trễ Gemini
 *      free tier chia hai cụm, ~1 s hoặc ~15–25 s, không liên quan kích thước
 *      prompt. Nên giao diện PHẢI nói đang làm gì, không được để spinner trần.
 *   2. Gửi lại. Mạng rớt giữa chừng thì phải thử lại bằng ĐÚNG
 *      `clientMessageId` cũ — xem `guiLai`.
 *   3. Phiên sống qua lần tải lại trang, nếu không mỗi lần F5 là một hội thoại
 *      mới và lịch sử cũ biến mất khỏi màn hình dù vẫn nằm trong database.
 */

const KHOA_LUOT = ['tro-ly', 'luot-con-lai'] as const

export type { NguoiGui, TinNhanUI, VaiNguoiNoi } from '@/lib/gop-tin'

export interface DeNghiNTD {
  jobId: string
  tenTin: string
  congTy: string
  lyDo: string
}

interface PhienResponse {
  sessionId: string
  kind: string
  state: string
  jobId: string | null
}

interface LuotConLai {
  conLai: number
  tong: number
  sanSang: boolean
}

export function useLuotConLai() {
  return useQuery({
    queryKey: KHOA_LUOT,
    queryFn: () => apiFetch<LuotConLai>('/api/tro-ly/luot-con-lai'),
  })
}

export function useTroLy(phienChiDinh?: string) {
  const queryClient = useQueryClient()

  const [sessionId, setSessionId] = useState<string | null>(phienChiDinh ?? null)

  /* Lịch sử, phòng socket, gửi tin cho người thật — một bản dùng chung. */
  const kenh = useKenhHoiThoai(sessionId)
  const { themTin, datLoi, datTrangThai } = kenh

  const [dangChay, setDangChay] = useState(false)
  const [toolDangChay, setToolDangChay] = useState<string | null>(null)
  const [deNghi, setDeNghi] = useState<DeNghiNTD | null>(null)

  /** Câu hỏi chưa gửi xong, giữ lại để bấm "gửi lại" mà không gõ lại. */
  /*
   * STATE chu khong phai ref.
   *
   * Nut "gui lai" hien hay khong phu thuoc gia tri nay, ma doi mot `ref` thi
   * React khong ve lai. Ban dau viet bang ref va no van chay — nhung chi vi
   * moi lan doi deu tinh co di kem mot `setState` khac. Do la trung hop, khong
   * phai thiet ke: bo mot `setState` di la nut bien mat, va doc ref luc render
   * con hong han voi concurrent rendering.
   */
  const [chuaXong, setChuaXong] = useState<{ clientMessageId: string; noiDung: string } | null>(
    null,
  )
  const dungLai = useRef<AbortController | null>(null)

  /*
   * Mở phiên. Rẻ, không chạm model, gọi lại bao nhiêu lần cũng được.
   *
   * ===========================================================================
   * HAI CÁCH MỞ, VÀ VÌ SAO PHẢI CÓ CẢ HAI
   * ===========================================================================
   * `phienChiDinh` — mở ĐÚNG hội thoại đó, không tạo gì. Dùng khi người dùng
   * bấm từ danh sách "Hội thoại của tôi".
   *
   * Không có nó thì mở hội thoại theo `clientSessionId` trong localStorage.
   *
   * Cách thứ hai MỘT MÌNH là không đủ, và đó không phải chuyện tiện nghi:
   * thiết kế cho phép sinh viên có nhiều phiên `AI_STUDENT` song song (mỗi nhà
   * tuyển dụng một phiên — xem `chat_mot_handoff_moi_ntd`). Buộc màn hình vào
   * đúng một khoá thì mọi hội thoại còn lại không có đường mở lại: chúng vẫn
   * sống, vẫn nhận tin realtime, và chủ của chúng không bao giờ thấy nữa.
   *
   * CHỈ mở phiên — lịch sử do `useKenhHoiThoai` tải ngay khi `sessionId` có
   * giá trị. Gộp hai việc vào một effect thì mỗi màn hình mới lại phải chép
   * lại đoạn tải lịch sử, và chúng sẽ lệch nhau.
   */
  useEffect(() => {
    let huy = false

    if (phienChiDinh) {
      setSessionId(phienChiDinh)
      return
    }

    void (async () => {
      try {
        const phien = await apiFetch<PhienResponse>('/api/hoi-thoai', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'AI_STUDENT',
            clientSessionId: layClientSessionId('tro-ly'),
          }),
        })
        if (huy) return
        setSessionId(phien.sessionId)
        datTrangThai(phien.state)
      } catch (e) {
        if (!huy) datLoi(e instanceof ApiClientError ? e.message : 'Không mở được hội thoại')
      }
    })()

    return () => {
      huy = true
    }
  }, [phienChiDinh, datLoi, datTrangThai])

  const chay = useCallback(
    async (clientMessageId: string, noiDung: string) => {
      if (!sessionId) return

      datLoi(null)
      setDeNghi(null)
      setDangChay(true)
      setToolDangChay(null)
      setChuaXong({ clientMessageId, noiDung })

      /* Vẽ câu hỏi ngay, không đợi server. Phía server cũng ghi trước khi gọi model. */
      const idTam = `tam-${clientMessageId}`
      themTin((ds) => [...ds, { id: idTam, vai: 'toi', noiDung }])

      const idAi = `ai-${clientMessageId}`

      const dung = new AbortController()
      dungLai.current = dung

      try {
        await moKenhSSE(
          '/api/tro-ly/hoi',
          { sessionId, clientMessageId, noiDung },
          (sk) => {
            if (sk.ten === 'chu') {
              const chu = String(sk.du)
              setToolDangChay(null)
              themTin((ds) => gopChu(ds, idAi, chu))
              return
            }

            if (sk.ten === 'tool') {
              setToolDangChay((sk.du as { ten: string }).ten)
              return
            }

            if (sk.ten === 'de-nghi') {
              setDeNghi(sk.du as DeNghiNTD)
              return
            }

            if (sk.ten === 'loi') {
              datLoi((sk.du as { message: string }).message)
              return
            }

            if (sk.ten === 'phien') {
              /* Gán seq cho câu hỏi vừa vẽ, để lần phát qua socket không tạo bản sao. */
              const seq = (sk.du as { seqCauHoi?: number }).seqCauHoi
              if (typeof seq === 'number') themTin((ds) => danhSoTin(ds, idTam, seq))
              return
            }

            if (sk.ten === 'xong') {
              const seq = (sk.du as { seq: number | null }).seq
              themTin((ds) => {
                const sau = danhDauXong(ds, idAi)
                return typeof seq === 'number' ? danhSoTin(sau, idAi, seq) : sau
              })
              setChuaXong(null)
            }
          },
          dung.signal,
        )
      } catch (e) {
        /*
         * Lỗi TRƯỚC khi kênh mở — hết lượt, đang bận, chưa cấu hình. Giữ nguyên
         * `chuaXong` để nút "gửi lại" dùng lại đúng `clientMessageId`.
         */
        datLoi(e instanceof ApiClientError ? e.message : 'Không gửi được câu hỏi')
      } finally {
        setDangChay(false)
        setToolDangChay(null)
        dungLai.current = null
        void queryClient.invalidateQueries({ queryKey: KHOA_LUOT })
      }
    },
    [sessionId, queryClient, themTin, datLoi],
  )

  const gui = useCallback((noiDung: string) => chay(`cm-${crypto.randomUUID()}`, noiDung), [chay])

  /**
   * Gửi lại bằng ĐÚNG `clientMessageId` cũ, không sinh id mới.
   *
   * Đây là chỗ dễ làm sai nhất. Server dedupe theo `(sessionId, clientMessageId)`:
   * gửi lại cùng id thì nó trả câu trả lời đã có và KHÔNG gọi model lần hai.
   * Đổi id là mất đường nhận lại câu cũ, và tốn thêm một lượt thật trong năm
   * lượt của ngày.
   *
   * Riêng `AI_BUSY` càng phải giữ id: lượt trước còn đang chạy, chờ rồi thử lại
   * chính nó mới đúng.
   */
  const guiLai = useCallback(() => {
    const cu = chuaXong
    if (!cu || dangChay) return
    themTin((ds) => ds.filter((t) => t.id !== `tam-${cu.clientMessageId}`))
    return chay(cu.clientMessageId, cu.noiDung)
  }, [chay, chuaXong, dangChay, themTin])

  /* ------------------------------------------------------ hành động ----- */

  /** AI chỉ ĐỀ NGHỊ; tin chỉ sang nhà tuyển dụng khi người dùng bấm nút này. */
  const chuyenNhaTuyenDung = useCallback(
    async (jobId: string, loiNhan: string) => {
      if (!sessionId) return
      try {
        const kq = await apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/chuyen-ntd`, {
          method: 'POST',
          body: JSON.stringify({ jobId, loiNhan }),
        })
        datTrangThai(kq.state)
        setDeNghi(null)
      } catch (e) {
        datLoi(e instanceof ApiClientError ? e.message : 'Không chuyển được')
      }
    },
    [sessionId, datTrangThai, datLoi],
  )

  const huyCho = useCallback(async () => {
    if (!sessionId) return
    try {
      const kq = await apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/huy-cho`, {
        method: 'POST',
      })
      datTrangThai(kq.state)
    } catch (e) {
      datLoi(e instanceof ApiClientError ? e.message : 'Không huỷ được')
    }
  }, [sessionId, datTrangThai, datLoi])

  const ketThuc = useCallback(async () => {
    if (!sessionId) return
    try {
      const kq = await apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/ket-thuc`, {
        method: 'POST',
      })
      datTrangThai(kq.state)
    } catch (e) {
      datLoi(e instanceof ApiClientError ? e.message : 'Không kết thúc được')
    }
  }, [sessionId, datTrangThai, datLoi])

  const huy = useCallback(() => dungLai.current?.abort(), [])

  useEffect(() => () => dungLai.current?.abort(), [])

  return {
    sessionId,
    tinNhan: kenh.tinNhan,
    dangChay,
    toolDangChay,
    deNghi,
    loi: kenh.loi,
    coTheGuiLai: chuaXong !== null && !dangChay,
    trangThai: kenh.trangThai,
    duocGui: kenh.duocGui,
    gui,
    guiLai,
    huy,
    guiTinNguoi: kenh.guiTin,
    chuyenNhaTuyenDung,
    huyCho,
    ketThuc,
    boDeNghi: () => setDeNghi(null),
  }
}
