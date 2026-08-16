import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { AdminLayout } from '@/components/layout/AdminLayout'
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
import { Availability } from '@/pages/Availability'
import { PostJob } from '@/pages/PostJob'
import { Applicants } from '@/pages/Applicants'
import { NotFound } from '@/pages/NotFound'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/viec-lam" element={<JobList />} />
          <Route path="/viec-lam/:id" element={<JobDetail />} />
          <Route path="/lich-ranh" element={<Availability />} />
          <Route path="/dang-nhap" element={<Login />} />
          <Route path="/dang-ky" element={<Register />} />
          <Route path="/ntd/dang-tin" element={<PostJob />} />
          <Route path="/ntd/ung-vien" element={<Applicants />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Khu quản trị dùng khung riêng: nền tối, sidebar dọc. Đặt ngoài
            <Route element={<Layout />}> nên header/footer của trang công khai
            không dựng ở đây, và ngược lại nền tối không rò sang trang chủ. */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/duyet-tin" element={<ReviewJobs />} />
          <Route path="/admin/duyet-ntd" element={<ReviewEmployers />} />
          <Route path="/admin/ky-nang" element={<AdminSkills />} />
          <Route path="/admin/nguoi-dung" element={<AdminUsers />} />
          <Route path="/ntd/quan-ly" element={<EmployerDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
