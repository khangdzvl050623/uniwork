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
import { VerifyEmail } from '@/pages/VerifyEmail'
import { Profile } from '@/pages/Profile'
import { EmployerProfile } from '@/pages/EmployerProfile'
import { Availability } from '@/pages/Availability'
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
          <Route path="/viec-lam/:id" element={<JobDetail />} />
          <Route path="/dang-nhap" element={<Login />} />
          <Route path="/dang-ky" element={<Register />} />

          {/* Tự canh cửa bên trong: chưa đăng nhập thì về /dang-nhap, đã xác
              thực rồi thì về trang chủ. Ba nhánh nên không bọc RequireAuth. */}
          <Route path="/xac-thuc-email" element={<VerifyEmail />} />

          {/* Cần đăng nhập */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole roles={['STUDENT']} />}>
              <Route path="/ho-so" element={<Profile />} />
              <Route path="/lich-ranh" element={<Availability />} />
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
