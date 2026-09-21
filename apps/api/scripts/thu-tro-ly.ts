import 'dotenv/config'
import { CO_KHOA_THAT, aiConfig, ngayVN } from '@uniwork/ai-runtime'
import { prisma } from '../src/lib/prisma.js'
import { batDauLuot } from '../src/modules/chat/chat.service.js'
import { chayLuot, RUNNER_ID } from '../src/modules/chat/tro-ly.service.js'

/**
 * Chạy MỘT lượt hỏi thật, đi qua đúng đường mà endpoint SSE đi.
 *
 * Khác `thu-gemini` ở chỗ đó: `thu-gemini` chỉ kiểm khoá và model sống. Script
 * này ghép cả system prompt, 9 tool, dữ liệu thật trong database, transaction
 * giữ lượt và câu lệnh ghi có điều kiện — tức là lần đầu tiên những thứ đó gặp
 * nhau.
 *
 *   pnpm --filter @uniwork/api thu-tro-ly
 *   pnpm --filter @uniwork/api thu-tro-ly "câu hỏi khác"
 *
 * Dùng một tài khoản RIÊNG (`thu-tro-ly@test.local`) và reset hạn mức của nó
 * mỗi lần chạy, để script gọi lại được nhiều lần mà không đụng vào lượt của tài
 * khoản thật. Bản thân luật hạn mức đã có 20 ca test ở làn database.
 */

const CAU_HOI = process.argv[2] ?? 'có việc pha chế nào ở Hà Nội không, lương bao nhiêu?'

if (!CO_KHOA_THAT) {
  console.error('Chưa có GOOGLE_GENERATIVE_AI_API_KEY trong .env — không chạy được.')
  process.exit(1)
}

async function dungTaiKhoanThu() {
  const u = await prisma.user.upsert({
    where: { email: 'thu-tro-ly@test.local' },
    update: {},
    create: { email: 'thu-tro-ly@test.local', role: 'STUDENT', passwordHash: null },
    select: { id: true },
  })
  const hs = await prisma.studentProfile.upsert({
    where: { userId: u.id },
    update: {},
    create: {
      userId: u.id,
      fullName: 'Nguyễn Văn Thử',
      university: 'Bách khoa Hà Nội',
      major: 'Công nghệ thông tin',
      year: 3,
      phone: '0912345678',
      expectedHourlyRate: 30000,
    },
    select: { id: true },
  })

  // Khai vài ô lịch rảnh để `matchScore` ra số thật thay vì null — nhánh null
  // đã có test riêng, ở đây muốn xem model đọc CON SỐ thế nào.
  const so = await prisma.availability.count({ where: { studentProfileId: hs.id } })
  if (so === 0) {
    await prisma.availability.createMany({
      data: [
        { studentProfileId: hs.id, dayOfWeek: 1, slot: 'EVENING' },
        { studentProfileId: hs.id, dayOfWeek: 3, slot: 'EVENING' },
        { studentProfileId: hs.id, dayOfWeek: 5, slot: 'EVENING' },
        { studentProfileId: hs.id, dayOfWeek: 6, slot: 'MORNING' },
      ],
    })
  }

  const phien = await prisma.chatSession.upsert({
    where: { ownerUserId_clientSessionId: { ownerUserId: u.id, clientSessionId: 'cs-thu-tro-ly' } },
    update: { state: 'AI_ACTIVE', activeAiRunId: null },
    create: {
      kind: 'AI_STUDENT',
      ownerUserId: u.id,
      clientSessionId: 'cs-thu-tro-ly',
      studentProfileId: hs.id,
    },
    select: { id: true },
  })

  // Reset hạn mức + dọn lượt treo, để chạy lại được nhiều lần.
  await prisma.aiTurn.deleteMany({ where: { userId: u.id } })
  await prisma.aiUsageDay.deleteMany({ where: { userId: u.id } })

  return { userId: u.id, sessionId: phien.id }
}

const { userId, sessionId } = await dungTaiKhoanThu()

console.log(`model   : ${aiConfig.chatModel}`)
console.log(`ngày VN : ${ngayVN()}`)
console.log(`hỏi     : ${CAU_HOI}\n`)

const batDau = await batDauLuot({
  userId,
  role: 'STUDENT',
  sessionId,
  clientMessageId: `cm-${Date.now()}`,
  noiDung: CAU_HOI,
  runnerId: RUNNER_ID,
})

if (batDau.loai !== 'moi') {
  console.log('Tin này đã gửi rồi, trả lời cũ:', batDau.traLoiCu)
  await prisma.$disconnect()
  process.exit(0)
}

const t0 = Date.now()
const tool: string[] = []
let chu = 0

await chayLuot({
  userId,
  role: 'STUDENT',
  sessionId,
  turnId: batDau.turnId,
  phat: (ten, du) => {
    if (ten === 'chu') {
      chu += 1
      process.stdout.write(String(du))
      return
    }
    if (ten === 'tool') {
      tool.push((du as { ten: string }).ten)
      process.stdout.write(`\n  [tool: ${(du as { ten: string }).ten}]\n`)
      return
    }
    console.log(`\n\n[${ten}]`, JSON.stringify(du))
  },
  tinHieu: new AbortController().signal,
})

const luot = await prisma.aiTurn.findUniqueOrThrow({ where: { id: batDau.turnId } })

console.log(`
─────────────────────────────────────────
trạng thái : ${luot.state}${luot.errorCode ? ` (${luot.errorCode})` : ''}
nhãn       : ${luot.category}
tool       : ${luot.toolNames.join(', ') || '(không gọi tool nào)'}
vòng tool  : ${luot.toolRounds}
token      : ${luot.inputTokens} vào / ${luot.outputTokens} ra
chữ đầu    : ${luot.timeToFirstTokenMs ?? '—'} ms
tổng       : ${Date.now() - t0} ms · ${chu} mẩu chữ`)

await prisma.$disconnect()
