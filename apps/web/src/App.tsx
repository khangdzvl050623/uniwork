import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
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
      </Routes>
    </BrowserRouter>
  )
}
