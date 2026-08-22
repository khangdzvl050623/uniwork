import { useMemo, useState } from 'react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { taoSlug, type AdminSkillResponse } from '@uniwork/shared'
import {
  EmptyRow,
  PageHeader,
  RowAction,
  TableShell,
  Td,
  Th,
  Toolbar,
} from '@/components/admin/Table'
import {
  useAdminSkills,
  useCreateSkill,
  useDeleteSkill,
  useUpdateSkill,
} from '@/hooks/useAdminSkills'
import { ApiClientError } from '@/lib/api'

/**
 * Danh mục kỹ năng.
 *
 * Ba điểm nghiệp vụ được thể hiện ngay ở giao diện:
 *
 * - Kỹ năng đang có tin HOẶC có sinh viên khai thì KHÔNG xoá được. Cả
 *   `JobSkill` lẫn `StudentSkill` đều tham chiếu với `onDelete: Restrict`, nên
 *   chỉ cần một bên còn dùng là chặn. Hiện đủ cả hai con số, vì thấy "0 tin" mà
 *   bấm xoá vẫn lỗi thì không ai hiểu vì sao.
 * - `slug` sinh tự động từ tên, không cho gõ tay. Slug nằm trong URL lọc
 *   (/viec-lam?skill=pha-che); để người nhập tự đặt thì sớm muộn cũng có hai kỹ
 *   năng trùng slug và bộ lọc trả về lẫn lộn.
 * - **Đổi tên KHÔNG đổi slug.** Cột slug hiện mờ và không sửa được, đúng với
 *   hành vi của API: tin tuyển dụng tham chiếu kỹ năng bằng slug, đổi nó là làm
 *   chết mọi link lọc đã phát ra ngoài.
 *
 * Hàm `taoSlug` lấy từ `@uniwork/shared` — CÙNG một hàm server dùng để ghi
 * xuống database. Giữ bản sao riêng ở đây thì ô xem trước sẽ có ngày nói dối.
 */
