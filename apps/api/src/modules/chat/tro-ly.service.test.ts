import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APICallError, _datLaiMach, machChoPhep, type ModelMessage } from '@uniwork/ai-runtime'
import { chayLuot } from './tro-ly.service.js'

/**
 * `chayLuot` BÁO KẾT QUẢ cho mạch ngắt — dây nối, không phải logic của mạch.
 *
 * Logic của mạch có test riêng (`mach-ngat.test.ts`). Ở đây canh hai dòng gọi
 * nằm trong `chayLuot`, vì mất một trong hai thì không có lỗi nào bắn ra:
 *
 *   mất `ghiLoi`       — mạch không bao giờ mở. Sự cố 429 lại kéo dài như cũ.
 *   mất `ghiThanhCong` — mạch mở xong không bao giờ đóng hẳn. Sau lần ngắt đầu,
 *                        một lỗi lẻ duy nhất là đủ ngắt lại, mãi mãi.
 *
 * Mạch dùng bản THẬT; chỉ thay model, sổ lượt và database.
 */

const chayLuotChatGia = vi.hoisted(() => vi.fn())

vi.mock('@uniwork/ai-runtime', async (goc) => ({
  ...(await goc<typeof import('@uniwork/ai-runtime')>()),
  chayLuotChat: chayLuotChatGia,
  chotLuot: vi.fn(async () => {}),
  hoanLuot: vi.fn(async () => {}),
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }))

vi.mock('./chat.service.js', () => ({
  layLichSu: vi.fn(async (): Promise<ModelMessage[]> => []),
  ghiTraLoi: vi.fn(async () => ({ ghi: true, seq: 2 })),
  boCoDangChay: vi.fn(async () => {}),
}))

vi.mock('./tro-ly.cau-hinh.js', () => ({
  cauHinhTroLy: () => ({
    system: 'he thong',
    promptVersion: 'test-1',
    cauKhiChamTran: 'cham tran',
    dungTool: () => ({}),
  }),
}))

const loi429 = () =>
  new APICallError({
    message: 'Resource has been exhausted',
    url: 'https://generativelanguage.googleapis.com',
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  })

const traLoiTot = {
  traLoi: 'Có 3 việc phù hợp.',
  inputTokens: 10,
  outputTokens: 5,
  toolRounds: 0,
  toolNames: [],
  timeToFirstTokenMs: 100,
  latencyMs: 200,
  soLanGoiModel: 1,
  msModel: 150,
  chamTran: false,
  goiTool: [],
}

const motLuot = () =>
  chayLuot({
    userId: 'u-1',
    role: 'STUDENT',
    sessionId: 'p-1',
    kind: 'AI_STUDENT',
    turnId: 't-1',
    phat: () => {},
    tinHieu: new AbortController().signal,
  })

let bayGio = 1_000_000

beforeEach(() => {
  bayGio = 1_000_000
  _datLaiMach(() => bayGio)
  chayLuotChatGia.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  _datLaiMach()
  vi.restoreAllMocks()
})

describe('chayLuot báo kết quả cho mạch ngắt', () => {
  it('ba lượt gặp 429 liên tiếp thì mạch MỞ', async () => {
    chayLuotChatGia.mockRejectedValue(loi429())
    for (let i = 0; i < 3; i += 1) await motLuot()
    expect(machChoPhep().duoc).toBe(false)
  })

  /*
   * Mạch đã mở rồi hết chờ, một lượt thành công phải ĐÓNG HẲN nó — đủ ba lỗi
   * mới mở lại. Thiếu `ghiThanhCong` thì một lỗi lẻ ở đây đã ngắt lại.
   */
  it('sau khi mở, một lượt thành công đóng hẳn mạch', async () => {
    chayLuotChatGia.mockRejectedValue(loi429())
    for (let i = 0; i < 3; i += 1) await motLuot()
    bayGio += 60_001

    chayLuotChatGia.mockResolvedValueOnce(traLoiTot)
    await motLuot()

    chayLuotChatGia.mockRejectedValueOnce(loi429())
    await motLuot()
    expect(machChoPhep().duoc).toBe(true)
  })

  it('lỗi KHÔNG phải của nhà cung cấp thì mạch vẫn đóng', async () => {
    chayLuotChatGia.mockRejectedValue(new Error('lỗi của ta, không phải của Gemini'))
    for (let i = 0; i < 5; i += 1) await motLuot()
    expect(machChoPhep().duoc).toBe(true)
  })
})
