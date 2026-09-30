/**
 * Khe cắm cho tầng realtime.
 *
 * ===========================================================================
 * VÌ SAO SERVICE KHÔNG IMPORT SOCKET.IO
 * ===========================================================================
 * Ba lý do, và lý do thứ ba mới là lý do bắt buộc:
 *
 *   1. Import socket.io vào service là kéo cả một server vào mọi test đơn vị.
 *   2. `apps/worker` sẽ dùng lại `chat.service` nhưng không mở cổng nào.
 *   3. Nghiệp vụ KHÔNG ĐƯỢC hỏng vì realtime hỏng. Tin nhắn đã commit là tin
 *      nhắn đã tồn tại; một `emit` thất bại chỉ có nghĩa người kia phải tải bù —
 *      mà tải bù thì đã có cursor lo. Ném lỗi từ tầng phát ngược lên service là
 *      biến một sự cố vô hại thành 500.
 *
 * Nên service gọi `phatToiPhong()`, và hàm đó KHÔNG LÀM GÌ khi chưa ai đăng ký
 * bộ phát. Đó là trạng thái đúng trong test và trong `apps/worker`.
 *
 * Về sau nhiều instance thì bộ phát đăng ký ở đây đổi thành bản publish qua
 * RabbitMQ; `chat.service` không phải sửa dòng nào.
 */
export interface BoPhatSuKien {
  toiPhong(phong: string, ten: string, du: unknown): void
}

let bo: BoPhatSuKien | null = null

export function dangKyBoPhat(b: BoPhatSuKien | null): void {
  bo = b
}

export function phatToiPhong(phong: string, ten: string, du: unknown): void {
  if (bo === null) return
  try {
    bo.toiPhong(phong, ten, du)
  } catch (e) {
    // Nuốt có chủ đích — xem lý do 3 ở trên.
    console.error(`[realtime] không phát được ${ten} tới ${phong}`, e)
  }
}
