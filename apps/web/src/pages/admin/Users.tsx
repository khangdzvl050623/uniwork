import { useMemo, useState } from 'react'
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
import { ADMIN_USERS, type AdminUser } from '@/data/adminMock'
import { cn } from '@/lib/utils'

type Filter = 'ALL' | AdminUser['role']

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'STUDENT', label: 'Sinh viên' },
  { value: 'EMPLOYER', label: 'Nhà tuyển dụng' },
  { value: 'ADMIN', label: 'Quản trị' },
]

const ROLE_LABELS: Record<AdminUser['role'], string> = {
  STUDENT: 'Sinh viên',
  EMPLOYER: 'Nhà tuyển dụng',
  ADMIN: 'Quản trị',
}

/** Mỗi vai một màu, đọc lướt là phân biệt được ngay hàng nào là ai. */
const ROLE_COLORS: Record<AdminUser['role'], string> = {
  STUDENT: 'text-dash-blue bg-dash-blue/12',
  EMPLOYER: 'text-dash-violet bg-dash-violet/12',
  ADMIN: 'text-dash-orange bg-dash-orange/12',
}

export function AdminUsers() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [locked, setLocked] = useState<Record<string, boolean>>({})

  const users = useMemo(
    () =>
      ADMIN_USERS.map((u) => ({
        ...u,
        active: locked[u.id] === undefined ? u.active : !locked[u.id],
      })),
    [locked],
  )

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
    return `${u.name} ${u.email} ${u.school}`.toLowerCase().includes(query.toLowerCase())
  })

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

            {rows.map((user, i) => (
              <tr
                key={user.id}
                className="dash-row dash-in"
                style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
              >
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <p className="font-medium">{user.name}</p>
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

                <Td className="text-dash-muted">{user.school}</Td>
                <Td className="tabular-nums">{user.applications || '—'}</Td>
                <Td className="text-dash-muted whitespace-nowrap tabular-nums">{user.joinedAt}</Td>
                <Td>
                  <StatusBadge tone={user.active ? 'ok' : 'bad'}>
                    {user.active ? 'Đang hoạt động' : 'Đã khoá'}
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
                      tone={user.active ? 'bad' : 'ok'}
                      onClick={() => setLocked((l) => ({ ...l, [user.id]: user.active }))}
                    >
                      {user.active ? 'Khoá' : 'Mở khoá'}
                    </RowAction>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}
