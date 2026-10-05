import { describe, expect, it } from 'vitest'
import {
  danhDauThoiGian,
  danhDauXong,
  danhSoTin,
  gopChu,
  gopLichSu,
  type TinNhanUI,
} from './gop-tin'

const HOI: TinNhanUI = { id: 'tam-1', vai: 'toi', noiDung: 'có việc gì không?' }
const ID = 'ai-1'

describe('gopChu', () => {
  it('mẩu chữ đầu tiên tạo tin AI mới', () => {
    const ds = gopChu([HOI], ID, 'Có ')
    expect(ds).toHaveLength(2)
    expect(ds[1]).toMatchObject({ id: ID, vai: 'ai', noiDung: 'Có ', dangViet: true })
  })

  it('mẩu sau cộng dồn vào đúng tin đó', () => {
    let ds = gopChu([HOI], ID, 'Có ')
    ds = gopChu(ds, ID, '3 tin.')
    expect(ds).toHaveLength(2)
    expect(ds[1]!.noiDung).toBe('Có 3 tin.')
  })

  it('không đụng tới tin của người dùng', () => {
    const ds = gopChu([HOI], ID, 'x')
    expect(ds[0]).toBe(HOI)
  })

  /*
   * =====================================================================
   * CA NÀY LÀ LÝ DO FILE NÀY TỒN TẠI
   * =====================================================================
   * React gọi hàm cập nhật HAI LẦN ở StrictMode, trên cùng một `ds`. Bản đầu
   * giữ cờ `daCoChu` bên ngoài và sửa nó bên trong hàm cập nhật, nên lần gọi
   * thứ hai đi nhầm nhánh và trả về `ds` y nguyên — cả câu trả lời biến mất
   * khỏi màn hình, trong khi server đã lưu đầy đủ và quota đã trừ.
   *
   * Triệu chứng chỉ xuất hiện ở chế độ phát triển, và trông hệt như lỗi
   * backend. Nên phải có ca canh, không thể dựa vào việc nhớ.
   */
  it('gọi HAI LẦN trên cùng đầu vào ra cùng kết quả — mẩu đầu', () => {
    const truoc = [HOI]
    expect(gopChu(truoc, ID, 'Có ')).toEqual(gopChu(truoc, ID, 'Có '))
  })

  it('gọi HAI LẦN trên cùng đầu vào ra cùng kết quả — mẩu sau', () => {
    const truoc = gopChu([HOI], ID, 'Có ')
    expect(gopChu(truoc, ID, '3 tin.')).toEqual(gopChu(truoc, ID, '3 tin.'))
  })

  it('không sửa mảng gốc', () => {
    const truoc = [HOI]
    gopChu(truoc, ID, 'x')
    expect(truoc).toHaveLength(1)
  })

  it('hai lượt khác nhau thì hai tin AI khác nhau', () => {
    let ds = gopChu([HOI], 'ai-1', 'câu một')
    ds = gopChu(ds, 'ai-2', 'câu hai')
    expect(ds.filter((t) => t.vai === 'ai')).toHaveLength(2)
  })
})

describe('danhDauXong', () => {
  it('tắt cờ đang viết', () => {
    const ds = danhDauXong(gopChu([HOI], ID, 'xong'), ID)
    expect(ds[1]!.dangViet).toBe(false)
  })

  it('gọi hai lần vẫn ra cùng kết quả', () => {
    const truoc = gopChu([HOI], ID, 'xong')
    expect(danhDauXong(truoc, ID)).toEqual(danhDauXong(truoc, ID))
  })

  it('id không có trong danh sách thì không đổi gì', () => {
    const truoc = [HOI]
    expect(danhDauXong(truoc, 'khong-co')).toEqual(truoc)
  })
})

