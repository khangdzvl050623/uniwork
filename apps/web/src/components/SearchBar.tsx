import { useNavigate } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DISTRICTS } from '@/data/mock'

export function SearchBar() {
  const navigate = useNavigate()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        navigate('/viec-lam')
      }}
      className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-lg sm:flex-row"
    >
      <div className="flex flex-1 items-center gap-2 px-3">
        <Search size={18} className="shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Tên việc, kỹ năng hoặc tên công ty"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-center gap-2 border-slate-200 px-3 sm:border-l">
        <MapPin size={18} className="shrink-0 text-slate-400" />
        <select className="h-10 w-full bg-transparent text-sm text-slate-600 outline-none sm:w-40">
          <option value="">Tất cả khu vực</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      <Button type="submit" size="lg" className="shrink-0">
        Tìm việc
      </Button>
    </form>
  )
}
