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
     * — bảng không có unique nào khác. Nghĩa là tài khoản đang có một lượt chạy dở
     * CỦA CÙNG TÍNH NĂNG (chỉ mục khoá theo `userId, feature`).
     *
     * Lượt đó có thể đã chết theo process cũ — `donLuotMoCoi` dọn nó trong vòng
     * vài phút, nên 409 ở đây giờ là trạng thái tạm, không còn là vĩnh viễn.
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

interface ThamSoChotLuot {
  turnId: string
  state: 'SUCCEEDED' | 'FAILED'
  inputTokens?: number
  outputTokens?: number
  requestCount?: number
  toolRounds?: number
  toolNames?: string[]
  category?: string
  latencyMs?: number
  timeToFirstTokenMs?: number
  errorCode?: string
  handoffProposed?: boolean
}

/**
 * Chốt một lượt đã chạy xong.
 *
 * ---------------------------------------------------------------------------
 * `FAILED` VẪN TRỪ LƯỢT — ĐÓ LÀ CHỦ ĐÍCH, KHÔNG PHẢI THIẾU SÓT
 * ---------------------------------------------------------------------------
 * Model trả lời được nửa câu rồi lỗi thì token đã tiêu thật, hạn mức RPD của
 * nhà cung cấp đã bị trừ thật. Hoàn lượt ở đây là mời người dùng bấm lại năm
 * lần và đốt năm lần tài nguyên với đúng một lượt trên sổ.
 *
 * Chỉ hoàn khi CHƯA tiêu gì — xem `hoanLuot`.
 */
/*
 * Nhận `PrismaClient` đầy đủ, KHÔNG nhận `tx` như `giuLuot`: hai hàm này tự mở
 * transaction của mình. Chúng chạy SAU khi model đã trả lời xong, tức là ngoài
 * transaction giữ lượt — lồng một transaction dài bằng cả lượt gọi model sẽ giữ
 * kết nối trong suốt thời gian đó.
 */
export async function chotLuot(prisma: PrismaClient, ts: ThamSoChotLuot): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const turn = await tx.aiTurn.update({
      where: { id: ts.turnId, state: 'RESERVED' },
      data: {
        state: ts.state,
        settledAt: new Date(),
        inputTokens: ts.inputTokens ?? 0,
        outputTokens: ts.outputTokens ?? 0,
        requestCount: ts.requestCount ?? 0,
        toolRounds: ts.toolRounds ?? 0,
        toolNames: ts.toolNames ?? [],
        category: ts.category ?? null,
        latencyMs: ts.latencyMs ?? null,
        timeToFirstTokenMs: ts.timeToFirstTokenMs ?? null,
        errorCode: ts.errorCode ?? null,
        handoffProposed: ts.handoffProposed ?? false,
      },
      select: { userId: true, feature: true, quotaDay: true },
    })

    await tx.aiUsageDay.update({
      where: {
        userId_day_feature: {
          userId: turn.userId,
          day: turn.quotaDay,
          feature: turn.feature,
        },
      },
      data: { turnsUsed: { increment: 1 } },
    })
  })
}

/**
 * Hoàn một lượt CHƯA tiêu gì: hết lượt ở tầng nhà cung cấp, mạch ngắt đang mở,
 * hoặc process tắt trước khi gọi model.
 *
 * Cộng vào `turnsRefunded` của `quotaDay` CHÉP TRONG LƯỢT, không phải của hôm
 * nay. Lượt giữ lúc 23:58 và hoàn lúc 00:03 mà tính theo ngày hiện tại là cộng
 * vào bucket ngày mai — người dùng tự nhiên có sáu lượt.
 */
export async function hoanLuot(
  prisma: PrismaClient,
  turnId: string,
  errorCode: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const turn = await tx.aiTurn.update({
      where: { id: turnId, state: 'RESERVED' },
      data: { state: 'REFUNDED', settledAt: new Date(), errorCode },
      select: { userId: true, feature: true, quotaDay: true },
    })

    await tx.aiUsageDay.update({
      where: {
        userId_day_feature: {
          userId: turn.userId,
          day: turn.quotaDay,
          feature: turn.feature,
        },
      },
      data: { turnsRefunded: { increment: 1 } },
    })
  })
}