export function AdminSkills() {
  const { data, isLoading } = useAdminSkills()
  const themMoi = useCreateSkill()
  const doiTen = useUpdateSkill()
  const xoa = useDeleteSkill()

  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')

  /** id kỹ năng đang sửa tên tại chỗ, kèm giá trị đang gõ. */
  const [dangSua, setDangSua] = useState<{ id: string; ten: string } | null>(null)
  const [dangXoa, setDangXoa] = useState<string | null>(null)

  const skills = useMemo(() => data?.skills ?? [], [data])

  const rows = useMemo(
    () => skills.filter((s) => `${s.name} ${s.slug}`.toLowerCase().includes(query.toLowerCase())),
    [skills, query],
  )

  const slugXemTruoc = taoSlug(draft)
  const trungSlug = slugXemTruoc !== '' && skills.some((s) => s.slug === slugXemTruoc)

  /*
   * Lỗi từ server hiện nguyên văn.
   *
   * Server đã soạn sẵn câu tiếng Việt nói rõ vướng ở đâu ("đang có 3 tin tuyển
   * dụng và 20 hồ sơ sinh viên dùng kỹ năng này"). Viết lại một câu chung chung
   * kiểu "Thao tác thất bại" ở đây là vứt đi đúng phần thông tin hữu ích nhất.
   */
  const loi = [themMoi.error, doiTen.error, xoa.error].find(Boolean)
  const thongBaoLoi = loi instanceof ApiClientError ? loi.message : null

  function them() {
    if (!slugXemTruoc || trungSlug || themMoi.isPending) return
    themMoi.mutate(draft.trim(), { onSuccess: () => setDraft('') })
  }

  function luuTen() {
    if (!dangSua) return
    const ten = dangSua.ten.trim()
    const cu = skills.find((s) => s.id === dangSua.id)

    // Không gọi API khi tên không đổi — một request không làm gì cả vẫn tốn một
    // vòng đánh thức server trên gói free của Render.
    if (!ten || ten === cu?.name) {
      setDangSua(null)
      return
    }

    doiTen.mutate({ id: dangSua.id, name: ten }, { onSuccess: () => setDangSua(null) })
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
              onKeyDown={(e) => e.key === 'Enter' && them()}
              placeholder="Ví dụ: Chụp ảnh sản phẩm"
              disabled={themMoi.isPending}
              className="border-dash-line bg-dash-raised focus:border-dash-accent/60 placeholder:text-dash-muted h-10 w-full rounded-lg border px-3 text-sm transition-colors duration-150 outline-none disabled:opacity-50"
            />
          </label>

          <div className="min-w-0 flex-1">
            <span className="text-dash-muted mb-1.5 block text-xs font-medium">
              Slug (sinh tự động)
            </span>
            <div className="border-dash-line bg-dash-bg text-dash-muted flex h-10 items-center rounded-lg border px-3 font-mono text-sm">
              {slugXemTruoc || <span className="opacity-50">—</span>}
            </div>
          </div>

          <button
            onClick={them}
            disabled={!slugXemTruoc || trungSlug || themMoi.isPending}
            className="bg-dash-accent text-dash-accent-ink inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {themMoi.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Thêm
          </button>
        </div>

        {trungSlug && (
          <p className="text-dash-bad mt-2.5 text-xs">
            Slug <span className="font-mono">{slugXemTruoc}</span> đã tồn tại. Đổi tên khác để bộ lọc
            không trả về lẫn lộn.
          </p>
        )}

        {thongBaoLoi && <p className="text-dash-bad mt-2.5 text-xs">{thongBaoLoi}</p>}
      </div>

      <TableShell>
        <Toolbar placeholder="Tìm kỹ năng…" value={query} onChange={setQuery} />

        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              <Th>Kỹ năng</Th>
              <Th>Slug</Th>
              <Th>Tin đang dùng</Th>
              <Th>Sinh viên khai</Th>
              <Th className="text-right">Hành động</Th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>Không tìm thấy kỹ năng nào.</EmptyRow>}

            {rows.map((skill, i) => (
              <HangKyNang
                key={skill.id}
                skill={skill}
                thuTu={i}
                dangSua={dangSua?.id === skill.id ? dangSua.ten : null}
                dangLuu={doiTen.isPending && dangSua?.id === skill.id}
                dangXoa={dangXoa === skill.id && xoa.isPending}
                onBatDauSua={() => setDangSua({ id: skill.id, ten: skill.name })}
                onDoiTen={(ten) => setDangSua({ id: skill.id, ten })}
                onLuu={luuTen}
                onHuy={() => setDangSua(null)}
                onXoa={() => {
                  setDangXoa(skill.id)
                  xoa.mutate(skill.id, { onSettled: () => setDangXoa(null) })
                }}
              />
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}

/**
 * Một hàng trong bảng, tách riêng vì nó có hai hình dạng: đọc và sửa tại chỗ.
 *
 * Sửa tại chỗ thay vì mở hộp thoại — đổi tên kỹ năng là thao tác một ô, mở cả
 * một hộp thoại cho nó thì số thao tác nhiều hơn phần việc thật.
 */
function HangKyNang({
  skill,
  thuTu,
  dangSua,
  dangLuu,
  dangXoa,
  onBatDauSua,
  onDoiTen,
  onLuu,
  onHuy,
  onXoa,
}: {
  skill: AdminSkillResponse
  thuTu: number
  /** Giá trị đang gõ, hoặc null nếu hàng này không ở chế độ sửa. */
  dangSua: string | null
  dangLuu: boolean
  dangXoa: boolean
  onBatDauSua: () => void
  onDoiTen: (ten: string) => void
  onLuu: () => void
  onHuy: () => void
  onXoa: () => void
}) {
  const dangDuocDung = skill.jobCount > 0 || skill.studentCount > 0

  return (
    <tr className="dash-row dash-in" style={{ animationDelay: `${Math.min(thuTu, 12) * 26}ms` }}>
      <Td className="font-medium">
        {dangSua === null ? (
          skill.name
        ) : (
          <input
            autoFocus
            value={dangSua}
            onChange={(e) => onDoiTen(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onLuu()
              // Esc huỷ: người dùng bấm nhầm vào ô sửa phải có đường lui mà
              // không phải nhớ lại tên cũ để gõ về như ban đầu.
              if (e.key === 'Escape') onHuy()
            }}
            disabled={dangLuu}
            className="border-dash-accent/60 bg-dash-raised h-8 w-full min-w-0 rounded-md border px-2 text-sm outline-none disabled:opacity-50"
          />
        )}
      </Td>

      {/* Slug hiện mờ và không sửa được — nó là khoá tra cứu ổn định, đổi tên
          không đụng tới nó. */}
      <Td className="text-dash-muted font-mono text-xs">{skill.slug}</Td>

      <Td className="tabular-nums">{skill.jobCount || '—'}</Td>
      <Td className="tabular-nums">{skill.studentCount || '—'}</Td>

      <Td className="text-right">
        <div className="flex justify-end gap-1">
          {dangSua === null ? (
            <>
              <RowAction onClick={onBatDauSua}>
                <span className="inline-flex items-center gap-1">
                  <Pencil size={12} />
                  Đổi tên
                </span>
              </RowAction>

              {dangDuocDung ? (
                <span
                  title={`Đang có ${skill.jobCount} tin và ${skill.studentCount} hồ sơ dùng kỹ năng này`}
                  className="text-dash-muted cursor-not-allowed px-2.5 py-1.5 text-xs whitespace-nowrap opacity-60"
                >
                  Đang được dùng
                </span>
              ) : (
                <RowAction tone="bad" onClick={onXoa} disabled={dangXoa}>
                  <span className="inline-flex items-center gap-1">
                    {dangXoa ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Xoá
                  </span>
                </RowAction>
              )}
            </>
          ) : (
            <>
              <RowAction tone="ok" onClick={onLuu} disabled={dangLuu}>
                <span className="inline-flex items-center gap-1">
                  {dangLuu ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Lưu
                </span>
              </RowAction>
              <RowAction onClick={onHuy} disabled={dangLuu}>
                <span className="inline-flex items-center gap-1">
                  <X size={12} />
                  Huỷ
                </span>
              </RowAction>
            </>
          )}
        </div>
      </Td>
    </tr>
  )
}
