import { AlertCircle, CalendarCheck, Clock3, Sparkles } from 'lucide-react'
import type { MatchBreakdown } from '@uniwork/shared'
import { cn } from '@/lib/utils'

interface Props {
  breakdown: MatchBreakdown | null
  /** Bản gọn cho ô hẹp (bảng ứng viên). Mặc định là bản đầy đủ. */
  gon?: boolean
}

/**
 * Chi tiết điểm phù hợp, hiện dưới dạng CHIP TỪNG THÀNH PHẦN.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG HIỆN THẲNG CON SỐ TỔNG HỢP
 * ---------------------------------------------------------------------------
 * "60%" nói gì với người đọc? Không gì cả — họ không biết vì sao 60, cũng không
 * biết làm gì để nó lên. Còn "8/20 ca · 3/5 kỹ năng" thì HÀNH ĐỘNG ĐƯỢC: thiếu
 * kỹ năng nào thì đi học, thiếu ca nào thì cân nhắc lịch.
 *
 * Con số tổng hợp vẫn tồn tại và vẫn quan trọng — nó là KHOÁ SẮP XẾP ở tầng
 * SQL. Nhưng khoá sắp xếp và lời nói với người dùng là hai việc khác nhau.
 *
 * ---------------------------------------------------------------------------
 * ĐỘ PHỦ: IM LẶNG KHI ĐỦ, NÓI KHI THIẾU
 * ---------------------------------------------------------------------------
 * `apDung === doDuoc` thì không hiện gì. Tin "Phát tờ rơi" không yêu cầu kỹ năng
 * và không có cam kết — sinh viên đã khai đủ mọi thứ tin đó cần, nhắc họ khai
 * thêm là nhắc sai người về một thứ chẳng ai hỏi.
 *
 * Chỉ khi `doDuoc < apDung` mới hiện, và câu chữ phải nói rõ điểm này tính trên
 * bao nhiêu tiêu chí — vì hai hồ sơ cùng 100 điểm với độ phủ 1/1 và 1/3 KHÔNG
 * phải cùng một chuyện.
 */
export function ChipPhuHop({ breakdown, gon }: Props) {
  if (!breakdown) return null

  const { shifts, skills, commitment, coverage } = breakdown
  const thieu = coverage.doDuoc < coverage.apDung

  return (
    <div className={cn('flex flex-wrap items-center', gon ? 'gap-1' : 'gap-1.5')}>
      {shifts.score !== null && (
        <Chip
          icon={CalendarCheck}
          tone={shifts.matched >= shifts.required ? 'ok' : 'thieu'}
          gon={gon}
        >
          {shifts.matched}/{shifts.total} ca
        </Chip>
      )}

      {skills.score !== null && (
        <Chip icon={Sparkles} tone="thuong" gon={gon}>
          {skills.matched}/{skills.total} kỹ năng
        </Chip>
      )}

      {commitment.score !== null && commitment.required !== null && (
        <Chip icon={Clock3} tone="thuong" gon={gon}>
          {commitment.months}/{commitment.required} tháng
        </Chip>
      )}

      {thieu && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-slate-400',
            gon ? 'text-[11px]' : 'text-xs',
          )}
          // `title` để bản gọn trong bảng vẫn giải thích được mà không chiếm chỗ.
          title={`Điểm tính trên ${coverage.doDuoc}/${coverage.apDung} tiêu chí — những tiêu chí còn lại chưa có dữ liệu để đo`}
        >
          <AlertCircle size={gon ? 11 : 12} />
          {coverage.doDuoc}/{coverage.apDung} tiêu chí
        </span>
      )}
    </div>
  )
}

const TONE = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  thieu: 'bg-rose-50 text-rose-700 ring-rose-100',
  thuong: 'bg-slate-50 text-slate-600 ring-slate-200',
} as const

function Chip({
  icon: Icon,
  tone,
  gon,
  children,
}: {
  icon: typeof CalendarCheck
  tone: keyof typeof TONE
  gon?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset',
        TONE[tone],
        gon ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
      )}
    >
      <Icon size={gon ? 11 : 13} />
      {children}
    </span>
  )
}
