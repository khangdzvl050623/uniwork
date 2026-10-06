/**
 * Hạn nộp hồ sơ — MỘT định nghĩa cho cả danh sách việc lẫn lúc ứng tuyển.
 *
 * ===========================================================================
 * `deadline` LÀ NGÀY LỊCH, KHÔNG PHẢI MỐC GIỜ
 * ===========================================================================
 * Form gửi `<input type="date">` → `'2026-09-20'` → `z.coerce.date()` ra
 * `2026-09-20T00:00:00Z`. Thứ được lưu là "ngày 20/09", mã hoá thành nửa đêm
 * UTC. Và người dùng hiểu "hạn 20/09" là HẾT ngày 20/09 — theo giờ Việt Nam.
 *
 * Nên phép so đúng là so NGÀY: hôm nay ở Việt Nam ≤ ngày hạn. Đổi về mốc giờ
 * thì đó là `deadline ≥ 00:00 UTC của ngày hôm nay theo giờ Việt Nam`, một điều
 * kiện mà Postgres lọc thẳng được.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TÁCH RA FILE RIÊNG
 * ---------------------------------------------------------------------------
 * Trước đây chỉ lúc ỨNG TUYỂN mới kiểm hạn, còn danh sách việc — và trợ lý AI
 * đọc chính danh sách đó — thì không: tin quá hạn vẫn hiện, trợ lý vẫn gợi ý,
 * sinh viên bấm nộp mới nhận 409. Hai nơi phải dùng cùng một mốc, nếu không
 * sẽ có lúc một tin hiện trong danh sách mà không nộp được, hoặc ngược lại.
 *
 * Bản cũ ở `applications.service` còn tính "đầu ngày hôm sau" bằng `setHours`,
 * tức theo múi giờ của MÁY CHỦ. Render chạy UTC, nên tin "hạn 20/09" nộp được
 * tới 7 giờ sáng 21/09 giờ Việt Nam; trên máy dev đặt giờ Việt Nam thì không.
 */

/** Ngày theo giờ Việt Nam, dạng `YYYY-MM-DD` (`sv-SE` cho đúng dạng đó). */
export function ngayVN(t: Date = new Date()): string {
  return t.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
}

/**
 * Mốc `deadline` SỚM NHẤT còn nhận hồ sơ: 00:00 UTC của ngày hôm nay ở Việt
 * Nam. Tin có `deadline` từ mốc này trở đi là còn hạn.
 */
export function hanSomNhatConNhan(t: Date = new Date()): Date {
  return new Date(`${ngayVN(t)}T00:00:00.000Z`)
}

/** Tin còn nhận hồ sơ không, xét riêng hạn nộp. */
export function conHanNop(deadline: Date, t: Date = new Date()): boolean {
  return deadline.getTime() >= hanSomNhatConNhan(t).getTime()
}
