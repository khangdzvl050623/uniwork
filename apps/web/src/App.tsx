import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { RequireAuth, RequireRole } from '@/components/RequireAuth'
import { AdminDashboard } from '@/pages/admin/Dashboard'
import { ReviewJobs } from '@/pages/admin/ReviewJobs'
import { ReviewEmployers } from '@/pages/admin/ReviewEmployers'
import { AdminSkills } from '@/pages/admin/Skills'
import { AdminUsers } from '@/pages/admin/Users'
import { EmployerDashboard } from '@/pages/admin/EmployerJobs'
import { Home } from '@/pages/Home'
import { JobList } from '@/pages/JobList'
import { JobDetail } from '@/pages/JobDetail'
import { Login, Register } from '@/pages/Auth'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { PrivacyPolicy } from '@/pages/PrivacyPolicy'
import { Terms } from '@/pages/Terms'
import { GoogleCallback } from '@/pages/GoogleCallback'
import { VerifyEmail } from '@/pages/VerifyEmail'
import { Profile } from '@/pages/Profile'
import { EmployerProfile } from '@/pages/EmployerProfile'
import { Availability } from '@/pages/Availability'
import { SavedJobs } from '@/pages/SavedJobs'
import { MyApplications } from '@/pages/MyApplications'
import { PostJob } from '@/pages/PostJob'
import { Applicants } from '@/pages/Applicants'
import { NotFound } from '@/pages/NotFound'

/**
 * Bản đồ route, chia theo mức quyền cần có (T48).
 *
 * Nhắc lại điều quan trọng nhất: `<RequireAuth>` và `<RequireRole>` KHÔNG phải
 * lớp bảo mật — mọi thứ chạy trong trình duyệt đều sửa được. Chúng chỉ để người
 * dùng không rơi vào trang lỗi trống. Lớp chặn thật nằm ở middleware phía api.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Công khai */}
          <Route path="/" element={<Home />} />
          <Route path="/viec-lam" element={<JobList />} />
          {/*
            Hai đường dẫn cùng dẫn tới một trang, và `params.id` đúng ở cả hai.

            Dạng có slug (`/viec-lam/phuc-vu-quan-ca-phe/demo-job-cafe-toi`) là
            thứ mọi thẻ tin sinh ra — xem `duongDanTin`. Dạng id trần giữ lại
            cho link đã chia sẻ trước khi có slug, và cho lúc gõ tay khi thử.

            Đặt slug thành một đoạn RIÊNG thay vì nối `slug-id` là có lý do:
            nối vào thì phải cắt chuỗi để lấy id lại, mà id trong bảng không
            phải lúc nào cũng là cuid — dữ liệu seed dùng id viết tay có chứa
            dấu gạch. Tách bằng `/` thì không còn phép cắt nào để mà sai.
          */}
          <Route path="/viec-lam/:id" element={<JobDetail />} />
          <Route path="/viec-lam/:slug/:id" element={<JobDetail />} />
          <Route path="/dang-nhap" element={<Login />} />
          <Route path="/dang-ky" element={<Register />} />
          <Route path="/quen-mat-khau" element={<ForgotPassword />} />

          {/* Hai trang này phải công khai và KHÔNG cần đăng nhập: Google đọc
              trang chính sách khi xét ứng dụng OAuth, và người chưa có tài
              khoản cũng cần đọc được trước khi quyết định đăng ký. */}
          <Route path="/chinh-sach-bao-mat" element={<PrivacyPolicy />} />
          <Route path="/dieu-khoan" element={<Terms />} />
          {/* Nơi api chuyển hướng về sau khi Google xác nhận xong. */}
          <Route path="/dang-nhap-google-xong" element={<GoogleCallback />} />

          {/* Tự canh cửa bên trong: chưa đăng nhập thì về /dang-nhap, đã xác
              thực rồi thì về trang chủ. Ba nhánh nên không bọc RequireAuth. */}
          <Route path="/xac-thuc-email" element={<VerifyEmail />} />

          {/* Cần đăng nhập */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole roles={['STUDENT']} />}>
              <Route path="/ho-so" element={<Profile />} />
              <Route path="/lich-ranh" element={<Availability />} />
              <Route path="/tin-da-luu" element={<SavedJobs />} />
              <Route path="/don-ung-tuyen" element={<MyApplications />} />
            </Route>

            <Route element={<RequireRole roles={['EMPLOYER']} />}>
              <Route path="/ntd/ho-so" element={<EmployerProfile />} />
              <Route path="/ntd/dang-tin" element={<PostJob />} />
              <Route path="/ntd/ung-vien" element={<Applicants />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Khu quản trị dùng khung riêng: nền tối, sidebar dọc. Đặt ngoài
            <Route element={<Layout />}> nên header/footer của trang công khai
            không dựng ở đây, và ngược lại nền tối không rò sang trang chủ. */}
        <Route element={<AdminLayout />}>
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/duyet-tin" element={<ReviewJobs />} />
              <Route path="/admin/duyet-ntd" element={<ReviewEmployers />} />
              <Route path="/admin/ky-nang" element={<AdminSkills />} />
              <Route path="/admin/nguoi-dung" element={<AdminUsers />} />
            </Route>

            <Route element={<RequireRole roles={['EMPLOYER']} />}>
              <Route path="/ntd/quan-ly" element={<EmployerDashboard />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
