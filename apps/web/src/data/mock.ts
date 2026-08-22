/**
 * Du lieu mo phong CON LAI cho luong ung tuyen (Sprint 4).
 *
 * File nay tung chua toan bo du lieu gia cua trang viec lam: JOBS, SKILLS,
 * DISTRICTS, nhan lich, lich lam... Sprint 2 da thay het bang API that va xoa
 * dan tung phan khi tung man hinh duoc noi.
 *
 * Con lai dung mot thu: danh sach ung vien, vi bang Application va toan bo
 * luong ung tuyen thuoc Sprint 4 - chua co gi de noi.
 *
 * DISTRICTS da chuyen sang lib/khu-vuc.ts: no la cau hinh THAT (ghi thang vao
 * cot district cua tin), khong phai du lieu gia, nen khong duoc bien mat cung
 * file nay.
 */

export interface Applicant {
  id: string
  name: string
  university: string
  year: number
  skills: string[]
  matchScore: number
  appliedAt: string
  status: 'PENDING' | 'VIEWED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED'
}

export const APPLICANTS: Applicant[] = [
  {
    id: 'a1',
    name: 'Nguyễn Minh Anh',
    university: 'ĐH Kinh tế TP.HCM',
    year: 2,
    skills: ['Giao tiếp', 'Pha chế cơ bản', 'Chăm sóc khách hàng'],
    matchScore: 96,
    appliedAt: '03/08/2026',
    status: 'SHORTLISTED',
  },
  {
    id: 'a2',
    name: 'Trần Quốc Bảo',
    university: 'ĐH Bách khoa TP.HCM',
    year: 3,
    skills: ['Giao tiếp', 'Làm việc nhóm'],
    matchScore: 84,
    appliedAt: '03/08/2026',
    status: 'VIEWED',
  },
  {
    id: 'a3',
    name: 'Lê Thu Hà',
    university: 'ĐH Sư phạm TP.HCM',
    year: 1,
    skills: ['Giao tiếp', 'Chăm sóc khách hàng'],
    matchScore: 78,
    appliedAt: '02/08/2026',
    status: 'PENDING',
  },
  {
    id: 'a4',
    name: 'Phạm Gia Huy',
    university: 'ĐH Công nghiệp TP.HCM',
    year: 4,
    skills: ['Bán hàng'],
    matchScore: 61,
    appliedAt: '01/08/2026',
    status: 'REJECTED',
  },
]

export const STATUS_LABELS: Record<Applicant['status'], string> = {
  PENDING: 'Chờ xem',
  VIEWED: 'Đã xem',
  SHORTLISTED: 'Vào vòng trong',
  ACCEPTED: 'Đã nhận',
  REJECTED: 'Đã từ chối',
}
