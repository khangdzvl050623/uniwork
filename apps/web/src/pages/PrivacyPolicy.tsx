import { Link } from 'react-router-dom'
import { Mail, ShieldCheck } from 'lucide-react'
import { Muc, VanBan } from '@/components/layout/VanBanPhapLy'
import { LIEN_HE, NGAY_CAP_NHAT } from '@/lib/thong-tin-phap-ly'

/**
 * Chính sách bảo mật.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO TRANG NÀY BẮT BUỘC PHẢI CÓ
 * ---------------------------------------------------------------------------
 * Google đòi một đường dẫn chính sách bảo mật công khai trước khi cho phép
 * ứng dụng OAuth chuyển sang chế độ production. Không có nó thì nút "Đăng nhập
 * bằng Google" chỉ dùng được với danh sách tài khoản thử do mình tự thêm — vô
 * dụng với người dùng thật.
 *
 * Nội dung dưới đây phải mô tả ĐÚNG những gì hệ thống thật sự làm. Chép một
 * mẫu chính sách trên mạng về là tự khai những thứ mình không làm (và bỏ sót
 * những thứ mình có làm, như gửi CV lên Cloudinary) — vừa vô nghĩa với người
 * đọc, vừa là cam kết sai.
 */
export function PrivacyPolicy() {
  return (
    <VanBan
      icon={ShieldCheck}
      title="Chính sách bảo mật"
      subtitle={`Cập nhật lần cuối: ${NGAY_CAP_NHAT}`}
    >
      <p>
        UniWork là nền tảng kết nối sinh viên với việc làm bán thời gian phù hợp lịch học. Trang
        này nói rõ chúng tôi thu thập dữ liệu gì, dùng để làm gì, và gửi cho ai.
      </p>

      <Muc title="1. Dữ liệu chúng tôi thu thập">
        <p>Chỉ những dữ liệu cần cho việc ghép sinh viên với công việc:</p>
        <ul>
          <li>
            <strong>Tài khoản:</strong> địa chỉ email, mật khẩu (lưu dưới dạng đã băm bằng
            Argon2id — chúng tôi không bao giờ lưu mật khẩu gốc và không có cách nào đọc lại
            được), vai trò (sinh viên hoặc nhà tuyển dụng).
          </li>
          <li>
            <strong>Hồ sơ sinh viên:</strong> họ tên, trường, ngành, năm học, giới thiệu bản
            thân, kỹ năng, lịch rảnh theo tuần, và tệp CV nếu bạn tải lên.
          </li>
          <li>
            <strong>Hồ sơ nhà tuyển dụng:</strong> tên công ty, địa chỉ, website, mô tả, và giấy
            tờ xác minh doanh nghiệp (giấy phép kinh doanh, mã số thuế, CCCD người đại diện).
          </li>
          <li>
            <strong>Phiên đăng nhập:</strong> địa chỉ IP và thông tin trình duyệt tại thời điểm
            đăng nhập, để bạn nhận ra thiết bị lạ trong danh sách phiên của mình.
          </li>
        </ul>
      </Muc>

      <Muc title="2. Khi bạn đăng nhập bằng Google">
        <p>
          Chúng tôi chỉ xin ba quyền cơ bản: <code>openid</code>, <code>email</code> và{' '}
          <code>profile</code>. Từ đó chúng tôi đọc <strong>địa chỉ email, tên hiển thị, ảnh đại
          diện</strong> và mã định danh tài khoản Google của bạn.
        </p>
        <p>
          Chúng tôi <strong>không</strong> xin quyền truy cập Gmail, Google Drive, Lịch, Danh bạ
          hay bất kỳ dịch vụ nào khác của Google, và <strong>không lưu</strong> mã truy cập của
          Google. Chúng tôi không thể — và không bao giờ — thay mặt bạn làm bất cứ điều gì trên
          tài khoản Google.
        </p>
      </Muc>

      <Muc title="3. Dữ liệu được gửi cho ai">
        <p>Chúng tôi không bán dữ liệu. Dữ liệu chỉ đi tới:</p>
        <ul>
          <li>
            <strong>Nhà tuyển dụng bạn ứng tuyển:</strong> họ xem được hồ sơ và CV của bạn. Chỉ
            khi bạn chủ động ứng tuyển.
          </li>
          <li>
            <strong>Nhà cung cấp hạ tầng:</strong> Neon (cơ sở dữ liệu), Render (máy chủ),
            Vercel (giao diện web), Cloudinary (lưu CV và giấy tờ), Brevo (gửi email xác thực).
            Họ xử lý dữ liệu thay chúng tôi, không dùng cho mục đích riêng.
          </li>
          <li>
            <strong>Cơ quan nhà nước</strong>, khi có yêu cầu hợp pháp.
          </li>
        </ul>
      </Muc>

      <Muc title="4. Chúng tôi bảo vệ dữ liệu thế nào">
        <ul>
          <li>Mật khẩu băm bằng Argon2id, không lưu bản gốc.</li>
          <li>
            Phiên đăng nhập dùng cookie <code>httpOnly</code> mà JavaScript không đọc được, và
            được xoay vòng mỗi lần gia hạn. Phát hiện dấu hiệu token bị đánh cắp thì huỷ toàn bộ
            phiên của tài khoản đó.
          </li>
          <li>
            Giấy tờ xác minh doanh nghiệp (gồm CCCD) lưu ở chế độ riêng tư — không có đường dẫn
            công khai nào xem được. Mỗi lần xem phải xin một đường dẫn tạm chỉ sống vài phút.
          </li>
          <li>Toàn bộ kết nối đi qua HTTPS.</li>
        </ul>
      </Muc>

      <Muc title="5. Quyền của bạn">
        <p>Bạn có thể:</p>
        <ul>
          <li>Xem và sửa mọi thông tin trong hồ sơ, bất cứ lúc nào.</li>
          <li>Tải CV mới đè lên CV cũ, hoặc xoá lịch rảnh đã khai.</li>
          <li>
            Yêu cầu xoá tài khoản. Khi tài khoản bị xoá, toàn bộ hồ sơ, kỹ năng, lịch rảnh và
            đơn ứng tuyển gắn với nó cũng bị xoá theo.
          </li>
        </ul>
        <p>
          Để yêu cầu xoá dữ liệu, gửi email tới{' '}
          <a href={`mailto:${LIEN_HE}`} className="text-brand-600 hover:underline">
            {LIEN_HE}
          </a>
          .
        </p>
      </Muc>

      <Muc title="6. Lưu dữ liệu bao lâu">
        <p>
          Dữ liệu hồ sơ được giữ chừng nào tài khoản còn tồn tại. Mã xác thực gửi qua email chỉ
          sống 10 phút. Phiên đăng nhập hết hạn sau 7 ngày không hoạt động.
        </p>
      </Muc>

      <Muc title="7. Đây là đồ án học tập">
        <p>
          UniWork được xây dựng như một đồ án môn học của sinh viên. Chúng tôi cố gắng bảo vệ dữ
          liệu đúng thực hành tốt nhất mà mình biết, nhưng đây không phải một dịch vụ thương mại
          có đội ngũ vận hành 24/7. Vui lòng cân nhắc điều đó trước khi tải lên giấy tờ nhạy cảm.
        </p>
      </Muc>

      <Muc title="8. Liên hệ">
        <p className="flex items-center gap-2">
          <Mail size={16} className="shrink-0 text-slate-400" />
          <a href={`mailto:${LIEN_HE}`} className="text-brand-600 hover:underline">
            {LIEN_HE}
          </a>
        </p>
        <p className="mt-3">
          Xem thêm{' '}
          <Link to="/dieu-khoan" className="text-brand-600 hover:underline">
            Điều khoản sử dụng
          </Link>
          .
        </p>
      </Muc>
    </VanBan>
  )
}
