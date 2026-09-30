import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

/**
 * MỘT hàm phân quyền hội thoại, dùng chung cho REST và Socket.IO.
 *
 * ===========================================================================
 * VÌ SAO PHẢI LÀ MỘT HÀM, KHÔNG PHẢI HAI CHỖ KIỂM GIỐNG NHAU
 * ===========================================================================
 * Hai bản sao của luật phân quyền là hai bản sao sẽ lệch nhau — không phải nếu,
 * mà là khi. Và chúng lệch theo hướng tệ: ai đó sửa luật ở REST vì một bug báo
 * qua REST, rồi Socket.IO giữ nguyên luật cũ. Không test nào bắt được, vì mỗi
 * bên vẫn đúng với chính nó.
 *
 * Bản thiết kế đã dính đúng lỗi đó một lần: quyền đọc của NTD từng có thêm điều
 * kiện `state != 'AI_ACTIVE'`, tự mâu thuẫn với việc sinh viên quay lại hỏi AI
 * rồi chuyển lại cho NTD.
 */

/** Vai của người xem TRONG phiên này — không phải `Role` của tài khoản. */
export type VaiTrongPhien = 'CHU' | 'NTD_NHAN_HANDOFF' | 'ADMIN_HO_TRO'

export interface QuyenTruyCap {
  sessionId: string
  /**
   * Chủ phiên. Cần cho việc PHÁT, không cho việc phân quyền.
   *
   * `phatTrangThai` bắn cả vào phòng riêng của chủ phiên để họ nhận được kể
   * cả khi đang ở trang khác. Hàm này đã đọc sẵn giá trị đó; bắt nơi gọi truy
   * vấn lại là một lần chạm database thừa cho mỗi chuyển đổi.
   */
  ownerUserId: string
  vai: VaiTrongPhien
  /**
   * Phòng socket được vào. SUY TỪ `vai`, không cho nơi gọi tự ghép chuỗi.
   *
   * Bản trước để handler tự ghép `hoi-thoai:<id>` trong khi chỗ phát lại bắn
   * vào `:chu` / `:ntd`. `join` báo thành công, client không bao giờ nhận được
   * gì, và triệu chứng duy nhất là "realtime không chạy" — không log, không lỗi.
   */
  phong: string
  /**
   * Trạng thái phiên, để nơi gọi khỏi truy vấn lại.
   *
   * Hàm này đã đọc `state` để quyết `duocGui`; giấu nó đi thì mọi màn hình
   * muốn hiện "đang chờ tiếp nhận" lại phải tự gọi thêm một lần nữa — và
   * chúng sẽ đọc được một giá trị khác với giá trị vừa dùng để phân quyền.
   */
  trangThai: string
  seqHienTai: number
  /*
   * =========================================================================
   * KHÔNG CÒN `docTuSeq` VÀ `chiTinChiaSe` — VÀ ĐÓ LÀ CẢ MỤC ĐÍCH CỦA LUỒNG
   * =========================================================================
   * Hai trường đó từng cắt một hàng chứa HAI cuộc trò chuyện: phần sinh viên
   * hỏi riêng trợ lý, và phần trao đổi với nhà tuyển dụng. Cắt thì cắt đúng,
   * nhưng nó là một mốc phải nhớ kiểm ở mọi truy vấn và mọi lần phát socket.
   *
   * Từ khi mỗi đối tượng một luồng, ai vào được luồng nào thì đọc trọn luồng
   * ấy. Không còn mốc nào để quên.
   */
  /**
   * Được GỬI tin ngay bây giờ không.
   *
   * Trường RIÊNG, không gộp vào quyền đọc. Đọc và gửi là hai câu hỏi khác
   * nhau: nhà tuyển dụng vẫn đọc lại được luồng đã đóng, nhưng không gửi được
   * vào đó. Gộp hai câu hỏi là nguồn của mâu thuẫn nói ở đầu file.
   */
  duocGui: boolean
}

/**
 * `null` nghĩa là KHÔNG có quyền gì — nơi gọi dịch thành 404 (REST) hoặc
 * `{ ok: false, code: 'FORBIDDEN' }` (socket).
 *
 * ADMIN cũng nhận `null`. Hội thoại là trao đổi riêng giữa hai người; không có
 * nhu cầu nghiệp vụ nào bắt admin phải đọc được, và mở cửa đó là mở vĩnh viễn.
 */
