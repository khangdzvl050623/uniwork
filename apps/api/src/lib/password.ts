import { hash, verify } from '@node-rs/argon2'

/**
 * Băm và kiểm mật khẩu.
 *
 * Dùng Argon2id — thuật toán thắng Password Hashing Competition và là khuyến
 * nghị hiện hành của OWASP. Khác với SHA-256 hay MD5 vốn được thiết kế để chạy
 * NHANH, Argon2 cố tình chạy chậm và ngốn bộ nhớ, nên máy chuyên dò mật khẩu
 * (GPU thử hàng tỉ chuỗi mỗi giây) mất lợi thế gần hết.
 *
 * Không cần tự sinh salt: Argon2 tự sinh và nhét luôn vào chuỗi kết quả. Chuỗi
 * trả về có dạng `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>` — tức là bản
 * thân nó đã mang đủ tham số để kiểm lại sau này. Nhờ vậy đổi tham số ở đây
 * không làm mật khẩu cũ ngừng hoạt động.
 */

/**
 * Tham số theo khuyến nghị OWASP cho Argon2id: 19 MiB bộ nhớ, 2 vòng lặp.
 *
 * Chọn mức thấp nhất trong dải khuyến nghị là có lý do: Render gói free chỉ có
 * 512 MB RAM. Mỗi lần băm chiếm 19 MiB, nên vài request đăng nhập cùng lúc là
 * đã ăn hơn 100 MB. Đẩy `memoryCost` lên 64 MiB cho "an toàn hơn" sẽ khiến
 * service chết vì hết bộ nhớ — an toàn của một hệ thống không chạy được thì
 * bằng không.
 */
const OPTIONS = {
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

/**
 * Kiểm mật khẩu, trả về true/false thay vì ném lỗi.
 *
 * `verify` ném lỗi khi chuỗi băm sai định dạng — chuyện có thể xảy ra nếu dữ
 * liệu trong database bị hỏng, hoặc ai đó sửa tay cột `passwordHash`. Ở luồng
 * đăng nhập, một chuỗi băm hỏng phải cho ra "sai mật khẩu", không phải lỗi 500
 * làm lộ ra rằng bản ghi đó có gì bất thường.
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, OPTIONS)
  } catch {
    return false
  }
}
