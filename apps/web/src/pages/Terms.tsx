import { Link } from 'react-router-dom'
import { FileText, Mail } from 'lucide-react'
import { Muc, VanBan } from '@/components/layout/VanBanPhapLy'
import { LIEN_HE, NGAY_CAP_NHAT } from '@/lib/thong-tin-phap-ly'

/**
 * Điều khoản sử dụng.
 *
 * Google không bắt buộc trang này để publish ứng dụng OAuth (chỉ chính sách
 * bảo mật là bắt buộc), nhưng form đăng ký đang bắt người dùng tích vào ô
 * "Tôi đồng ý với điều khoản sử dụng" — bắt đồng ý với một văn bản không tồn
 * tại thì ô tích đó chẳng có nghĩa gì.
 */
export function Terms() {
  return (
    <VanBan
      icon={FileText}
      title="Điều khoản sử dụng"
      subtitle={`Cập nhật lần cuối: ${NGAY_CAP_NHAT}`}
    >
      <p>
        Khi tạo tài khoản trên UniWork, bạn đồng ý với những điều dưới đây. Nếu không đồng ý, vui
        lòng không sử dụng dịch vụ.
      </p>

      <Muc title="1. UniWork là gì">
        <p>
          UniWork là nền tảng kết nối sinh viên với công việc bán thời gian phù hợp lịch học.
          Chúng tôi là <strong>bên trung gian</strong>: chúng tôi không phải người sử dụng lao
          động, không tham gia vào hợp đồng lao động giữa bạn và nhà tuyển dụng, và không trả
          lương.
        </p>
      </Muc>

      <Muc title="2. Tài khoản của bạn">
        <ul>
          <li>Bạn chịu trách nhiệm giữ mật khẩu và mọi hoạt động diễn ra trong tài khoản mình.</li>
          <li>
            Thông tin khai trong hồ sơ phải <strong>trung thực</strong>. Khai khống trường lớp,
            kỹ năng hay giấy tờ doanh nghiệp là lý do để khoá tài khoản.
          </li>
          <li>Mỗi người chỉ tạo một tài khoản cho mỗi vai trò.</li>
        </ul>
      </Muc>

      <Muc title="3. Dành cho sinh viên">
        <ul>
          <li>Chỉ tải lên CV của chính bạn.</li>
          <li>
            Lịch rảnh bạn khai được dùng để lọc việc phù hợp. Khai sai thì hệ thống gợi ý sai —
            thiệt cho chính bạn.
          </li>
          <li>
            Ứng tuyển xong thì giữ lời hẹn phỏng vấn. Nhà tuyển dụng đánh giá dựa trên điều đó.
          </li>
        </ul>
      </Muc>

      <Muc title="4. Dành cho nhà tuyển dụng">
        <ul>
          <li>
            Tin tuyển dụng phải mô tả đúng công việc, mức lương và thời gian làm. Không đăng tin
            mồi để thu hút hồ sơ.
          </li>
          <li>
            Giấy tờ xác minh phải là giấy tờ thật của doanh nghiệp bạn. Tin chỉ hiển thị công
            khai sau khi được duyệt.
          </li>
          <li>
            Hồ sơ và CV ứng viên chỉ dùng cho mục đích tuyển dụng của chính bạn — không chuyển
            cho bên thứ ba, không dùng để gửi quảng cáo.
          </li>
          <li>
            <strong>Nghiêm cấm</strong> yêu cầu sinh viên đặt cọc, nộp phí, hay giao giấy tờ gốc
            dưới bất kỳ hình thức nào.
          </li>
        </ul>
      </Muc>

      <Muc title="5. Những việc không được làm">
        <ul>
          <li>Đăng nội dung lừa đảo, phân biệt đối xử, hoặc vi phạm pháp luật Việt Nam.</li>
          <li>Dùng công cụ tự động để thu thập dữ liệu người dùng khác.</li>
          <li>Tìm cách truy cập tài khoản hoặc dữ liệu không thuộc về mình.</li>
          <li>Tải lên tệp chứa mã độc.</li>
        </ul>
      </Muc>

      <Muc title="6. Chúng tôi không bảo đảm điều gì">
        <p>
          UniWork cung cấp dịch vụ <em>“nguyên trạng”</em>. Chúng tôi không bảo đảm bạn sẽ tìm
          được việc, không bảo đảm nhà tuyển dụng sẽ trả lương đúng hẹn, và không chịu trách
          nhiệm về tranh chấp phát sinh giữa hai bên.
        </p>
        <p>
          Hãy tự kiểm chứng trước khi nhận việc: gặp trực tiếp tại địa chỉ công ty, đọc kỹ thoả
          thuận, và <strong>không bao giờ chuyển tiền đặt cọc</strong>. Gặp trường hợp khả nghi,
          báo cho chúng tôi qua email bên dưới.
        </p>
      </Muc>

      <Muc title="7. Ngừng dịch vụ">
        <p>
          Chúng tôi có thể khoá tài khoản vi phạm những điều trên. Bạn có thể yêu cầu xoá tài
          khoản bất cứ lúc nào — xem mục Quyền của bạn trong{' '}
          <Link to="/chinh-sach-bao-mat" className="text-brand-600 hover:underline">
            Chính sách bảo mật
          </Link>
          .
        </p>
      </Muc>

      <Muc title="8. Đây là đồ án học tập">
        <p>
          UniWork là đồ án môn học của sinh viên, không phải một doanh nghiệp đã đăng ký. Dịch vụ
          có thể tạm ngừng hoặc thay đổi mà không báo trước.
        </p>
      </Muc>

      <Muc title="9. Liên hệ">
        <p className="flex items-center gap-2">
          <Mail size={16} className="shrink-0 text-slate-400" />
          <a href={`mailto:${LIEN_HE}`} className="text-brand-600 hover:underline">
            {LIEN_HE}
          </a>
        </p>
      </Muc>
    </VanBan>
  )
}
