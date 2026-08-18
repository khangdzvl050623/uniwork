import { env, isProduction } from '../config/env.js'
import { logger } from './logger.js'

/**
 * Gửi email giao dịch qua Brevo.
 *
 * Gọi thẳng REST API bằng `fetch` thay vì cài SDK `@getbrevo/brevo`. Ta chỉ
 * dùng đúng một endpoint, mà SDK đó kéo theo cả tầng sinh code từ OpenAPI —
 * vài megabyte phụ thuộc cho một lời gọi HTTP mười dòng. Node 22 có `fetch`
 * sẵn, không cần gì thêm.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO BREVO CHỨ KHÔNG PHẢI RESEND
 * ---------------------------------------------------------------------------
 * Gói miễn phí của Resend chỉ gửi được tới địa chỉ đã xác thực cho tới khi ta
 * xác thực được một tên miền — mà đồ án thì không có tên miền. Nghĩa là hôm bảo
 * vệ, người chấm nhập email của họ và sẽ KHÔNG nhận được gì.
 *
 * Brevo chỉ đòi xác thực ĐỊA CHỈ GỬI, còn người nhận thì tự do. Đúng thứ cần
 * cho một sản phẩm demo có người lạ dùng thử.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

/**
 * Khoá chưa có thì in ra console thay vì gửi.
 *
 * Điều này quan trọng hơn vẻ ngoài của nó. Không có nó thì:
 * - Cả nhóm phải có khoá thật mới chạy được dự án trên máy.
 * - Test nào chạm tới luồng OTP sẽ gọi mạng thật, chậm và hỏng khi mất mạng.
 * - Lúc demo mà email tới chậm hoặc rơi vào spam thì không còn đường nào khác.
 *
 * Ở production KHÔNG được rơi vào nhánh này — có chốt chặn bên dưới.
 */
const HAS_REAL_KEY =
  !env.BREVO_API_KEY.startsWith('xkeysib-thay') && env.BREVO_API_KEY !== 'test-key'

export interface Mail {
  to: string
  subject: string
  /** Nội dung HTML. Brevo yêu cầu có ít nhất htmlContent hoặc textContent. */
  html: string
}

/**
 * Người gửi. Địa chỉ này PHẢI được xác thực trong Brevo (Senders & IP), nếu
 * không mọi lời gọi đều trả 400 với thông điệp khá khó hiểu.
 */
const SENDER = { name: 'UniWork', email: 'no-reply@uniwork.vn' }

export async function sendMail(mail: Mail): Promise<void> {
  if (!HAS_REAL_KEY) {
    if (isProduction) {
      // Ở production, im lặng bỏ qua email là kiểu hỏng tệ nhất: người dùng
      // đăng ký xong ngồi đợi mã mãi không tới, còn log thì sạch bong.
      throw new Error('BREVO_API_KEY chưa được cấu hình trên môi trường production')
    }

    logger.warn('Chưa có BREVO_API_KEY — in email ra console thay vì gửi', {
      to: mail.to,
      subject: mail.subject,
      // In cả nội dung để lập trình viên copy được mã OTP từ terminal.
      html: mail.html,
    })
    return
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
    }),
  })

  if (!response.ok) {
    // Đọc nguyên văn lỗi của Brevo rồi ghi log — thông điệp của họ nói rõ sai ở
    // đâu (địa chỉ gửi chưa xác thực, hết hạn mức, khoá sai). Nuốt lỗi ở đây là
    // tự bịt mắt mình.
    const detail = await response.text().catch(() => '')
    logger.error('Brevo từ chối gửi email', { status: response.status, detail })
    throw new Error(`Không gửi được email (Brevo trả ${response.status})`)
  }
}

/**
 * Mẫu email chứa mã xác thực.
 *
 * Cố ý viết HTML thô, không dùng thư viện dựng template. Chỉ có hai email trong
 * cả dự án (xác thực và đặt lại mật khẩu), thêm một tầng template chỉ để dùng
 * hai lần là đổi lấy sự phức tạp mà không được gì.
 *
 * Kiểu dáng dùng thuộc tính `style` gắn thẳng vào thẻ chứ không dùng `<style>`
 * ở đầu trang: Gmail cắt bỏ khối `<style>` trong nhiều trường hợp, nên email
 * sẽ hiện ra trần trụi không định dạng.
 */
export function otpEmail(code: string): Pick<Mail, 'subject' | 'html'> {
  return {
    subject: `${code} là mã xác thực UniWork của bạn`,
    html: `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#14161b">
  <h1 style="margin:0 0 8px;font-size:20px;color:#00857a">UniWork</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#5d636e">Việc làm bán thời gian khớp lịch học</p>

  <p style="margin:0 0 16px;font-size:15px">Mã xác thực của bạn là:</p>

  <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#e6fbf7;border-radius:12px;text-align:center;color:#00857a">
    ${code}
  </div>

  <p style="margin:24px 0 0;font-size:14px;color:#5d636e">
    Mã có hiệu lực trong <strong>10 phút</strong> và chỉ dùng được một lần.
  </p>
  <p style="margin:8px 0 0;font-size:14px;color:#5d636e">
    Nếu bạn không yêu cầu mã này, bỏ qua email — tài khoản của bạn vẫn an toàn.
  </p>
</div>`.trim(),
  }
}
