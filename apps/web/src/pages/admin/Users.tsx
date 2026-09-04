import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AdminUserResponse } from '@uniwork/shared'
import { StatusBadge } from '@/components/admin/Charts'
import {
  Avatar,
  EmptyRow,
  FilterChips,
  PageHeader,
  RowAction,
  TableShell,
  Td,
  Th,
  Toolbar,
} from '@/components/admin/Table'
import { useAdminUsers, useUpdateUserStatus } from '@/hooks/useAdminUsers'
import { cn } from '@/lib/utils'

type Filter = 'ALL' | AdminUserResponse['role']

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'STUDENT', label: 'Sinh viên' },
  { value: 'EMPLOYER', label: 'Nhà tuyển dụng' },
  { value: 'ADMIN', label: 'Quản trị' },
]

const ROLE_LABELS: Record<AdminUserResponse['role'], string> = {
  STUDENT: 'Sinh viên',
  EMPLOYER: 'Nhà tuyển dụng',
  ADMIN: 'Quản trị',
}

/** Mỗi vai một màu, đọc lướt là phân biệt được ngay hàng nào là ai. */
const ROLE_COLORS: Record<AdminUserResponse['role'], string> = {
  STUDENT: 'text-dash-blue bg-dash-blue/12',
  EMPLOYER: 'text-dash-violet bg-dash-violet/12',
  ADMIN: 'text-dash-orange bg-dash-orange/12',
}

export function AdminUsers() {
  const { data, isLoading } = useAdminUsers()
  const doiTrangThai = useUpdateUserStatus()

  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  /*
   * Nhớ đúng MỘT hàng đang xử lý dở, không phải một cờ chung cho cả bảng.
   *
   * Một cờ `isPending` chung sẽ khoá nút của MỌI hàng trong lúc chỉ một hàng
   * đang gọi API — người dùng bấm hàng khác, thấy nút không phản hồi, tưởng
   * trang bị treo.
   */
  const [dangXuLy, setDangXuLy] = useState<string | null>(null)

  const users = useMemo(() => data?.users ?? [], [data])

  const counts = useMemo(
    () => ({
      ALL: users.length,
      STUDENT: users.filter((u) => u.role === 'STUDENT').length,
      EMPLOYER: users.filter((u) => u.role === 'EMPLOYER').length,
      ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    }),
    [users],
  )

  const rows = users.filter((u) => {
    if (filter !== 'ALL' && u.role !== filter) return false
    if (!query) return true
    return `${u.displayName} ${u.email} ${u.school ?? ''}`.toLowerCase().includes(query.toLowerCase())
  })

  function doiKhoa(user: AdminUserResponse) {
    setDangXuLy(user.id)
    doiTrangThai.mutate(
      { id: user.id, status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      { onSettled: () => setDangXuLy(null) },
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={26} className="text-dash-muted animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Người dùng"
        subtitle={`${counts.STUDENT} sinh viên · ${counts.EMPLOYER} nhà tuyển dụng`}
      />

      <TableShell>
        <Toolbar placeholder="Tìm theo tên, email, trường…" value={query} onChange={setQuery}>
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
        </Toolbar>

        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr>
              <Th>Người dùng</Th>
              <Th>Vai trò</Th>
              <Th>Trường</Th>
              <Th>Đơn đã nộp</Th>
              <Th>Tham gia</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={7}>Không tìm thấy người dùng nào.</EmptyRow>}

            {rows.map((user, i) => {
              const active = user.status === 'ACTIVE'

              return (
                <tr
                  key={user.id}
                  className="dash-row dash-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.displayName} />
                      <div className="min-w-0">
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-dash-muted mt-0.5 truncate text-xs">{user.email}</p>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                        ROLE_COLORS[user.role],
                      )}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </Td>

                  <Td className="text-dash-muted">{user.school ?? '—'}</Td>
                  <Td className="tabular-nums">{user.applicationCount || '—'}</Td>
                  <Td className="text-dash-muted whitespace-nowrap tabular-nums">
                    {new Date(user.joinedAt).toLocaleDateString('vi-VN')}
                  </Td>
                  <Td>
                    <StatusBadge tone={active ? 'ok' : 'bad'}>
                      {active ? 'Đang hoạt động' : 'Đã khoá'}
                    </StatusBadge>
                  </Td>

                  <Td className="text-right">
                    {user.role === 'ADMIN' ? (
                      <span
                        title="Không thể tự khoá tài khoản quản trị từ màn hình này"
                        className="text-dash-muted cursor-not-allowed px-2.5 py-1.5 text-xs whitespace-nowrap opacity-60"
                      >
                        —
                      </span>
                    ) : (
                      <RowAction
                        tone={active ? 'bad' : 'ok'}
                        onClick={() => doiKhoa(user)}
                        disabled={dangXuLy === user.id}
                      >
                        {dangXuLy === user.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : active ? (
                          'Khoá'
                        ) : (
                          'Mở khoá'
                        )}
                      </RowAction>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}
