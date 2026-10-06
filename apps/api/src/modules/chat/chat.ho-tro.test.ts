import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DANH_MUC_HO_TRO_LABELS } from '@uniwork/shared'
import { quyenTruyCapPhien } from './chat.access.js'
import {
  guiOtpKhach,
  guiYeuCauKhach,
  hangDoiHoTro,
  huyYeuCauHoTro,
  tiepNhanHoTro,
  xuLyYeuCauKhach,
  yeuCauHoTro,
} from './ho-tro.service.js'

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    chatSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ messageSeq: 2 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    chatMessage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        chatSession: {
          update: vi.fn().mockResolvedValue({ messageSeq: 2 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        chatMessage: {
          create: vi.fn().mockResolvedValue({
            id: 'msg-test',
            seq: 2,
            senderType: 'SYSTEM',
            body: 'Hệ thống',
            createdAt: new Date(),
          }),
        },
      }
      return cb(txMock)
    }),
  },
}))

vi.mock('../../lib/email.js', () => ({
  sendMail: vi.fn().mockResolvedValue(true),
  otpEmail: vi.fn().mockReturnValue({ text: '123456', html: '<p>123456</p>' }),
}))

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./socket.gateway.js', () => ({
  phatTinMoi: vi.fn(),
  phatTrangThai: vi.fn(),
  phatToiPhong: vi.fn(),
  PHONG_ADMIN_HO_TRO: 'admin:ho-tro',
}))

import { prisma } from '../../lib/prisma.js'