/* ======================================================= lượt mồ côi -- */

/**
 * Hoàn mọi lượt `RESERVED` khớp điều kiện. Trả về số lượt đã hoàn.
 *
 * ===========================================================================
 * VÌ SAO HÀM NÀY TỒN TẠI — VÀ VÌ SAO THIẾU NÓ LÀ KHOÁ VĨNH VIỄN
 * ===========================================================================
 * Lượt nằm ở `RESERVED` suốt lúc model chạy, và chỉ rời trạng thái đó khi
 * CHÍNH process đang chạy gọi `chotLuot` / `hoanLuot` lúc kết thúc. Process
 * chết giữa chừng — deploy, hết RAM, Render thay máy — thì không ai gọi nữa.
 *
 * Hàng đó đứng nguyên trong chỉ mục một phần `ai_turns_mot_luot_dang_chay`,
 * nên MỌI lần giữ lượt sau của tài khoản ấy đụng chỉ mục → `DangBanError` →
 * 409 AI_BUSY. Không tự hết, không qua ngày — chỉ mục không có cột ngày nào.
 *
 * `reservedAt` có hai chỉ mục từ đầu, đúng để làm việc này, nhưng trước đây
 * không dòng code nào đọc nó. Luật 17 trong `thiet-ke.md` và bước 2 của lộ
 * trình ("circuit, sweeper") đều có ghi — chỉ là không có đường thực thi.
 *
 * ---------------------------------------------------------------------------
 * HAI ĐIỀU KIỆN, HAI CA CHẾT KHÁC NHAU
 * ---------------------------------------------------------------------------
 *   `runnerId` — process sắp tắt dọn ĐÚNG lượt của mình (luật 17). Nhanh,
 *                nhưng chỉ chạy được khi process còn kịp nhận SIGTERM.
 *
 *   `cuHon`    — lượt giữ quá lâu so với trần thời gian một lượt. Lưới an
 *                toàn cho crash cứng, khi không ai kịp chạy gì cả.
 *
 * KHÔNG có điều kiện "mọi lượt của runner khác": lúc có hai instance API, lượt
 * của instance kia đang chạy thật. Tuổi là thứ duy nhất chứng minh được một
 * lượt đã chết mà không cần biết ai sở hữu nó.
 *
 * ---------------------------------------------------------------------------
 * HOÀN, KHÔNG PHẠT
 * ---------------------------------------------------------------------------
 * Process chết là lỗi của ta. Người dùng có thể đã thấy nửa câu trả lời, có
 * thể chưa thấy chữ nào — ta không biết, và trừ lượt trong lúc không biết là
 * bắt họ trả giá cho sự cố hạ tầng.
 */
export async function donLuotMoCoi(
  prisma: PrismaClient,
  dieuKien: { runnerId: string } | { cuHon: Date },
  errorCode: string,
): Promise<number> {
  const dsLuot = await prisma.aiTurn.findMany({
    where: {
      state: 'RESERVED',
      ...('runnerId' in dieuKien
        ? { runnerId: dieuKien.runnerId }
        : { reservedAt: { lt: dieuKien.cuHon } }),
    },
    select: { id: true },
    take: 500,
  })

  let daHoan = 0
  for (const { id } of dsLuot) {
    try {
      await hoanLuot(prisma, id, errorCode)
      daHoan += 1
    } catch (e) {
      /*
       * P2025 = lượt vừa rời `RESERVED` giữa lúc đọc và lúc hoàn — process
       * đang chạy kịp chốt nó. Đó là kết cục ĐÚNG, không phải lỗi: `hoanLuot`
       * và `chotLuot` đều ghi có điều kiện `state: 'RESERVED'`, nên đúng một
       * bên thắng và bộ đếm không bị cộng hai lần.
       */
      if (!laKhongTimThay(e)) throw e
    }
  }
  return daHoan
}

function laKhongTimThay(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2025'
}
