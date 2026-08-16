import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Dải khẩu hiệu giữa trang.
 *
 * Câu chính giữ nguyên, chỉ một cụm từ thay phiên đổi. Cách này nói được nhiều
 * ý mà mắt chỉ phải đọc một câu — hơn hẳn xếp bốn câu cạnh nhau rồi trông chờ
 * người ta đọc hết.
 */

/** Cụm từ thay phiên. Thêm bớt thoải mái, độ dài do CSS lo. */
const SWAPPED = ['bỏ tiết', 'thức trắng đêm', 'hạ điểm', 'mất cuối tuần', 'bỏ bạn bè']

/** Mỗi cụm hiện bao lâu. Khớp với thời lượng keyframe slogan-swap ở index.css. */
const SWAP_MS = 2600

const SLOGANS = [
  {
    title: 'Ca làm xoay quanh lịch học',
    body: 'Không phải ngược lại. Khai lịch một lần, phần còn lại hệ thống lo.',
  },
  {
    title: 'Chưa kinh nghiệm vẫn có việc',
    body: 'Ai cũng phải bắt đầu từ đâu đó. Ở đây chỗ bắt đầu không bị giấu đi.',
  },
  {
    title: 'Việc thật, công ty thật',
    body: 'Giấy tờ doanh nghiệp đã qua kiểm duyệt trước khi tin được đăng.',
  },
  {
    title: 'Nộp xong biết ngay tới đâu',
    body: 'Theo dõi từng đơn theo trạng thái, không rơi vào im lặng.',
  },
]

export function SloganBand() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SWAPPED.length), SWAP_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="bg-brand-deep relative overflow-hidden px-4 py-16">
      <div className="pattern-hex absolute inset-0 opacity-60" />

      <div className="relative mx-auto max-w-[1180px]">
        <span className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100 ring-1 ring-white/20">
          <Sparkles size={12} /> Vì sao sinh viên chọn UniWork
        </span>

        <h2 className="mt-5 text-center text-2xl leading-tight font-black text-white sm:text-4xl">
          Đi làm thêm mà không phải
          <br />
          {/* Khối bọc phải overflow-hidden và cao cố định: chữ mới trồi lên từ
              bên dưới mép khối, và chiều cao đứng yên nên dòng chữ phía dưới
              không bị đẩy lên đẩy xuống mỗi lần đổi cụm. */}
          <span className="relative mt-1 inline-flex h-[1.25em] items-center justify-center overflow-hidden align-bottom">
            {/* key đổi theo index nên React dựng lại thẻ, animation chạy lại từ
                đầu. Không có key thì React chỉ thay chữ tại chỗ, chữ đổi mà
                không kèm chuyển động nào. */}
            <span key={index} className="slogan-word text-gradient-fresh px-1">
              {SWAPPED[index]}
            </span>
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-relaxed text-brand-50/75 sm:text-base">
          UniWork sinh ra từ một câu hỏi rất cụ thể: tại sao tìm việc bán thời gian lại khó đúng ở
          chỗ mà lẽ ra phải dễ nhất — khớp được giờ rảnh.
        </p>

        <div className="mt-11 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SLOGANS.map((s) => (
            <div
              key={s.title}
              className="card-lift rounded-2xl bg-white/8 p-5 ring-1 ring-white/15 hover:ring-brand-300/40"
            >
              <h3 className="text-base font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-50/70">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to="/dang-ky">
            <Button variant="gradient" size="lg">
              Tạo hồ sơ miễn phí
              <ArrowRight size={16} />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-brand-50/55">
            Không phí ẩn, không gói nâng cấp. Miễn phí là miễn phí.
          </p>
        </div>
      </div>
    </section>
  )
}