describe('Tính năng 3: Hỗ trợ giữa người dùng và Admin (ChatKind.AI_SUPPORT)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.chatSession.findMany).mockResolvedValue([])
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        chatSession: {
          update: vi.fn().mockResolvedValue({ messageSeq: 2 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        chatMessage: {
          create: vi.fn().mockResolvedValue({
            id: 'msg-test',
            seq: 2,
            senderType: 'SYSTEM',
            body: 'Hệ thống',
            createdAt: new Date(),
          }),
        },
      }
      return cb(txMock)
    })
  })

  describe('1. Bảo mật và Ranh giới Admin (Admin không đọc được hội thoại riêng tư)', () => {
    it('Admin nhận null khi cố truy cập hội thoại AI_STUDENT', async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-student-ai',
        kind: 'AI_STUDENT',
        ownerUserId: 'u-student',
        state: 'AI_ACTIVE',
        messageSeq: 1,
        handoffEmployerProfileId: null,
        handoffAdminUserId: null,
      } as unknown as never)

      const access = await quyenTruyCapPhien({ id: 'u-admin', role: 'ADMIN' }, 's-student-ai')
      expect(access).toBeNull()
    })

    it('Admin nhận null khi cố truy cập hội thoại NTD giữa SV và Nhà tuyển dụng', async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-recruitment',
        kind: 'NTD',
        ownerUserId: 'u-student',
        state: 'HUMAN_ACTIVE',
        messageSeq: 5,
        handoffEmployerProfileId: 'ep-1',
        handoffAdminUserId: null,
      } as unknown as never)

      const access = await quyenTruyCapPhien({ id: 'u-admin', role: 'ADMIN' }, 's-recruitment')
      expect(access).toBeNull()
    })

    it('Admin có quyền đọc phiên AI_SUPPORT và chỉ được gửi tin khi đã tiếp nhận', async () => {
      // Khi đang chờ (chưa tiếp nhận)
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-support-1',
        kind: 'AI_SUPPORT',
        ownerUserId: 'u-student',
        state: 'WAITING_ADMIN',
        messageSeq: 1,
        handoffEmployerProfileId: null,
        handoffAdminUserId: null,
      } as unknown as never)

      const accessWaiting = await quyenTruyCapPhien({ id: 'u-admin', role: 'ADMIN' }, 's-support-1')
      expect(accessWaiting).not.toBeNull()
      expect(accessWaiting?.vai).toBe('ADMIN_HO_TRO')
      expect(accessWaiting?.duocGui).toBe(false) // Chưa tiếp nhận nên chưa được gửi

      // Khi đã tiếp nhận bởi admin này
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-support-1',
        kind: 'AI_SUPPORT',
        ownerUserId: 'u-student',
        state: 'HUMAN_ACTIVE',
        messageSeq: 2,
        handoffEmployerProfileId: null,
        handoffAdminUserId: 'u-admin',
      } as unknown as never)

      const accessAccepted = await quyenTruyCapPhien({ id: 'u-admin', role: 'ADMIN' }, 's-support-1')
      expect(accessAccepted?.duocGui).toBe(true)

      // Khi admin khác đã tiếp nhận, admin này không được gửi đè
      const accessOtherAdmin = await quyenTruyCapPhien(
        { id: 'u-other-admin', role: 'ADMIN' },
        's-support-1',
      )
      expect(accessOtherAdmin?.duocGui).toBe(false)
    })
  })

  describe('2. Luồng yêu cầu hỗ trợ người dùng (yeuCauHoTro & chuyển trạng thái)', () => {
    it('Chấp nhận danh mục, mô tả và tóm tắt AI xác nhận khi gửi yêu cầu', async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-support-1',
        kind: 'AI_SUPPORT',
        ownerUserId: 'u-student',
        state: 'AI_ACTIVE',
      } as unknown as never)

      let capturedSystemBody = ''
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          chatSession: {
            update: vi.fn().mockResolvedValue({ messageSeq: 2 }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          chatMessage: {
            create: vi.fn().mockImplementation((args: { data: { body: string } }) => {
              capturedSystemBody = args.data.body
              return {
                id: 'msg-1',
                seq: 1,
                senderType: 'SYSTEM',
                body: args.data.body,
                createdAt: new Date(),
              }
            }),
          },
        }
        return cb(txMock)
      })

      const res = await yeuCauHoTro('u-student', 's-support-1', {
        danhMuc: 'HE_THONG',
        moTa: 'Gặp lỗi không nộp được CV',
        tomTatAi: 'Người dùng gặp lỗi 500 khi nộp form tại bước xác nhận',
      })

      expect(res.state).toBe('WAITING_ADMIN')
      expect(capturedSystemBody).toContain(`[Vấn đề: ${DANH_MUC_HO_TRO_LABELS['HE_THONG']}]`)
      expect(capturedSystemBody).toContain('Gặp lỗi không nộp được CV')
      expect(capturedSystemBody).toContain('Bản tóm tắt từ AI đã được người dùng xác nhận:')
      expect(capturedSystemBody).toContain('Người dùng gặp lỗi 500 khi nộp form tại bước xác nhận')
    })

    it('Cho phép người dùng huỷ yêu cầu hỗ trợ khi đang chờ (WAITING_ADMIN -> AI_ACTIVE)', async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-support-1',
        kind: 'AI_SUPPORT',
        ownerUserId: 'u-student',
        state: 'WAITING_ADMIN',
      } as unknown as never)

      const res = await huyYeuCauHoTro('u-student', 's-support-1')
      expect(res.state).toBe('AI_ACTIVE')
    })
  })

  describe('3. Admin tiếp nhận hỗ trợ (tiepNhanHoTro)', () => {
    it('Chuyển trạng thái WAITING_ADMIN -> HUMAN_ACTIVE và gán handoffAdminUserId', async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValue({
        id: 's-support-1',
        kind: 'AI_SUPPORT',
        ownerUserId: 'u-student',
      } as unknown as never)

      const res = await tiepNhanHoTro('u-admin', 's-support-1')
      expect(res.state).toBe('HUMAN_ACTIVE')
    })
  })

  describe('4. Kênh liên hệ riêng cho khách chưa đăng nhập (OTP Email Verification)', () => {
    const testEmail = 'guest.applicant@example.com'

    it('guiOtpKhach tạo mã xác thực 6 số và gửi qua email', async () => {
      const res = await guiOtpKhach(testEmail)
      // Trong môi trường test / non-prod trả về devCode 6 số
      expect(res.devCode).toBeDefined()
      expect(res.devCode).toMatch(/^\d{6}$/)
    })

    it('guiYeuCauKhach từ chối khi nhập mã OTP sai', async () => {
      await guiOtpKhach(testEmail)

      await expect(
        guiYeuCauKhach({
          email: testEmail,
          code: '000000', // Sai mã
          hoTen: 'Nguyễn Văn A',
          danhMuc: 'TAI_KHOAN',
          moTa: 'Bị khóa tài khoản không rõ lý do',
        }),
      ).rejects.toThrow('Mã xác thực không đúng')
    })

    it('guiYeuCauKhach tạo ticket thành công khi mã OTP chính xác', async () => {
      const otpRes = await guiOtpKhach(testEmail)
      const validCode = otpRes.devCode!

      const res = await guiYeuCauKhach({
        email: testEmail,
        code: validCode,
        hoTen: 'Nguyễn Văn A',
        phone: '0901234567',
        danhMuc: 'TAI_KHOAN',
        moTa: 'Bị khóa tài khoản không rõ lý do',
      })

      expect(res.ticket).toBeDefined()
      expect(res.ticket.email).toBe(testEmail)
      expect(res.ticket.status).toBe('WAITING_ADMIN')
      expect(res.ticket.danhMuc).toBe('TAI_KHOAN')

      // Kiểm tra hàng đợi có chứa ticket này
      const queue = await hangDoiHoTro()
      expect(queue.hoTroKhach.some((t) => t.id === res.ticket.id)).toBe(true)

      // Admin xử lý ticket
      const processed = await xuLyYeuCauKhach('u-admin', res.ticket.id, 'RESOLVED', 'Đã mở khóa tài khoản')
      expect(processed.ticket.status).toBe('RESOLVED')
      expect(processed.ticket.ghiChuXuLy).toBe('Đã mở khóa tài khoản')
    })
  })
})