describe('gopLichSu — khử trùng theo seq', () => {
  const tuServer = (seq: number, body: string, senderType = 'AI') => ({
    id: `db-${seq}`,
    seq,
    senderType,
    body,
  })

  it('thêm tin chưa có', () => {
    const ds = gopLichSu([], [tuServer(1, 'chào', 'STUDENT'), tuServer(2, 'chào bạn')], 'STUDENT')
    expect(ds.map((t) => t.vai)).toEqual(['toi', 'ai'])
  })

  it('SYSTEM thành vai he-thong', () => {
    expect(gopLichSu([], [tuServer(1, 'Đã tiếp nhận', 'SYSTEM')], 'STUDENT')[0]!.vai).toBe('he-thong')
  })

  /*
   * =====================================================================
   * CA NÀY CHẶN TIN HIỆN HAI LẦN
   * =====================================================================
   * Câu trả lời của AI tới màn hình bằng CẢ HAI đường: SSE gom từng mẩu chữ
   * dưới id tạm, rồi socket phát lại nguyên tin với id thật. Khử trùng theo
   * `id` thì hai id khác nhau và người dùng thấy câu trả lời hai lần.
   */
  it('tin đã có seq thì THAY, không thêm bản sao', () => {
    const dangChay: TinNhanUI[] = [
      { id: 'ai-tam', seq: 7, vai: 'ai', noiDung: 'Có 3 tin.', dangViet: false },
    ]
    const ds = gopLichSu(dangChay, [tuServer(7, 'Có 3 tin.')], 'STUDENT')

    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ id: 'db-7', seq: 7 })
  })

  /*
   * Tin đang chảy dở chưa có `seq`: không bị đụng tới, VÀ đứng CUỐI.
   *
   * Bản trước khẳng định nó ở vị trí 0 — nhưng đó chỉ là hệ quả của việc nối
   * tin mới vào cuối, không phải điều đúng. Tin đang chảy dở là tin MỚI NHẤT;
   * từ khi `gopLichSu` sắp theo `seq`, nó đứng đúng chỗ của nó: dưới cùng.
   */
  it('tin đang chảy dở CHƯA có seq thì không bị đụng tới, và đứng cuối', () => {
    const dangChay: TinNhanUI[] = [{ id: 'ai-tam', vai: 'ai', noiDung: 'Có…', dangViet: true }]
    const ds = gopLichSu(dangChay, [tuServer(3, 'câu khác')], 'STUDENT')
    expect(ds.map((t) => t.id)).toEqual(['db-3', 'ai-tam'])
    expect(ds[1]).toMatchObject({ noiDung: 'Có…', dangViet: true })
  })

  /*
   * =======================================================================
   * CHÈN TRANG CŨ HƠN — LÝ DO `gopLichSu` PHẢI SẮP
   * =======================================================================
   * Trước phân trang, tin chỉ tới theo một chiều nên nối vào cuối là đủ. Giờ
   * cuộn lên tải được trang cũ hơn, và nối vào cuối là đặt tin từ tuần trước
   * nằm DƯỚI câu vừa nói.
   */
  it('chèn trang cũ hơn vẫn đúng thứ tự seq', () => {
    const dangCo = gopLichSu([], [tuServer(51, 'mới 1'), tuServer(52, 'mới 2')], 'STUDENT')
    const sau = gopLichSu(dangCo, [tuServer(49, 'cũ 1'), tuServer(50, 'cũ 2')], 'STUDENT')
    expect(sau.map((t) => t.seq)).toEqual([49, 50, 51, 52])
  })

  /* Tải bù sau khi mất mạng có thể CHEN GIỮA hai tin đã có. */
  it('tin tới chen giữa cũng vào đúng chỗ', () => {
    const dangCo = gopLichSu([], [tuServer(10, 'a'), tuServer(13, 'd')], 'STUDENT')
    const sau = gopLichSu(dangCo, [tuServer(12, 'c'), tuServer(11, 'b')], 'STUDENT')
    expect(sau.map((t) => t.noiDung)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('gọi HAI LẦN trên cùng đầu vào ra cùng kết quả', () => {
    const truoc: TinNhanUI[] = [{ id: 'a', seq: 1, vai: 'toi', noiDung: 'hỏi' }]
    const moi = [tuServer(2, 'đáp')]
    expect(gopLichSu(truoc, moi, 'STUDENT')).toEqual(gopLichSu(truoc, moi, 'STUDENT'))
  })

  it('ghép cùng một lô hai lần không sinh bản sao', () => {
    const moi = [tuServer(1, 'a', 'STUDENT'), tuServer(2, 'b')]
    expect(gopLichSu(gopLichSu([], moi, 'STUDENT'), moi, 'STUDENT')).toHaveLength(2)
  })

  /*
   * =====================================================================
   * CA NÀY CHẶN "SINH VIÊN THẤY CÂU CỦA NHÀ TUYỂN DỤNG LÀ CỦA MÌNH"
   * =====================================================================
   * Bản trước suy vai bằng "không phải AI, không phải SYSTEM → của tôi". Đúng
   * đúng một trường hợp: lúc người thật duy nhất trong phiên là chính mình.
   *
   * Từ khi có handoff thì có hai người gửi, và cùng một lô tin phải ra HAI kết
   * quả khác nhau tuỳ ai đang xem. Bốn khẳng định dưới đây chỉ cùng xanh khi
   * `toiLa` thật sự được dùng.
   */
  it('cùng một lô tin, mỗi bên thấy bên kia là “họ”', () => {
    const lo = [tuServer(1, 'em hỏi', 'STUDENT'), tuServer(2, 'chào em', 'EMPLOYER')]

    expect(gopLichSu([], lo, 'STUDENT').map((t) => t.vai)).toEqual(['toi', 'ho'])
    expect(gopLichSu([], lo, 'EMPLOYER').map((t) => t.vai)).toEqual(['ho', 'toi'])
  })

  it('admin trả lời trong phiên hỗ trợ là “họ” với người xin hỗ trợ', () => {
    const lo = [tuServer(1, 'cứu em', 'STUDENT'), tuServer(2, 'chào bạn', 'ADMIN')]

    expect(gopLichSu([], lo, 'STUDENT').map((t) => t.vai)).toEqual(['toi', 'ho'])
    expect(gopLichSu([], lo, 'ADMIN').map((t) => t.vai)).toEqual(['ho', 'toi'])
  })

  it('không sửa mảng gốc', () => {
    const truoc: TinNhanUI[] = []
    gopLichSu(truoc, [tuServer(1, 'x')], 'STUDENT')
    expect(truoc).toHaveLength(0)
  })
})

describe('danhSoTin', () => {
  it('gán seq cho tin tạm', () => {
    const ds = danhSoTin([{ id: 'tam', vai: 'toi', noiDung: 'hỏi' }], 'tam', 5)
    expect(ds[0]!.seq).toBe(5)
  })

  /* Đánh số xong thì lần phát qua socket phải THAY chứ không thêm. */
  it('sau khi đánh số thì gopLichSu thay tại chỗ', () => {
    const ds = danhSoTin([{ id: 'tam', vai: 'toi', noiDung: 'hỏi' }], 'tam', 5)
    const sau = gopLichSu(ds, [{ id: 'db-5', seq: 5, senderType: 'STUDENT', body: 'hỏi' }], 'STUDENT')
    expect(sau).toHaveLength(1)
  })
})

/*
 * ===========================================================================
 * MỐC THỜI GIAN — ĐÚNG CHỖ, KHÔNG PHẢI MỌI CHỖ
 * ===========================================================================
 * Mười tin liên tiếp trong một phút, mỗi cái một dòng giờ phía dưới, là mười
 * dòng nhiễu nói cùng một điều. Luật ở đây quyết chỗ nào đáng hiện.
 *
 * Dùng giờ CỐ ĐỊNH, không `Date.now()`: hàm phải thuần, và một ca kiểm phụ
 * thuộc lúc chạy sẽ đỏ vào đúng nửa đêm.
 */
describe('danhDauThoiGian', () => {
  const luc = (h: number, m: number, ngay = 15) =>
    new Date(2026, 9, ngay, h, m).toISOString()

  const tin = (id: string, vai: TinNhanUI['vai'], gio: string): TinNhanUI => ({
    id,
    seq: Number(id),
    vai,
    noiDung: id,
    luc: gio,
  })

  it('tin đầu tiên luôn mở đầu bằng một mốc', () => {
    const kq = danhDauThoiGian([tin('1', 'toi', luc(14, 30))])
    expect(kq[0]!.moc).not.toBeNull()
  })

  it('hai tin sát nhau KHÔNG chèn mốc ở giữa', () => {
    const kq = danhDauThoiGian([
      tin('1', 'toi', luc(14, 30)),
      tin('2', 'ho', luc(14, 31)),
    ])
    expect(kq[1]!.moc).toBeNull()
  })

  it('cách nhau hơn 20 phút thì chèn mốc', () => {
    const kq = danhDauThoiGian([
      tin('1', 'toi', luc(14, 30)),
      tin('2', 'toi', luc(15, 0)),
    ])
    expect(kq[1]!.moc).not.toBeNull()
  })

  /*
   * Sang ngày khác thì chèn mốc DÙ chỉ cách vài phút. 23:58 hôm qua và 00:01
   * hôm nay cách nhau ba phút, nhưng đọc lại thì đó là hai buổi khác nhau —
   * và nếu chỉ so khoảng cách thì chúng dính liền thành một.
   */
  it('sang ngày khác thì chèn mốc dù chỉ cách vài phút', () => {
    const kq = danhDauThoiGian([
      tin('1', 'toi', new Date(2026, 9, 15, 23, 58).toISOString()),
      tin('2', 'toi', new Date(2026, 9, 16, 0, 1).toISOString()),
    ])
    expect(kq[1]!.moc).not.toBeNull()
  })

  /*
   * =======================================================================
   * GIỜ CHỈ Ở CUỐI MỖI CHUỖI CÙNG NGƯỜI NÓI
   * =======================================================================
   * Đây là phần dễ viết thành "luôn đúng" nhất: khẳng định trên CẢ chuỗi chứ
   * không trên một phần tử, để đổi luật thành "hiện hết" hay "không hiện gì"
   * đều đỏ.
   */
  it('chuỗi ba tin cùng người: chỉ tin CUỐI hiện giờ', () => {
    const kq = danhDauThoiGian([
      tin('1', 'toi', luc(14, 30)),
      tin('2', 'toi', luc(14, 31)),
      tin('3', 'toi', luc(14, 32)),
    ])
    expect(kq.map((k) => k.hienGio)).toEqual([false, false, true])
  })

  it('đổi người nói thì tin trước đó hiện giờ', () => {
    const kq = danhDauThoiGian([
      tin('1', 'toi', luc(14, 30)),
      tin('2', 'ho', luc(14, 31)),
    ])
    expect(kq.map((k) => k.hienGio)).toEqual([true, true])
  })

  /* Tin hệ thống là dòng chữ giữa màn hình, không phải bong bóng — không gắn giờ. */
  it('tin hệ thống không hiện giờ', () => {
    const kq = danhDauThoiGian([tin('1', 'he-thong', luc(14, 30))])
    expect(kq[0]!.hienGio).toBe(false)
  })

  /*
   * Tin đang chảy dở chưa có `luc` — server chưa ghi nó. KHÔNG được bịa giờ
   * bằng `new Date()`: đồng hồ máy người dùng lệch được hàng phút, và một giờ
   * sai trông y hệt một giờ đúng.
   */
  it('tin chưa có giờ thì không mốc, không hiện giờ', () => {
    const kq = danhDauThoiGian([{ id: 'tam', vai: 'ai', noiDung: 'đang…', dangViet: true }])
    expect(kq[0]).toMatchObject({ moc: null, hienGio: false })
  })

  it('không sửa mảng gốc, và gọi hai lần ra cùng kết quả', () => {
    const ds = [tin('1', 'toi', luc(14, 30)), tin('2', 'ho', luc(14, 31))]
    const truoc = JSON.stringify(ds)
    expect(danhDauThoiGian(ds)).toEqual(danhDauThoiGian(ds))
    expect(JSON.stringify(ds)).toBe(truoc)
  })
})