export async function quyenTruyCapPhien(
  user: { id: string; role: Role },
  sessionId: string,
): Promise<QuyenTruyCap | null> {
  const p = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      kind: true,
      ownerUserId: true,
      state: true,
      messageSeq: true,
      handoffEmployerProfileId: true,
      handoffAdminUserId: true,
    },
  })
  if (!p) return null

  const chung = {
    sessionId: p.id,
    ownerUserId: p.ownerUserId,
    trangThai: p.state,
    seqHienTai: p.messageSeq,
  }

  if (p.ownerUserId === user.id) {
    return {
      ...chung,
      vai: 'CHU',
      phong: phongChu(p.id),
      duocGui: p.state === 'HUMAN_ACTIVE',
    }
  }

  /*
   * ===========================================================================
   * NHÀ TUYỂN DỤNG ĐỌC CẢ LUỒNG, TỪ SEQ 1 — VÀ ĐÓ LÀ THU HẸP, KHÔNG PHẢI NỚI
   * ===========================================================================
   * Nghe như mở rộng quyền, nhưng ngược lại. Luồng `NTD` CHỈ chứa trao đổi
   * giữa đúng hai người này: nó ra đời lúc sinh viên bấm hỏi nơi này, và đoạn
   * họ hỏi riêng trợ lý nằm ở một hàng khác hẳn.
   *
   * Bản trước nhồi cả hai cuộc trò chuyện vào MỘT hàng rồi cắt bằng
   * `employerVisibleFromSeq` cộng cờ `visibleToEmployer` trên từng tin. Cắt thì
   * cắt đúng, nhưng nó là một mốc phải nhớ kiểm ở mọi truy vấn và mọi lần phát
   * socket — quên một chỗ là rò, và không test nào ở chỗ còn lại bắt được.
   *
   * Hai hàng khác nhau thì không còn gì để quên.
   */
  if (p.kind === 'NTD' && p.handoffEmployerProfileId !== null && user.role === 'EMPLOYER') {
    const laCuaHo = await prisma.employerProfile.findFirst({
      where: { id: p.handoffEmployerProfileId, userId: user.id },
      select: { id: true },
    })
    if (laCuaHo) {
      return {
        ...chung,
        vai: 'NTD_NHAN_HANDOFF',
        phong: phongNTD(p.id),
        duocGui: p.state === 'HUMAN_ACTIVE',
      }
    }
  }

  /*
   * ADMIN đọc được hội thoại HỖ TRỢ — và CHỈ hội thoại hỗ trợ.
   *
   * Với hai kênh kia họ vẫn nhận `null`, có test canh. Ở đây thì khác: người
   * dùng CHỦ ĐỘNG mở một phiên hỗ trợ và bấm xin người thật, nên cả lịch sử
   * chính là nội dung cái ticket — đọc từ seq 1, không có mốc riêng tư.
   *
   * Quyền ĐỌC neo vào `kind`, KHÔNG vào `handoffAdminUserId`: admin thứ hai
   * phải xem được hàng đợi thì mới tiếp nhận được. Quyền GỬI mới đòi đúng
   * người đã nhận — hai admin cùng trả lời một ticket là hai giọng nói khác
   * nhau trong cùng một cuộc trò chuyện.
   */
  if (p.kind === 'AI_SUPPORT' && user.role === 'ADMIN') {
    return {
      ...chung,
      vai: 'ADMIN_HO_TRO',
      phong: phongAdmin(p.id),
      duocGui: p.state === 'HUMAN_ACTIVE' && p.handoffAdminUserId === user.id,
    }
  }

  return null
}

/*
 * HAI phòng cho một hội thoại, không phải một.
 *
 * Một phòng chung nghĩa là mọi `emit` tới cả hai bên. Khi phiên quay về
 * AI_ACTIVE, NTD đang ngồi trong phòng sẽ nhận realtime TỪNG CÂU sinh viên nói
 * với trợ lý — dù truy vấn REST đã chặn họ đọc đúng những tin đó.
 *
 * Lỗ đó không lộ ra ở bất kỳ test REST nào, vì REST hoàn toàn đúng.
 */
export const phongChu = (sessionId: string) => `hoi-thoai:${sessionId}:chu`
export const phongNTD = (sessionId: string) => `hoi-thoai:${sessionId}:ntd`
/** Phòng của admin đang xử một hội thoại hỗ trợ. Kênh thứ ba, tách hẳn hai kênh trên. */
export const phongAdmin = (sessionId: string) => `hoi-thoai:${sessionId}:admin`
export const phongNguoiDung = (userId: string) => `user:${userId}`
export const phongHopThuNTD = (employerProfileId: string) => `ntd:${employerProfileId}`
/**
 * Hàng đợi hỗ trợ — MỘT phòng cho TẤT CẢ admin, không phải một phòng mỗi người.
 *
 * Yêu cầu mới chưa có ai được chỉ định (admin là hàng đợi, người nhận chỉ đặt
 * lúc tiếp nhận). Phát riêng cho từng admin thì phải biết trước danh sách admin
 * đang online, mà đó chính là thứ Socket.IO giữ hộ bằng phòng.
 */
export const PHONG_ADMIN_HO_TRO = 'admin:ho-tro'
