import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { TinNhanUI } from '@/lib/gop-tin'

/** Cách đáy dưới ngần này thì coi là "đang ở cuối cuộc trò chuyện". */
const NGUONG_GAN_DAY_PX = 120

/**
 * Cuộn danh sách tin nhắn — dùng chung cho `KhungChat` và trang trợ lý.
 *
 * ===========================================================================
 * BA LUẬT, VÀ VÌ SAO PHÂN TRANG BẮT PHẢI CÓ CẢ BA
 * ===========================================================================
 * Bản trước chỉ có một dòng: danh sách đổi thì cuộn xuống đáy. Đúng khi tin
 * chỉ tới theo một chiều. Từ khi tải được trang CŨ HƠN thì dòng đó hỏng theo
 * hai kiểu, cả hai đều không có lỗi nào bắn ra:
 *
 *   Bấm "Tải tin cũ hơn" → 50 tin chèn lên đầu → danh sách đổi → màn hình
 *   GIẬT xuống đáy. Người dùng vừa định đọc tin cũ thì bị đưa đi chỗ khác.
 *
 *   Đang cuộn lên đọc lịch sử → bên kia nhắn một câu → bị KÉO xuống đáy, mất
 *   chỗ đang đọc. Càng có nhiều lịch sử để đọc thì càng hay gặp.
 *
 * Nên:
 *
 *   1. CHÈN LÊN ĐẦU  → giữ nguyên vị trí của tin đang nằm trên cùng (neo).
 *   2. CÓ TIN MỚI    → chỉ cuộn xuống nếu người dùng ĐANG ở gần đáy.
 *   3. MÌNH VỪA GỬI  → luôn cuộn xuống. Người gửi muốn thấy câu mình vừa gõ.
 *
 * ---------------------------------------------------------------------------
 * TỰ TÌM PHẦN TỬ ĐANG CUỘN, KHÔNG GIẢ ĐỊNH
 * ---------------------------------------------------------------------------
 * Khung chat không phải lúc nào cũng tự cuộn: nhiều trang đặt `min-h` chứ không
 * `h`, nên khung giãn ra và CẢ TRANG cuộn. Khu quản trị lại có vùng cuộn riêng.
 * Hook đi ngược từ đáy danh sách lên tìm phần tử thật sự đang cuộn, không có
 * thì dùng cửa sổ — một bản cho mọi bố cục.
 *
 * KHÔNG có test tự động cho phần cuộn: happy-dom không tính bố cục, mọi
 * `getBoundingClientRect` trả 0. Phần thuần (`gopLichSu`) có test; phần này
 * phải kiểm bằng tay trên trình duyệt.
 */
export function useCuonDanhSach(tinNhan: TinNhanUI[], phu?: unknown) {
  const cuoiRef = useRef<HTMLDivElement>(null)
  const ganDay = useRef(true)
  const neo = useRef<{ id: string; top: number } | null>(null)

  /*
   * Lắng nghe cuộn ở pha CAPTURE trên `window`: sự kiện `scroll` không nổi
   * bọt, nhưng capture bắt được cuộn của MỌI phần tử — đúng thứ cần khi chưa
   * biết phần tử nào đang cuộn.
   */
  useEffect(() => {
    const capNhat = () => {
      ganDay.current = khoangCachDay(timCha(cuoiRef.current)) < NGUONG_GAN_DAY_PX
    }
    window.addEventListener('scroll', capNhat, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', capNhat, { capture: true })
  }, [])

  /*
   * `useLayoutEffect` chứ không `useEffect`: phải bù vị trí TRƯỚC khi trình
   * duyệt vẽ. Bù sau khi vẽ thì người dùng thấy một khung hình nhảy rồi mới
   * về chỗ cũ.
   */
  useLayoutEffect(() => {
    const n = neo.current
    if (n) {
      neo.current = null
      const el = document.querySelector(`[data-tin-id="${n.id}"]`)
      if (el) cuonThem(timCha(cuoiRef.current), el.getBoundingClientRect().top - n.top)
      return
    }
    if (ganDay.current) cuoiRef.current?.scrollIntoView({ block: 'end' })
  }, [tinNhan, phu])

  /** Gọi NGAY TRƯỚC khi chèn tin cũ, với id của tin đang nằm trên cùng. */
  const ghiNeo = useCallback((idDau: string | undefined) => {
    if (!idDau) return
    const el = document.querySelector(`[data-tin-id="${idDau}"]`)
    if (el) neo.current = { id: idDau, top: el.getBoundingClientRect().top }
  }, [])

  /** Gọi khi CHÍNH người dùng gửi tin — lần đổi kế tiếp sẽ cuộn xuống đáy. */
  const veDay = useCallback(() => {
    ganDay.current = true
  }, [])

  return { cuoiRef, ghiNeo, veDay }
}

/** Phần tử tổ tiên gần nhất đang thật sự cuộn được. `null` = cửa sổ. */
function timCha(el: HTMLElement | null): HTMLElement | null {
  let cur = el?.parentElement ?? null
  while (cur) {
    const oy = getComputedStyle(cur).overflowY
    if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight) return cur
    cur = cur.parentElement
  }
  return null
}

function khoangCachDay(cha: HTMLElement | null): number {
  if (!cha) {
    return document.documentElement.scrollHeight - window.scrollY - window.innerHeight
  }
  return cha.scrollHeight - cha.scrollTop - cha.clientHeight
}

function cuonThem(cha: HTMLElement | null, dy: number): void {
  if (dy === 0) return
  if (cha) cha.scrollTop += dy
  else window.scrollBy(0, dy)
}
