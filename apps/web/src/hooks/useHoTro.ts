import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, apiFetch } from '@/lib/api'
import { useKenhHoiThoai } from '@/hooks/useKenhHoiThoai'

/**
 * Kênh hỗ trợ của người dùng — nói chuyện với quản trị viên UniWork.
 *
 * ===========================================================================
 * PHIÊN RIÊNG, KHÔNG PHẢI MỘT TRẠNG THÁI CỦA PHIÊN TRỢ LÝ
 * ===========================================================================
 * `kind = 'AI_SUPPORT'` là một phiên tách hẳn. Lý do nằm ở server
 * (`ho-tro.service.ts`) và nó là lý do về quyền riêng tư, không phải kỹ thuật:
 * admin đọc phiên hỗ trợ TỪ SEQ 1. Nếu hỗ trợ chỉ là một trạng thái của phiên
 * trợ lý thì bấm "liên hệ hỗ trợ" là giao cho admin toàn bộ đoạn người dùng
 * vừa trao đổi riêng với nhà tuyển dụng.
 *
 * Nên muốn đưa ngữ cảnh sang thì người dùng phải TỰ dán vào — tức tự đọc và tự
 * quyết chia sẻ cái gì.
 *
 * ---------------------------------------------------------------------------
 * KHÔNG CÓ AI TRONG LUỒNG NÀY
 * ---------------------------------------------------------------------------
 * Người ta bấm "liên hệ hỗ trợ" chính vì trợ lý không giải quyết được. Cho
 * model trả lời thêm một lượt nữa ở đây là đúng thứ họ vừa từ chối.
 */

interface PhienResponse {
  sessionId: string
  kind: string
  state: string
  jobId: string | null
}

import type { DanhMucHoTro } from '@uniwork/shared'

export function useHoTro(options?: { enabled?: boolean }) {
  const duocChay = options?.enabled ?? true
  const [sessionId, setSessionId] = useState<string | null>(null)
  const kenh = useKenhHoiThoai(sessionId)
  const { datTrangThai, datLoi } = kenh

  const [dangMo, setDangMo] = useState(duocChay)

  useEffect(() => {
    if (!duocChay) {
      setDangMo(false)
      return
    }
    let huy = false

    void (async () => {
      try {
        const phien = await apiFetch<PhienResponse>('/api/hoi-thoai', {
          method: 'POST',
          body: JSON.stringify({ kind: 'AI_SUPPORT' }),
        })
        if (huy) return
        setSessionId(phien.sessionId)
        datTrangThai(phien.state)
      } catch (e) {
        if (!huy) datLoi(e instanceof ApiClientError ? e.message : 'Không mở được kênh hỗ trợ')
      } finally {
        if (!huy) setDangMo(false)
      }
    })()

    return () => {
      huy = true
    }
  }, [duocChay, datTrangThai, datLoi])

  /** `AI_ACTIVE` hoặc `CLOSED` → `WAITING_ADMIN`. KHÔNG tốn lượt AI, không gọi model. */
  const xinGapNguoiThat = useCallback(
    async (
      inputOrMoTa: string | { danhMuc?: DanhMucHoTro; moTa?: string; tomTatAi?: string },
    ) => {
      if (!sessionId) return
      try {
        const body =
          typeof inputOrMoTa === 'string'
            ? { moTa: inputOrMoTa }
            : inputOrMoTa
        const kq = await apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/yeu-cau-ho-tro`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        datTrangThai(kq.state)
      } catch (e) {
        datLoi(e instanceof ApiClientError ? e.message : 'Không gửi được yêu cầu')
      }
    },
    [sessionId, datTrangThai, datLoi],
  )

  const huyYeuCau = useCallback(async () => {
    if (!sessionId) return
    try {
      const kq = await apiFetch<{ state: string }>(`/api/hoi-thoai/${sessionId}/huy-ho-tro`, {
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

  return { kenh, dangMo, xinGapNguoiThat, huyYeuCau, ketThuc }
}
