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
export type VaiTrongPhien = 'CHU' | 'NTD_NHAN_HANDOFF'

export interface QuyenTruyCap {
  sessionId: string
  vai: VaiTrongPhien
  /**
   * Phòng socket được vào. SUY TỪ `vai`, không cho nơi gọi tự ghép chuỗi.
   *
   * Bản trước để handler tự ghép `hoi-thoai:<id>` trong khi chỗ phát lại bắn
   * vào `:chu` / `:ntd`. `join` báo thành công, client không bao giờ nhận được
   * gì, và triệu chứng duy nhất là "realtime không chạy" — không log, không lỗi.
   */
  phong: string
  seqHienTai: number
  /** Chỉ đọc tin có `seq >= ` mốc này. */
  docTuSeq: number
  /** Có thêm điều kiện `visibleToEmployer = true` không. */
  chiTinChiaSe: boolean
  /**
   * Được GỬI tin ngay bây giờ không.
   *
   * Trường RIÊNG, không gộp vào quyền đọc. Đọc và gửi là hai câu hỏi khác nhau:
   * NTD đọc được lịch sử kể cả khi phiên đã quay về AI_ACTIVE, nhưng không gửi
   * được lúc đó. Gộp hai câu hỏi chính là nguồn của mâu thuẫn nói ở trên.
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
      ownerUserId: true,
      state: true,
      messageSeq: true,
      employerVisibleFromSeq: true,
      handoffEmployerProfileId: true,
    },
  })
  if (!p) return null

  const chung = { sessionId: p.id, seqHienTai: p.messageSeq }

  if (p.ownerUserId === user.id) {
    return {
      ...chung,
      vai: 'CHU',
      phong: phongChu(p.id),
      docTuSeq: 1,
      chiTinChiaSe: false,
      duocGui: p.state === 'HUMAN_ACTIVE',
    }
  }

  if (p.handoffEmployerProfileId !== null && user.role === 'EMPLOYER') {
    const laCuaHo = await prisma.employerProfile.findFirst({
      where: { id: p.handoffEmployerProfileId, userId: user.id },
      select: { id: true },
    })
    if (laCuaHo) {
      return {
        ...chung,
        vai: 'NTD_NHAN_HANDOFF',
        phong: phongNTD(p.id),
        /*
         * Neo vào `employerVisibleFromSeq`, KHÔNG vào `state`.
         *
         * Sinh viên chuyển cho NTD ở seq 10, rồi bấm "quay lại AI" và hỏi riêng
         * 5 câu. Lúc đó `state` về AI_ACTIVE — nhưng lịch sử NTD đã đọc không
         * biến mất, và họ vẫn phải mở lại xem được. Cột mốc đã đóng băng từ lần
         * chuyển đầu, nên nó là thứ đáng neo vào.
         */
        docTuSeq: p.employerVisibleFromSeq ?? Number.MAX_SAFE_INTEGER,
        chiTinChiaSe: true,
        duocGui: p.state === 'HUMAN_ACTIVE',
      }
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
export const phongNguoiDung = (userId: string) => `user:${userId}`
export const phongHopThuNTD = (employerProfileId: string) => `ntd:${employerProfileId}`
