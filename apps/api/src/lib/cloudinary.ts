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
          reject(error ?? new Error('Cloudinary không trả kết quả'))
          return
        }
        resolve(result.secure_url)
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}
