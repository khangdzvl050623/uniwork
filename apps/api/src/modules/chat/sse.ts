import type { Response } from 'express'

/**
 * Server-Sent Events — một chiều, server đẩy, client chỉ nghe.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO SSE CHỨ KHÔNG PHẢI WEBSOCKET CHO LUỒNG NÀY
 * ---------------------------------------------------------------------------
 * Chữ chỉ chảy một chiều. SSE đi trên HTTP thường nên nó qua được mọi proxy,
 * dùng lại nguyên bộ xác thực và CORS đã có, và trình duyệt tự kết nối lại.
 * WebSocket vẫn cần cho hội thoại với người thật (bước 6) vì chỗ đó hai chiều.
 *
 * ---------------------------------------------------------------------------
 * LUẬT QUAN TRỌNG NHẤT: SAU KHI GỬI HEADER THÌ KHÔNG ĐỔI ĐƯỢC HTTP STATUS
 * ---------------------------------------------------------------------------
 * Mọi lỗi phát sinh sau `moKenh()` phải đi bằng sự kiện `loi`. Gọi `res.status`
 * lúc đó không có tác dụng gì và Express sẽ ghi một cảnh báo "headers already
 * sent" — lỗi biến mất, người dùng nhìn màn hình đứng im.
 *
 * Nên thứ tự của endpoint là: kiểm hết mọi thứ kiểm được → giữ lượt → RỒI MỚI
 * mở kênh.
 */
export class KenhSSE {
  private dong = false
  private nhipTim: NodeJS.Timeout | null = null

  constructor(private readonly res: Response) {}

  moKenh(): void {
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      /*
       * `no-transform` quan trọng ngang `no-cache`: một số proxy nén hoặc gom
       * response lại cho "hiệu quả", và gom một stream tức là người dùng không
       * thấy gì cho tới khi cả câu trả lời xong — đúng thứ SSE sinh ra để tránh.
       */
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      /* Nginx (Render đặt app sau nginx) đệm response theo mặc định. Tắt riêng. */
      'X-Accel-Buffering': 'no',
    })
    this.res.flushHeaders()

    /*
     * Nhịp tim 15 giây. Không có nó, một kết nối im lặng lâu hơn thời gian chờ
     * của proxy sẽ bị cắt giữa chừng — hay gặp đúng lúc model đang suy nghĩ
     * trước khi nhả chữ đầu tiên.
     *
     * Dòng bắt đầu bằng dấu hai chấm là chú thích theo chuẩn SSE: giữ kết nối
     * sống mà không sinh ra sự kiện nào ở phía client.
     */
    this.nhipTim = setInterval(() => {
      if (!this.dong) this.res.write(': nhip\n\n')
    }, 15_000)
  }

  /**
   * `du` luôn đi qua `JSON.stringify`.
   *
   * Bắt buộc, không phải cho gọn: khung SSE ngăn cách các sự kiện bằng hai dấu
   * xuống dòng. Một mẩu chữ model sinh ra có chứa `\n\n` — mà câu trả lời có
   * xuống dòng thì rất hay có — sẽ cắt sự kiện làm đôi và client đọc ra rác.
   * `JSON.stringify` biến nó thành `\\n`, hết đường cắt nhầm.
   */
  phat(ten: string, du: unknown): void {
    if (this.dong) return
    this.res.write(`event: ${ten}\ndata: ${JSON.stringify(du)}\n\n`)
  }

  dongKenh(): void {
    if (this.dong) return
    this.dong = true
    if (this.nhipTim !== null) clearInterval(this.nhipTim)
    this.res.end()
  }

  /** Người dùng đóng tab hoặc mất mạng. Nơi gọi dùng để huỷ lượt đang chạy. */
  khiNguoiDungRoiDi(xuLy: () => void): void {
    this.res.on('close', () => {
      if (this.nhipTim !== null) clearInterval(this.nhipTim)
      this.dong = true
      xuLy()
    })
  }
}
