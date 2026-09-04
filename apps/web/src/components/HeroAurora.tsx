import { cn } from '@/lib/utils'

/**
 * Nền động của hero: mấy vệt sáng lớn trôi rất chậm, vài khối hình học lơ lửng
 * và một lớp chấm mờ tạo chiều sâu. Không dùng ảnh nên không tốn byte tải về và
 * không có khoảnh khắc trang trống chờ ảnh xuống.
 *
 * Hai lựa chọn ở đây là vì hiệu năng, không phải vì thẩm mỹ:
 *
 * - Vệt sáng là khối `radial-gradient` mềm sẵn, KHÔNG phải khối đặc bọc trong
 *   `filter: blur()`. Blur trên khối cỡ 700px bắt trình duyệt vẽ lại vùng đó mỗi
 *   khung hình; gradient thì vẽ đúng một lần rồi từ đó chỉ còn dịch chuyển.
 * - Mọi keyframe bên dưới chỉ chạm `transform` và `opacity`. Hai thuộc tính này
 *   bỏ qua bước layout lẫn paint nên chạy thẳng trên GPU — thêm chuyển động
 *   không làm chậm phần còn lại của trang.
 *
 * Toàn khối gắn `aria-hidden` và `pointer-events-none`: nó thuần trang trí, đọc
 * màn hình không có gì để đọc và chuột phải bấm xuyên qua được xuống nội dung.
 */

const BLOBS = [
  {
    box: 'left-[-18%] top-[-32%] h-[46rem] w-[46rem]',
    color: 'rgba(20,196,171,0.52)',
    motion: 'blob-drift-a 26s ease-in-out infinite alternate',
  },
  {
    box: 'right-[-14%] top-[4%] h-[40rem] w-[40rem]',
    color: 'rgba(34,211,238,0.42)',
    motion: 'blob-drift-b 31s ease-in-out infinite alternate',
  },
  {
    box: 'left-[10%] bottom-[-42%] h-[42rem] w-[42rem]',
    color: 'rgba(139,92,246,0.52)',
    motion: 'blob-drift-c 24s ease-in-out infinite alternate',
  },
  // Hai vệt cuối là lớp phụ, chỉ bật từ màn hình tablet trở lên. Mỗi vệt là một
  // lớp GPU cỡ vài trăm pixel vuông; trên điện thoại, ba vệt đầu đã đủ màu mà
  // tiết kiệm được kha khá bộ nhớ đồ hoạ.
  {
    box: 'hidden sm:block right-[4%] bottom-[-34%] h-[32rem] w-[32rem]',
    color: 'rgba(244,114,182,0.34)',
    motion: 'blob-drift-b 29s ease-in-out infinite alternate-reverse',
  },
  {
    box: 'hidden sm:block right-[24%] top-[-18%] h-[22rem] w-[22rem]',
    color: 'rgba(251,191,36,0.30)',
    motion: 'blob-drift-a 21s ease-in-out infinite alternate-reverse',
  },
]

/**
 * Hạt sáng nhỏ. Toạ độ ghi cứng chứ không random: random thì mỗi lần React vẽ
 * lại là hạt nhảy sang chỗ khác, còn ghi cứng thì bố cục ổn định và cũng dễ
 * chỉnh tay khi thấy chỗ nào dày quá.
 */
const PARTICLES = [
  { left: '8%', top: '22%', size: 3, delay: 0, duration: 3.4 },
  { left: '17%', top: '62%', size: 2, delay: 1.2, duration: 4.1 },
  { left: '26%', top: '12%', size: 2, delay: 2.1, duration: 3.8 },
  { left: '34%', top: '78%', size: 3, delay: 0.6, duration: 4.6 },
  { left: '45%', top: '30%', size: 2, delay: 2.8, duration: 3.2 },
  { left: '53%', top: '84%', size: 2, delay: 1.6, duration: 4.3 },
  { left: '62%', top: '18%', size: 3, delay: 0.3, duration: 3.9 },
  { left: '71%', top: '66%', size: 2, delay: 2.4, duration: 4.8 },
  { left: '79%', top: '34%', size: 2, delay: 1.0, duration: 3.5 },
  { left: '88%', top: '72%', size: 3, delay: 3.1, duration: 4.2 },
  { left: '93%', top: '20%', size: 2, delay: 1.9, duration: 3.7 },
  { left: '40%', top: '52%', size: 2, delay: 2.6, duration: 4.4 },
]

/** Khối hình học lơ lửng. Mỗi khối một nhịp riêng để không trôi đồng loạt. */
const SHAPES = [
  { box: 'left-[5%] top-[26%]', duration: 7.5, delay: 0 },
  { box: 'right-[8%] top-[14%]', duration: 9.2, delay: 1.4 },
  { box: 'left-[13%] bottom-[16%]', duration: 8.1, delay: 0.8 },
  { box: 'right-[14%] bottom-[22%]', duration: 10.4, delay: 2.2 },
]

export function HeroAurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLOBS.map((b) => (
        <span
          key={b.box}
          className={cn('hero-blob', b.box)}
          style={{
            backgroundImage: `radial-gradient(circle at center, ${b.color} 0%, transparent 68%)`,
            animation: b.motion,
          }}
        />
      ))}

      {/* Lưới chấm mờ dần ra rìa — đủ để mắt bám được chiều sâu, chưa đủ để đọc
          thành hoạ tiết và làm rối chữ. */}
      <div className="pattern-dots absolute inset-0" />

      {SHAPES.map((s, i) => (
        <span
          key={s.box}
          className={cn('floaty absolute text-white/25', s.box)}
          style={{ animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }}
        >
          {i === 0 && (
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="24" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="26" cy="26" r="12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
          {i === 1 && (
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
              <rect
                x="3"
                y="3"
                width="40"
                height="40"
                rx="12"
                stroke="currentColor"
                strokeWidth="1.5"
                transform="rotate(14 23 23)"
              />
            </svg>
          )}
          {i === 2 && (
            <svg width="58" height="26" viewBox="0 0 58 26" fill="none">
              <path
                d="M2 18C8 4 14 4 20 18s12 14 18 0 12-14 18 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          {i === 3 && (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 2l4.4 11.6L36 18l-11.6 4.4L20 34l-4.4-11.6L4 18l11.6-4.4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      ))}

      {PARTICLES.map((p) => (
        <span
          key={`${p.left}-${p.top}`}
          className="twinkle absolute rounded-full bg-white"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
