/**
 * Xác nhận nội dung file thật bằng byte đầu ("magic bytes"), không tin đuôi
 * file hay `mimetype` trình duyệt khai — cả hai đều suy từ TÊN file, không đọc
 * nội dung. Một file `virus.exe` đổi tên thành `virus.pdf` vẫn được trình
 * duyệt gắn `mimetype: application/pdf`, lọt qua mọi kiểm tra dựa trên tên hay
 * mimetype. Đây là lớp kiểm tra thật, dùng chung cho CV (T56) và giấy tờ NTD
 * (T57).
 */

const PDF_MAGIC = Buffer.from('%PDF-')
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export type SniffedKind = 'pdf' | 'jpeg' | 'png'

function startsWith(buffer: Buffer, magic: Buffer): boolean {
  return buffer.subarray(0, magic.length).equals(magic)
}

/** Trả về `null` khi không nhận ra byte đầu — gọi tại chỗ tự quyết định từ chối. */
export function sniffFileKind(buffer: Buffer): SniffedKind | null {
  if (startsWith(buffer, PDF_MAGIC)) return 'pdf'
  if (startsWith(buffer, JPEG_MAGIC)) return 'jpeg'
  if (startsWith(buffer, PNG_MAGIC)) return 'png'
  return null
}
