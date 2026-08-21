import { Readable } from 'node:stream'
import { v2 as cloudinary } from 'cloudinary'
import { env, isProduction } from '../config/env.js'
import { logger } from './logger.js'

/**
 * Lưu CV thật (T56).
 *
 * Render gói miễn phí có filesystem TẠM — mỗi lần service ngủ rồi dậy lại (nó
 * ngủ liên tục), mọi file ghi lên đĩa của service đều mất. Lưu CV vào thư mục
 * trên server là mất dữ liệu, và lỗi này chỉ lộ ra sau vài giờ nên rất dễ lọt
 * qua lúc test. Cloudinary giữ file thay ta, có CDN, gói free đủ dùng cho một
 * đồ án.
 */
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
})

/**
 * Chưa có khoá thật thì trả URL giả thay vì gọi mạng.
 *
 * Cùng lý do HAS_REAL_KEY trong mailer.ts: không có nhánh này thì cả nhóm phải
 * có tài khoản Cloudinary thật mới chạy được dự án trên máy, và test nào chạm
 * upload sẽ gọi mạng thật.
 */
const HAS_REAL_KEY = env.CLOUDINARY_API_KEY !== 'thay-bang-api-key-that'

/**
 * Lỗi Cloudinary trả về không phải luôn là `instanceof Error` — có lúc là một
 * object thường dạng `{ message, http_code }`. Không chuẩn hoá thì lỗi đó bay
 * thẳng tới `error-handler.ts`, nơi `String(err)` một object thường chỉ ra
 * `"[object Object]"` — nuốt mất lý do Cloudinary từ chối (sai định dạng ảnh,
 * quá dung lượng, v.v.), rất khó dò khi có sự cố thật.
 */
function toError(cloudinaryError: unknown): Error {
  if (cloudinaryError instanceof Error) return cloudinaryError
  if (cloudinaryError && typeof cloudinaryError === 'object' && 'message' in cloudinaryError) {
    return new Error(String((cloudinaryError as { message: unknown }).message))
  }
  return new Error(JSON.stringify(cloudinaryError))
}

/**
 * Tải CV (đã xác nhận là PDF hợp lệ ở tầng gọi) lên Cloudinary.
 *
 * `resource_type: 'raw'` vì CV là PDF, không phải ảnh — để mặc định 'image' thì
 * Cloudinary từ chối. `public_id` cố định bằng `userId` và `overwrite: true` để
 * CV mới ghi đè đúng CV cũ tại cùng một URL, thay vì để lại file mồ côi mỗi lần
 * sinh viên tải CV mới lên.
 */
export async function uploadCvFile(buffer: Buffer, userId: string): Promise<string> {
  if (!HAS_REAL_KEY) {
    if (isProduction) {
      throw new Error('Cloudinary chưa được cấu hình trên môi trường production')
    }

    logger.warn('Chưa có CLOUDINARY_API_KEY — không upload thật, trả URL giả', { userId })
    return `https://res.cloudinary.com/dev-fake/raw/upload/uniwork/cv/${userId}.pdf`
  }

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'uniwork/cv', public_id: userId, overwrite: true },
      (error, result) => {
        if (error || !result) {
          reject(error ? toError(error) : new Error('Cloudinary không trả kết quả'))
          return
        }
        resolve(result.secure_url)
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

/* ------------------------------------------------------------------ T57 -- */

/** Định dạng giấy tờ NTD được nhận diện qua byte đầu file, xem lib/file-sniff.ts. */
export type DocumentFileFormat = 'pdf' | 'jpg' | 'png'

/**
 * PDF là tài liệu ('raw'), ảnh chụp là ảnh ('image') — Cloudinary từ chối nếu
 * khai sai loại. Phải nhớ đúng loại này khi dựng lại signed URL sau, không
 * đoán được từ mỗi `public_id`.
 */
function resourceTypeOf(format: DocumentFileFormat): 'raw' | 'image' {
  return format === 'pdf' ? 'raw' : 'image'
}

/**
 * Tải giấy tờ NTD (CCCD, giấy phép KD, mã số thuế) lên Cloudinary ở chế độ
 * `type: 'authenticated'` — KHÁC CV (T56) vốn public.
 *
 * Giấy tờ tuỳ thân nhạy cảm hơn nhiều: lộ CCCD là nguy cơ giả mạo danh tính
 * thật. Ở chế độ authenticated, biết đúng `public_id` cũng không xem được gì —
 * mọi lượt xem đều phải đi qua `getSignedDocumentUrl` bên dưới, cấp một URL
 * sống vài phút, không có URL nào tồn tại vĩnh viễn để lộ qua log hay lịch sử
 * trình duyệt.
 */
export async function uploadDocumentFile(
  buffer: Buffer,
  publicId: string,
  format: DocumentFileFormat,
): Promise<void> {
  if (!HAS_REAL_KEY) {
    if (isProduction) {
      throw new Error('Cloudinary chưa được cấu hình trên môi trường production')
    }

    logger.warn('Chưa có CLOUDINARY_API_KEY — không upload thật', { publicId })
    return
  }

  await new Promise<void>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceTypeOf(format),
        type: 'authenticated',
        public_id: publicId,
        overwrite: true,
      },
      (error) => {
        if (error) {
          reject(toError(error))
          return
        }
        resolve()
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

/** URL xem tạm sống bao lâu. Đủ để mở xem một lần, không đủ để phát tán rồi còn dùng lại được. */
const SIGNED_URL_TTL_SECONDS = 5 * 60

/**
 * Cấp một URL xem tạm cho giấy tờ `authenticated`, ký bằng `CLOUDINARY_API_SECRET`
 * và tự hết hạn sau `SIGNED_URL_TTL_SECONDS`. Cloudinary tự từ chối truy cập khi
 * chữ ký sai hoặc đã quá hạn — không cần tự kiểm tra lại phía ta.
 *
 * Trả kèm `expiresAt` (không chỉ `url`) để nơi gọi không phải tự tính lại —
 * tính riêng ở hai chỗ rất dễ lệch vài giây và báo sai giờ hết hạn cho người dùng.
 */
export function getSignedDocumentUrl(
  publicId: string,
  format: DocumentFileFormat,
): { url: string; expiresAt: Date } {
  const resourceType = resourceTypeOf(format)
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS
  const expiresAt = new Date(expiresAtEpoch * 1000)

  if (!HAS_REAL_KEY) {
    return {
      url: `https://res.cloudinary.com/dev-fake/${resourceType}/authenticated/${publicId}.${format}?expires_at=${expiresAtEpoch}`,
      expiresAt,
    }
  }

  const url = cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: expiresAtEpoch,
    attachment: false,
  })

  return { url, expiresAt }
}
