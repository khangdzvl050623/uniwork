import { useMemo, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import type { SkillResponse } from '@uniwork/shared'
import { Button } from '@/components/ui/Button'
import { useSkills, useUpdateSkills } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'

/** Trên mức này thì hồ sơ loãng, nhà tuyển dụng không biết đâu là thế mạnh thật. */
const NEN_CHON_TOI_DA = 10

/**
 * Chọn kỹ năng từ danh mục do admin quản lý (T60).
 *
 * Danh mục đóng chứ không cho nhập tự do là quyết định từ schema: nhập tự do
 * sinh ra "Giao tiếp", "giao tiếp", "Kỹ năng giao tiếp" thành ba thẻ khác nhau
 * và bộ lọc việc làm hỏng theo.
 */
export function SkillPicker({ daChon }: { daChon: SkillResponse[] }) {
  const { data: danhMuc, isLoading } = useSkills()
  const luu = useUpdateSkills()

  const [chon, setChon] = useState<string[]>(() => daChon.map((s) => s.id))
  const [tuKhoa, setTuKhoa] = useState('')

  /*
   * So sánh theo TẬP HỢP, không theo thứ tự mảng.
   *
   * Bỏ chọn một kỹ năng rồi chọn lại nó thì mảng đổi thứ tự nhưng nội dung y
   * hệt lúc đầu — so sánh mảng thẳng sẽ báo "có thay đổi" và bật nút Lưu cho
   * một thay đổi không tồn tại.
   */
  const coThayDoi = useMemo(() => {
    const banDau = new Set(daChon.map((s) => s.id))
    return chon.length !== banDau.size || chon.some((id) => !banDau.has(id))
  }, [chon, daChon])

  const ketQuaLoc = useMemo(() => {
    if (!danhMuc) return []
    const q = tuKhoa.trim().toLowerCase()
    if (!q) return danhMuc
    // Tìm cả theo `slug` (dạng không dấu) để gõ "pha che" không dấu vẫn ra
    // "Pha chế" — người dùng hiếm khi bật bộ gõ tiếng Việt chỉ để tìm kiếm.
    return danhMuc.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.includes(q.replace(/\s+/g, '-')),
    )
  }, [danhMuc, tuKhoa])

  function batTat(id: string) {
    setChon((truoc) =>
      truoc.includes(id) ? truoc.filter((x) => x !== id) : [...truoc, id],
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={20} className="animate-spin text-slate-300" />
      </div>
    )
  }

  const quaNhieu = chon.length > NEN_CHON_TOI_DA

  return (
    <div>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          placeholder="Tìm kỹ năng…"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ketQuaLoc.map((skill) => {
          const dangChon = chon.includes(skill.id)

          return (
            <button
              key={skill.id}
              type="button"
              onClick={() => batTat(skill.id)}
              aria-pressed={dangChon}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                'transition-[background-color,border-color,color,transform] duration-150 ease-out',
                'active:scale-[0.97]',
                dangChon
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              {dangChon && <Check size={13} />}
              {skill.name}
            </button>
          )
        })}

        {ketQuaLoc.length === 0 && (
          <p className="py-2 text-sm text-slate-400">Không có kỹ năng nào khớp “{tuKhoa}”.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-xs', quaNhieu ? 'text-amber-600' : 'text-slate-400')}>
          Đã chọn <span className="font-medium tabular-nums">{chon.length}</span> kỹ năng
          {quaNhieu && ` — nên giữ dưới ${NEN_CHON_TOI_DA} để nổi bật thế mạnh`}
        </p>

        <div className="flex items-center gap-2">
          {coThayDoi && (
            <button
              type="button"
              onClick={() => setChon(daChon.map((s) => s.id))}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <X size={13} />
              Hoàn tác
            </button>
          )}

          <Button
            type="button"
            size="sm"
            // Không có gì đổi thì không cho bấm — tránh gửi một request ghi đè
            // đúng bằng dữ liệu đang có.
            disabled={!coThayDoi || luu.isPending}
            onClick={() => luu.mutate(chon)}
          >
            {luu.isPending && <Loader2 size={14} className="animate-spin" />}
            {luu.isPending ? 'Đang lưu…' : 'Lưu kỹ năng'}
          </Button>
        </div>
      </div>

      {luu.isError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          Không lưu được kỹ năng. Thử lại sau.
        </p>
      )}
    </div>
  )
}
