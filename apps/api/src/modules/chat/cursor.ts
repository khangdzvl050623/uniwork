/**
 * Mốc đồng bộ cho việc tải bù. ĐỤC — client chỉ cất đi rồi gửi lại.
 *
 * ===========================================================================
 * VÌ SAO KHÔNG DÙNG THẲNG `seq`
 * ===========================================================================
 * `seq` liên tục, không thủng. Nhưng NTD không đọc mọi tin: họ chỉ thấy từ
 * `employerVisibleFromSeq` trở đi, và trong đó chỉ những tin
 * `visibleToEmployer = true`.
 *
 *   seq thật   11  12  13  14  15  16
 *   NTD thấy    ●   ●   ·   ·   ●   ·
 *
 * Client NTD nhận tin 12 rồi tin 15. Hai khả năng:
 *
 *   13, 14 là tin riêng tư  → không thiếu gì
 *   13, 14 rớt mạng         → thiếu thật, phải tải lại
 *
 * Từ con số `seq`, client KHÔNG phân biệt được. Đoán sai kiểu một thì nó tải
 * bù mãi những seq nó vĩnh viễn không được phép thấy; đoán sai kiểu hai thì
 * mất tin thật mà không ai biết.
 *
 * Gốc vấn đề: `seq` đang gánh hai việc — thứ tự VÀ bằng chứng đầy đủ. Với chủ
 * phiên hai việc trùng nhau; với NTD thì không.
 *
 * ===========================================================================
 * CURSOR MÃ HOÁ SEQ LỚN NHẤT SERVER **ĐÃ XÉT**, KHÔNG PHẢI SEQ CLIENT NHẬN
 * ===========================================================================
 * Sinh viên nói riêng 5 câu thì cursor của NTD vẫn tiến từ 10 lên 15, dù họ
 * nhận về MẢNG RỖNG. Rỗng + cursor tiến là kết quả ĐÚNG, không phải lỗi —
 * client cập nhật cursor rồi dừng, không thử lại.
 *
 * ===========================================================================
 * VÌ SAO BASE64 CHỨ KHÔNG PHẢI SỐ TRẦN
 * ===========================================================================
 * Hai lý do, và lý do thứ hai mới là lý do thật:
 *
 *   1. Một con số tăng đều là kênh rò rỉ — NTD đếm được sinh viên đã trao đổi
 *      riêng bao nhiêu câu với trợ lý.
 *   2. Đục thì client KHÔNG VIẾT NỔI logic dò lỗ hổng trên nó. Mà dò lỗ hổng
 *      chính là thứ sai với NTD. Hợp đồng ở đây quan trọng hơn giá trị bên
 *      trong — hôm nay bên trong đúng là `seq`.
 *
 * `v` để đổi cách mã hoá sau này (thêm messageId cho ổn định, đổi luật lọc) mà
 * không phải phát hành lại client: cursor đời cũ nhận ra được và xử lý riêng.
 */

const DOI = 1

interface Loi {
  seq: number
  v: number
}

export function dongCursor(seqDaXet: number): string {
  const loi: Loi = { seq: seqDaXet, v: DOI }
  return Buffer.from(JSON.stringify(loi), 'utf8').toString('base64url')
}

/**
 * Trả `0` cho cursor thiếu, hỏng, hoặc đời không nhận ra — nghĩa là "tải từ
 * đầu". KHÔNG ném.
 *
 * Ném ở đây là biến một client có cursor cũ trong localStorage thành một màn
 * hình lỗi mà người dùng không tự thoát được. Tải lại từ đầu thì tốn thêm một
 * truy vấn và mọi thứ chạy tiếp; quyền đọc vẫn do `quyenTruyCapPhien` chặn, nên
 * cursor bịa cũng không xem thêm được gì.
 */
export function moCursor(cursor: string | undefined | null): number {
  if (cursor === undefined || cursor === null || cursor === '') return 0
  try {
    const loi = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (typeof loi !== 'object' || loi === null) return 0
    const { seq, v } = loi as Partial<Loi>
    if (v !== DOI) return 0
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return 0
    return seq
  } catch {
    return 0
  }
}
