export type VaiNguoiNoi = 'toi' | 'ho' | 'ai' | 'he-thong'

/**
 * Nhãn người gửi mà server ghi vào tin nhắn — bản sao của `ChatSenderType`.
 *
 * Chép tay chứ không import từ `@prisma/client`: web không phụ thuộc Prisma,
 * và đây là hợp đồng JSON chứ không phải kiểu database.
 */
export type NguoiGui = 'STUDENT' | 'EMPLOYER' | 'ADMIN' | 'AI' | 'SYSTEM'

export interface TinNhanUI {
  id: string
  vai: VaiNguoiNoi
  noiDung: string
  /**
   * Số thứ tự do server cấp. `undefined` khi tin còn đang chảy dở.
   *
   * Đây là KHOÁ KHỬ TRÙNG — xem `gopLichSu`.
   */
  seq?: number
  /** AI đang viết dở tin này. */
  dangViet?: boolean
}

/**
 * Ghép một mẩu chữ vừa nhận vào danh sách tin nhắn.
 *
 * ===========================================================================
 * HÀM NÀY PHẢI THUẦN KHIẾT VÀ PHẢI LẶP LẠI ĐƯỢC
 * ===========================================================================
 * Nó chạy bên trong `setTinNhan(ds => …)`. React gọi hàm cập nhật **hai lần**
 * ở chế độ StrictMode (đang bật ở `main.tsx`) để lộ ra những hàm cập nhật
 * không thuần khiết. Gọi hai lần trên cùng đầu vào PHẢI ra cùng kết quả.
 *
 * ---------------------------------------------------------------------------
 * LỖI THẬT ĐÃ GẶP 2026-09-28 — CÂU TRẢ LỜI BIẾN MẤT KHỎI MÀN HÌNH
 * ---------------------------------------------------------------------------
 * Bản đầu giữ một biến `let daCoChu` bên ngoài rồi sửa nó BÊN TRONG hàm cập
 * nhật:
 *
 *   setTinNhan((ds) => {
 *     if (!daCoChu) { daCoChu = true; return [...ds, tinMoi] }
 *     return ds.map(...)            // ← nhánh cộng dồn
 *   })
 *
 * StrictMode gọi hai lần trên CÙNG một `ds`:
 *   lần 1 — `daCoChu` false → đặt thành true → trả về `[...ds, tinMoi]`
 *   lần 2 — `daCoChu` đã true → đi nhánh `map` trên `ds` GỐC, vốn chưa có tin
 *           đó → trả về `ds` y nguyên
 *
 * React giữ kết quả lần hai. Tin nhắn không bao giờ được thêm, và mọi mẩu chữ
 * sau đó cũng rơi vào nhánh `map` trên một danh sách không có nó — nên cả câu
 * trả lời biến mất.
 *
 * Triệu chứng đánh lừa: server hoàn toàn đúng — lượt `SUCCEEDED`, câu trả lời
 * nằm trong database, quota đã trừ. Chỉ màn hình là trống.
 *
 * Cách sửa không phải tắt StrictMode, mà là **suy trạng thái từ chính `ds`**.
 */
export function gopChu(ds: TinNhanUI[], idAi: string, chu: string): TinNhanUI[] {
  const viTri = ds.findIndex((t) => t.id === idAi)
  if (viTri === -1) {
    return [...ds, { id: idAi, vai: 'ai', noiDung: chu, dangViet: true }]
  }

  /*
   * Gọi lại với CÙNG `ds` phải ra CÙNG kết quả, nên phép cộng dồn tính từ
   * `ds[viTri].noiDung` chứ không từ giá trị mới nhất ở đâu khác.
   */
  return ds.map((t, i) => (i === viTri ? { ...t, noiDung: t.noiDung + chu } : t))
}

/** Đánh dấu tin AI đã viết xong. Thuần khiết, lặp lại được. */
export function danhDauXong(ds: TinNhanUI[], idAi: string): TinNhanUI[] {
  return ds.map((t) => (t.id === idAi ? { ...t, dangViet: false } : t))
}

export interface TinTuServer {
  id: string
  seq: number
  senderType: string
  body: string
}

/**
 * Tin này của TÔI hay của người kia.
 *
 * ===========================================================================
 * PHẢI BIẾT "TÔI LÀ AI", KHÔNG SUY ĐƯỢC TỪ MỖI `senderType`
 * ===========================================================================
 * Bản trước viết: không phải AI, không phải SYSTEM → 'toi'. Đúng đúng một
 * trường hợp — sinh viên ngồi hỏi trợ lý, khi đó người thật duy nhất trong
 * phiên là chính họ.
 *
 * Từ lúc phiên chuyển sang nói với người thật thì có HAI người gửi. Sinh viên
 * mở màn hình lên thấy câu của nhà tuyển dụng nằm bên phải, nền xanh, y như
 * câu mình vừa gõ. Không có lỗi nào bắn ra; chỉ là cuộc trò chuyện đọc thành
 * một người tự nói với mình.
 *
 * Nên `toiLa` là THAM SỐ BẮT BUỘC. Quên truyền là lỗi biên dịch, không phải
 * một màn hình trông hơi lạ.
 */
const vaiTheoNguoiGui = (senderType: string, toiLa: NguoiGui): VaiNguoiNoi => {
  if (senderType === 'AI') return 'ai'
  if (senderType === 'SYSTEM') return 'he-thong'
  return senderType === toiLa ? 'toi' : 'ho'
}

/**
 * Ghép tin từ server (lịch sử, tải bù, hoặc `hoi-thoai:tin-moi`) vào danh sách.
 *
 * ===========================================================================
 * KHỬ TRÙNG THEO `seq`, KHÔNG THEO `id`
 * ===========================================================================
 * Một câu trả lời của AI đi tới màn hình bằng HAI đường:
 *
 *   SSE  — từng mẩu chữ, gom lại dưới một id tạm `ai-<clientMessageId>`
 *   Socket — `hoi-thoai:tin-moi` phát vào phòng của chủ phiên, mang id thật
 *
 * Cả hai đều cần: SSE cho tab đang hỏi, socket cho tab thứ hai của cùng người
 * dùng. Khử trùng theo `id` thì hai đường mang hai id khác nhau và tin hiện
 * hai lần.
 *
 * `seq` thì cả hai đường đều biết — SSE báo qua sự kiện `xong`, socket mang
 * sẵn trong tin. Nên nó là khoá đúng.
 *
 * Tin đang chảy dở chưa có `seq`; chúng giữ id tạm cho tới khi `xong` gán số.
 *
 * Thuần khiết và lặp lại được, cùng lý do với `gopChu`.
 */
export function gopLichSu(
  ds: TinNhanUI[],
  moi: TinTuServer[],
  toiLa: NguoiGui,
): TinNhanUI[] {
  let kq = ds

  for (const t of moi) {
    const viTri = kq.findIndex((c) => c.seq === t.seq)
    const thanh: TinNhanUI = {
      id: t.id,
      seq: t.seq,
      vai: vaiTheoNguoiGui(t.senderType, toiLa),
      noiDung: t.body,
    }
    kq = viTri === -1 ? [...kq, thanh] : kq.map((c, i) => (i === viTri ? thanh : c))
  }

  return kq
}

/** Gán `seq` cho một tin tạm, để lần phát qua socket sau đó không tạo bản sao. */
export function danhSoTin(ds: TinNhanUI[], id: string, seq: number): TinNhanUI[] {
  return ds.map((t) => (t.id === id ? { ...t, seq } : t))
}
