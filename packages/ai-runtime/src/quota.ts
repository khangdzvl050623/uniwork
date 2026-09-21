import type { Prisma, PrismaClient } from '@prisma/client'
import { aiConfig, ngayVN } from './config.js'

/**
 * Giữ / chốt / hoàn lượt AI.
 *
 * Package này nhận `PrismaClient` tiêm vào chứ không tự tạo: `apps/api` và
 * `apps/worker` là hai process khác nhau, mỗi bên có client riêng.
 */

export type ClientPrisma = PrismaClient | Prisma.TransactionClient

export type KetQuaGiuLuot =
  | { ok: true; turnId: string; conLai: number }
  /** Hết lượt trong ngày → 429 AI_QUOTA_EXCEEDED. */
  | { ok: false; ly: 'HET_LUOT'; conLai: 0 }
  /** Đang có một lượt chạy dở → 409 AI_BUSY. Lượt KHÔNG bị trừ. */
  | { ok: false; ly: 'DANG_BAN' }

interface ThamSoGiuLuot {
  userId: string
  feature: 'CHAT' | 'CV_SCAN'
  /** Id của process đang chạy. Dùng lúc tắt server để chỉ huỷ lượt của mình. */
  runnerId: string
  modelId: string
  promptVersion: string
  sessionId?: string
  extractionId?: string
}

/**
 * Giữ một lượt.
 *
 * ---------------------------------------------------------------------------
 * PHẢI GỌI TRONG MỘT TRANSACTION, và truyền `tx` vào
 * ---------------------------------------------------------------------------
 * Hai việc bên trong — cộng bộ đếm ngày và tạo hàng AiTurn — phải cùng sống
 * cùng chết. Tách ra thì có khe hở: cộng xong, tạo AiTurn thất bại vì
 * DANG_BAN, và người dùng mất một lượt cho một lỗi hoàn toàn vô hại.
 *
 * Nơi gọi bọc tiếp bằng việc ghi câu hỏi vào chat_messages, vẫn trong cùng
 * transaction đó.
 */
export async function giuLuot(tx: ClientPrisma, ts: ThamSoGiuLuot): Promise<KetQuaGiuLuot> {
  const ngay = ngayVN()
  const tran =
    ts.feature === 'CHAT' ? aiConfig.chatTurnsPerDay : aiConfig.scanJobsPerDay

  /*
   * MỘT câu lệnh làm cả việc kiểm hạn mức lẫn việc cộng.
   *
   * Vì sao không SELECT rồi UPDATE: giữa hai bước đó có khe hở. Năm tab bấm
   * cùng lúc thì cả năm đọc thấy "đã dùng 4/5", cả năm ghi "5". Người dùng có
   * 9 lượt. Ở đây Postgres khoá hàng trong chính câu UPSERT, nên năm lời gọi
   * bị nối tiếp và chỉ cái đầu tiên qua được.
   *
   * Mệnh đề WHERE nằm TRONG `DO UPDATE`, không nằm ngoài — đây là cú pháp
   * Postgres cho phép ON CONFLICT từ chối cập nhật có điều kiện. Không khớp
   * điều kiện thì KHÔNG có hàng nào được trả về, và đó là tín hiệu "hết lượt".
   *
   * Trừ `turnsRefunded` trong điều kiện: không trừ thì một lượt bị hoàn vì lỗi
   * mạng vẫn chiếm chỗ vĩnh viễn.
   */
  const hang = await tx.$queryRaw<Array<{ turnsReserved: number; turnsRefunded: number }>>`
    INSERT INTO ai_usage_days (id, "userId", day, feature, "turnsReserved", "updatedAt")
    VALUES (gen_random_uuid()::text, ${ts.userId}, ${ngay}::date, ${ts.feature}::"AiFeature", 1, now())
    ON CONFLICT ("userId", day, feature) DO UPDATE
      SET "turnsReserved" = ai_usage_days."turnsReserved" + 1,
          "updatedAt"     = now()
      WHERE ai_usage_days."turnsReserved" - ai_usage_days."turnsRefunded" < ${tran}
    RETURNING "turnsReserved", "turnsRefunded"
  `

  if (hang.length === 0) return { ok: false, ly: 'HET_LUOT', conLai: 0 }

  const { turnsReserved, turnsRefunded } = hang[0]!
  const conLai = Math.max(0, tran - (turnsReserved - turnsRefunded))

  try {
    const turn = await tx.aiTurn.create({
      data: {
        userId: ts.userId,
        feature: ts.feature,
        runnerId: ts.runnerId,
        quotaDay: new Date(`${ngay}T00:00:00.000Z`),
        modelId: ts.modelId,
        promptVersion: ts.promptVersion,
        sessionId: ts.sessionId ?? null,
        extractionId: ts.extractionId ?? null,
      },
      select: { id: true },
    })
    return { ok: true, turnId: turn.id, conLai }
  } catch (e) {
    /*
     * P2002 ở đây CHỈ có thể đến từ chỉ mục một phần `ai_turns_mot_luot_dang_chay`
     * — bảng không có unique nào khác. Nghĩa là tài khoản đang có một lượt chạy dở.
     *
     * Ném ra để transaction rollback: bộ đếm vừa cộng ở trên được trả lại, và
     * người dùng KHÔNG mất lượt vì một lỗi vô hại.
     */
    if (laLoiTrungKhoa(e)) throw new DangBanError()
    throw e
  }
}

/** Lượt thứ hai khi lượt thứ nhất chưa xong. Nơi gọi dịch thành 409 AI_BUSY. */
export class DangBanError extends Error {
  constructor() {
    super('Tài khoản đang có một yêu cầu AI đang xử lý')
    this.name = 'DangBanError'
  }
}

function laLoiTrungKhoa(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
}

/** Còn bao nhiêu lượt hôm nay. Chỉ đọc, dùng cho `GET /luot-con-lai`. */
export async function demLuotConLai(
  prisma: ClientPrisma,
  userId: string,
  feature: 'CHAT' | 'CV_SCAN',
): Promise<{ conLai: number; tong: number }> {
  const tong = feature === 'CHAT' ? aiConfig.chatTurnsPerDay : aiConfig.scanJobsPerDay
  const hang = await prisma.aiUsageDay.findUnique({
    where: { userId_day_feature: { userId, day: new Date(`${ngayVN()}T00:00:00.000Z`), feature } },
    select: { turnsReserved: true, turnsRefunded: true },
  })

  if (!hang) return { conLai: tong, tong }
  return { conLai: Math.max(0, tong - (hang.turnsReserved - hang.turnsRefunded)), tong }
}
