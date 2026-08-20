import { useEffect, useState } from 'react'

/** Đồng hồ đếm ngược tới hạn đăng ký, chạy thật theo giây. */
export function Countdown({ hours = 11 }: { hours?: number }) {
  const [target] = useState(() => Date.now() + hours * 3600 * 1000 + 53 * 60 * 1000)
  const [left, setLeft] = useState(() => target - Date.now())

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000)
    return () => clearInterval(id)
  }, [target])

  const total = Math.floor(left / 1000)
  const parts = [
    { value: Math.floor(total / 3600), label: 'giờ' },
    { value: Math.floor((total % 3600) / 60), label: 'phút' },
    { value: total % 60, label: 'giây' },
  ]

  return (
    <div className="flex items-center gap-2">
      {parts.map((p, i) => (
        <div key={p.label} className="flex items-center gap-2">
          <div className="min-w-14 rounded-lg bg-white/15 px-3 py-2 text-center ring-1 ring-white/25">
            <div className="text-2xl font-extrabold tabular-nums text-white">
              {String(p.value).padStart(2, '0')}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-white/70">{p.label}</div>
          </div>
          {i < parts.length - 1 && <span className="text-xl font-bold text-white/50">:</span>}
        </div>
      ))}
    </div>
  )
}
