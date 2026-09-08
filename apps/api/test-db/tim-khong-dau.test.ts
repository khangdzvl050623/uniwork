import { PrismaClient, SalaryUnit, ScheduleType } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Tìm kiếm không dấu — kiểm trên PostgreSQL THẬT.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO LÀN TEST CHÍNH KHÔNG ĐỦ
 * ---------------------------------------------------------------------------
 * `jobs.test.ts` giả lập Prisma nên nó chỉ kiểm được HÌNH DẠNG câu SQL: có gọi
 * `unaccent` không, có thoát `%` không. Nó hoàn toàn mù với những thứ chỉ
 * Postgres mới biết, mà đó lại đúng là chỗ tính năng này sống hay chết:
 *
 * - Extension `unaccent` có được cài trong database này không. Thiếu nó thì mọi
 *   truy vấn tìm kiếm ném lỗi, và làn test chính vẫn xanh trơn.
 * - Bộ quy tắc mặc định có xử lý `đ → d` không. Đây là câu hỏi về DỮ LIỆU của
 *   extension, không phải về code — không mock nào trả lời được.
 * - `ILIKE` với dấu thoát `\` có chạy đúng như mình nghĩ không.
 *
 * Sprint 3 đã có một bài học đúng loại này: bug slug qua sạch mọi unit test vì
 * test dùng id cuid còn dữ liệu thật dùng id viết tay.
 */

const prisma = new PrismaClient()

/** Mọi bản ghi test tạo ra đều mang tiền tố này để dọn cho sạch. */
const TIEN_TO = 'test-khongdau-'

let employerProfileId: string

beforeAll(async () => {
  const employer = await prisma.employerProfile.findFirst()
  if (!employer) {
    throw new Error(
      'Database chưa có dữ liệu mẫu. Chạy `pnpm db:up && pnpm db:seed` trước khi chạy test:db.',
    )
  }
  employerProfileId = employer.id

  // Tự dựng tin thay vì dựa vào seed: tiêu đề phải chứa đúng những dấu cần thử
  // (ư, ơ, ê, đ), và bám vào tiêu đề của seed thì đổi seed là test mục.
  await prisma.job.createMany({
    data: [
      tin('a', 'Gia sư Toán lớp 9', 'Kèm học sinh cấp hai tại nhà.'),
      tin('b', 'Đầu bếp phụ ca tối', 'Sơ chế nguyên liệu, hỗ trợ bếp chính.'),
      tin('c', 'Nhân viên kho', 'Công việc nhẹ, 50% thời gian đứng.'),
    ],
  })
})

afterAll(async () => {
  await prisma.job.deleteMany({ where: { id: { startsWith: TIEN_TO } } })
  await prisma.$disconnect()
})

function tin(hau: string, title: string, description: string) {
  return {
    id: `${TIEN_TO}${hau}`,
    employerProfileId,
    title,
    description,
    city: 'TP.HCM',
    district: 'Quận 1',
    // Hình dạng tối thiểu hợp lệ, khớp `tinHopLe()` trong `rang-buoc.test.ts` —
    // bốn CHECK constraint viết tay của bảng `jobs` từ chối mọi tổ hợp khác.
    salaryNegotiable: false,
    salaryMin: 25_000,
    salaryMax: 30_000,
    salaryUnit: SalaryUnit.HOUR,
    scheduleType: ScheduleType.RECURRING,
    deadline: new Date('2027-01-01'),
    status: 'OPEN' as const,
  }
}

/**
 * Chạy ĐÚNG câu SQL mà `layIdKhopTuKhoa` chạy.
 *
 * Chép câu truy vấn thay vì gọi thẳng hàm đó: hàm nằm trong `jobs.service.ts`,
 * kéo nó vào đây sẽ kéo theo cả `lib/prisma.js` với biến môi trường của server.
 * Đổi lại là hai bản phải khớp nhau — nên ca cuối file kiểm đúng điều đó.
 */
async function tim(tuKhoa: string): Promise<string[]> {
  const mau = `%${tuKhoa.replace(/[\\%_]/g, (kyTu) => `\\${kyTu}`)}%`
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "jobs"
    WHERE "status" = 'OPEN'
      AND (unaccent("title") ILIKE unaccent(${mau})
        OR unaccent("description") ILIKE unaccent(${mau}))
  `
  return rows.map((r) => r.id).filter((id) => id.startsWith(TIEN_TO))
}

describe('tìm kiếm không dấu trên Postgres thật', () => {
  it('extension unaccent phải tồn tại trong database này', async () => {
    // Ca đầu tiên và quan trọng nhất. Thiếu extension thì mọi ca dưới đều đỏ,
    // nhưng với thông báo lỗi khó đọc; ca này nói thẳng nguyên nhân.
    const rows =
      await prisma.$queryRaw<{ extname: string }[]>`SELECT extname FROM pg_extension WHERE extname = 'unaccent'`

    expect(rows, 'chưa chạy migration 20260906120000_sprint5_tim_khong_dau?').toHaveLength(1)
  })

  it('gõ KHÔNG dấu tìm ra tin CÓ dấu', async () => {
    expect(await tim('gia su')).toEqual([`${TIEN_TO}a`])
  })

  it('gõ CÓ dấu vẫn tìm ra — không làm hỏng nhóm người dùng cũ', async () => {
    expect(await tim('Gia sư')).toEqual([`${TIEN_TO}a`])
  })

  it('không phân biệt hoa thường, kể cả khi đã bỏ dấu', async () => {
    expect(await tim('GIA SU')).toEqual([`${TIEN_TO}a`])
  })

  it('⚠ đ → d chạy sẵn, không cần bộ rules tự chế', async () => {
    // Câu hỏi về DỮ LIỆU của extension, không phải về code. Mock không trả lời
    // được, và đoán sai thì mọi tin bắt đầu bằng "Đ" biến mất khỏi kết quả.
    expect(await tim('dau bep')).toEqual([`${TIEN_TO}b`])
  })

  it('tìm cả trong phần mô tả, không chỉ tiêu đề', async () => {
    expect(await tim('so che nguyen lieu')).toEqual([`${TIEN_TO}b`])
  })

  it('⚠ % không thành ký tự đại diện', async () => {
    // Không thoát thì câu này trả về MỌI tin. Ở đây nó phải khớp đúng tin có
    // chuỗi "50%" thật trong mô tả.
    expect(await tim('%')).toEqual([`${TIEN_TO}c`])
  })

  it('⚠ _ không thành ký tự đại diện', async () => {
    // `_` khớp một ký tự bất kỳ nếu không thoát, nên `'_'` sẽ trả về mọi tin.
    expect(await tim('_')).toEqual([])
  })

  it('từ khoá không khớp gì thì ra rỗng', async () => {
    expect(await tim('khong-co-tin-nao-ten-the-nay')).toEqual([])
  })

  it('câu SQL ở đây phải giống hệt câu trong jobs.service.ts', async () => {
    /*
     * File này chép câu truy vấn. Chép là có hai bản, và bản trong test sẽ tiếp
     * tục xanh sau khi bản thật đã đổi — test biến thành vô dụng mà không ai
     * biết. Ca này đọc mã nguồn thật để bắt lúc chúng lệch nhau.
     */
    const { readFile } = await import('node:fs/promises')
    const nguon = await readFile(
      new URL('../src/modules/jobs/jobs.service.ts', import.meta.url),
      'utf8',
    )

    expect(nguon).toContain('unaccent("title") ILIKE unaccent(')
    expect(nguon).toContain('unaccent("description") ILIKE unaccent(')
    expect(nguon).toContain('q.replace(/[\\\\%_]/g')
  })
})
