import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  EmptyRow,
  PageHeader,
  RowAction,
  TableShell,
  Td,
  Th,
  Toolbar,
} from '@/components/admin/Table'
import { ADMIN_SKILLS, type AdminSkill } from '@/data/adminMock'

/**
 * Danh mục kỹ năng.
 *
 * Hai điểm nghiệp vụ được thể hiện ngay ở giao diện:
 *
 * - Kỹ năng đang có tin dùng thì KHÔNG xoá được. Xoá đi thì các tin đó mất bộ
 *   lọc và điểm phù hợp tính sai, nên nút xoá tự khoá kèm lời giải thích thay vì
 *   để bấm rồi báo lỗi.
 * - `slug` sinh tự động từ tên, không cho gõ tay. Slug là thứ nằm trong URL lọc
 *   (/viec-lam?skill=pha-che); để người nhập tự đặt thì sớm muộn cũng có hai kỹ
 *   năng trùng slug và bộ lọc trả về lẫn lộn.
 */

/** Bỏ dấu tiếng Việt rồi chuyển thành chuỗi dùng được trong URL. */
function toSlug(name: string) {
  return (
    name
      .normalize('NFD')
      // Cắt các dấu thanh và dấu phụ (khối U+0300–U+036F sau khi tách tổ hợp).
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

export function AdminSkills() {
  const [skills, setSkills] = useState<AdminSkill[]>(ADMIN_SKILLS)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')

  const rows = useMemo(
    () =>
      skills.filter((s) =>
        `${s.name} ${s.group} ${s.slug}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [skills, query],
  )

  const slugPreview = toSlug(draft)
  const duplicate = slugPreview !== '' && skills.some((s) => s.slug === slugPreview)

  function add() {
    if (!slugPreview || duplicate) return
    setSkills((list) => [
      {
        id: `new-${slugPreview}`,
        name: draft.trim(),
        slug: slugPreview,
        jobCount: 0,
        group: 'Chưa phân nhóm',
      },
      ...list,
    ])
    setDraft('')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Danh mục kỹ năng" subtitle={`${skills.length} kỹ năng đang dùng`} />

      {/* Ô thêm mới. Đặt ngoài bảng chứ không phải một hộp thoại: thêm kỹ năng là
          việc làm liên tục vài lần một lượt, mở rồi đóng hộp thoại mỗi lần chỉ
          tổ tốn thao tác. */}
      <div className="dash-card dash-in p-4" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="text-dash-muted mb-1.5 block text-xs font-medium">
              Tên kỹ năng mới
            </span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Ví dụ: Chụp ảnh sản phẩm"
              className="border-dash-line bg-dash-raised focus:border-dash-accent/60 placeholder:text-dash-muted h-10 w-full rounded-lg border px-3 text-sm transition-colors duration-150 outline-none"
            />
          </label>

          <div className="min-w-0 flex-1">
            <span className="text-dash-muted mb-1.5 block text-xs font-medium">
              Slug (sinh tự động)
            </span>
            <div className="border-dash-line bg-dash-bg text-dash-muted flex h-10 items-center rounded-lg border px-3 font-mono text-sm">
              {slugPreview || <span className="opacity-50">—</span>}
            </div>
          </div>

          <button
            onClick={add}
            disabled={!slugPreview || duplicate}
            className="bg-dash-accent text-dash-accent-ink inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} />
            Thêm
          </button>
        </div>

        {duplicate && (
          <p className="text-dash-bad mt-2.5 text-xs">
            Slug <span className="font-mono">{slugPreview}</span> đã tồn tại. Đổi tên khác để bộ lọc
            không trả về lẫn lộn.
          </p>
        )}
      </div>

      <TableShell>
        <Toolbar placeholder="Tìm kỹ năng…" value={query} onChange={setQuery} />

        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr>
              <Th>Kỹ năng</Th>
              <Th>Nhóm</Th>
              <Th>Slug</Th>
              <Th>Tin đang dùng</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>Không tìm thấy kỹ năng nào.</EmptyRow>}

            {rows.map((skill, i) => (
              <tr
                key={skill.id}
                className="dash-row dash-in"
                style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
              >
                <Td className="font-medium">{skill.name}</Td>
                <Td className="text-dash-muted">{skill.group}</Td>
                <Td className="text-dash-muted font-mono text-xs">{skill.slug}</Td>
                <Td className="tabular-nums">{skill.jobCount}</Td>
                <Td className="text-right">
                  {skill.jobCount > 0 ? (
                    <span
                      title={`Đang có ${skill.jobCount} tin dùng kỹ năng này`}
                      className="text-dash-muted cursor-not-allowed px-2.5 py-1.5 text-xs whitespace-nowrap opacity-60"
                    >
                      Đang được dùng
                    </span>
                  ) : (
                    <RowAction
                      tone="bad"
                      onClick={() => setSkills((list) => list.filter((s) => s.id !== skill.id))}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Trash2 size={12} />
                        Xoá
                      </span>
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
