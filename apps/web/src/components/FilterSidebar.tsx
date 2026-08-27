import { useState } from 'react'
import { CalendarCheck, ChevronDown, Lock } from 'lucide-react'
import {
  KHOANG_LUONG,
  SALARY_UNITS,
  SALARY_UNIT_LABELS,
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_LABELS,
  type PublicJobQuery,
  type SalaryUnit,
  type ScheduleType,
  type SkillResponse,
} from '@uniwork/shared'
import { DISTRICTS } from '@/lib/khu-vuc'
import { cn } from '@/lib/utils'

/** Chỉ nhận đúng phần bộ lọc, không nhận cả `sort` — sắp xếp nằm trên đầu danh sách. */
export type BoLoc = Omit<PublicJobQuery, 'sort' | 'city'>

interface Props {
  gaTri: BoLoc
  onDoi: (moi: BoLoc) => void
  /** Danh mục kỹ năng lấy từ `GET /api/skills`. */
  kyNang: SkillResponse[]
  /**
   * Người xem có dùng được bộ lọc lịch rảnh không.
   *
   * `false` khi chưa đăng nhập, không phải sinh viên, hoặc chưa khai lịch —
   * server sẽ trả lỗi nếu vẫn gửi lên, nên phải khoá ở đây.
   */
  dungDuocLichRanh: boolean
}

/**
 * Bộ lọc trang việc làm.
 *
 * ---------------------------------------------------------------------------
 * BẢY NHÓM LỌC TRÊN MỘT CỘT — GIẢI QUYẾT BẰNG THU GỌN, KHÔNG BẰNG CẮT BỚT
 * ---------------------------------------------------------------------------
 * Sprint 3 đưa số nhóm lọc từ 2 lên 7. Xếp phẳng hết ra thì cột lọc dài gấp đôi
 * màn hình và người dùng phải cuộn để tìm thứ mình cần.
 *
 * Cách chia: ba nhóm hay dùng nhất luôn mở (lịch rảnh, khu vực, loại thời
 * gian), bốn nhóm còn lại thu gọn sẵn.
 *
 * ---------------------------------------------------------------------------
 * BẪY CỦA NHÓM THU GỌN, VÀ CÁCH TRÁNH
 * ---------------------------------------------------------------------------
 * Một nhóm đang thu gọn mà BÊN TRONG có bộ lọc đang bật là cái bẫy tệ nhất của
 * kiểu giao diện này: người dùng thấy danh sách ngắn bất thường, không hiểu vì
 * sao, và không có gì trên màn hình chỉ cho họ chỗ để tắt.
 *
 * Nên mỗi tiêu đề nhóm tự hiện giá trị đang lọc ngay bên cạnh (ví dụ "từ
 * 25.000đ/giờ", "2 kỹ năng"). Thu gọn giấu đi lựa chọn, KHÔNG bao giờ giấu kết
 * quả đang có hiệu lực.
 */

/* -------------------------------------------------------------- nhóm lọc -- */

function Nhom({
  tieuDe,
  tomTat,
  moSan,
  children,
}: {
  tieuDe: string
  /** Giá trị đang lọc, hiện cạnh tiêu đề kể cả khi nhóm đang thu gọn. */
  tomTat?: string
  moSan?: boolean
  children: React.ReactNode
}) {
  const [mo, setMo] = useState(Boolean(moSan))

  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        aria-expanded={mo}
        className={cn(
          'flex w-full items-center gap-2 px-5 py-3.5 text-left',
          // Chỉ đổi màu nền, không đụng tới transform: tiêu đề nhóm bị bấm
          // liên tục khi người dùng dò bộ lọc, thêm hiệu ứng nhún vào đây là
          // làm chậm một thao tác lặp lại nhiều lần.
          'transition-colors duration-150 ease-out hover:bg-slate-50',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
        )}
      >
        <h3 className="text-sm font-semibold text-slate-900">{tieuDe}</h3>

        {tomTat && (
          <span className="truncate rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            {tomTat}
          </span>
        )}

        <ChevronDown
          size={16}
          // Xoay bằng transform (chạy trên GPU), 150ms ease-out — vừa đủ để mắt
          // bắt được hướng mở/đóng mà không ai phải chờ.
          className={cn(
            'ml-auto shrink-0 text-slate-400 transition-transform duration-150 ease-out',
            mo && 'rotate-180',
          )}
        />
      </button>

      {/*
        Hiện/ẩn tức thì, KHÔNG animate chiều cao.
        Animate `height` bắt trình duyệt tính lại bố cục mỗi khung hình, và ở
        đây nó không đổi lấy được gì: người dùng vừa tự bấm nên đã biết chuyện
        gì đang xảy ra. Mũi tên xoay là đủ tín hiệu.
      */}
      {mo && <div className="px-5 pb-4">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ ô lựa chọn -- */

function O({
  loai,
  ten,
  chon,
  onChon,
  nhan,
}: {
  loai: 'radio' | 'checkbox'
  ten: string
  chon: boolean
  onChon: () => void
  nhan: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-slate-600 transition-colors duration-100 hover:text-slate-900">
      <input
        type={loai}
        name={ten}
        checked={chon}
        onChange={onChon}
        className="h-4 w-4 shrink-0 accent-brand-600"
      />
      <span className="min-w-0 truncate">{nhan}</span>
    </label>
  )
}

const dinhDang = (v: number) => v.toLocaleString('vi-VN')

/* ------------------------------------------------------------------ main -- */

export function FilterSidebar({ gaTri, onDoi, kyNang, dungDuocLichRanh }: Props) {
  const dat = (phan: Partial<BoLoc>) => onDoi({ ...gaTri, ...phan })

  /*
   * Đổi đơn vị lương thì XOÁ luôn mức đã chọn.
   *
   * Giữ lại là lỗi âm thầm: người dùng kéo "từ 25.000" ở đơn vị GIỜ rồi đổi
   * sang THÁNG, con số 25.000 vẫn nằm đó và bỗng có nghĩa "25 nghìn một tháng"
   * — lọc ra gần như mọi tin, không ai hiểu vì sao.
   */
  const doiDonVi = (donVi: SalaryUnit | undefined) =>
    dat({ salaryUnit: donVi, salaryFrom: undefined })

  const doiKyNang = (id: string) => {
    const dangCo = gaTri.skillIds ?? []
    const moi = dangCo.includes(id) ? dangCo.filter((x) => x !== id) : [...dangCo, id]
    dat({ skillIds: moi.length > 0 ? moi : undefined })
  }

  const soBoLocDangBat = [
    gaTri.matchAvailability,
    gaTri.district,
    gaTri.scheduleType,
    gaTri.salaryUnit,
    // `includeNegotiable === false` là một lựa chọn có thật của người dùng, phải
    // đếm vào — nếu không thì "Xoá tất cả" biến mất trong khi nó vẫn còn hiệu lực.
    gaTri.includeNegotiable === false,
    gaTri.skillIds?.length,
    gaTri.maxShiftsPerWeek,
    gaTri.maxCommitmentMonths,
  ].filter(Boolean).length

  const khoangLuong = gaTri.salaryUnit ? KHOANG_LUONG[gaTri.salaryUnit] : null

  return (
    <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <h2 className="font-semibold text-slate-900">
          Bộ lọc
          {soBoLocDangBat > 0 && (
            <span className="ml-1.5 text-sm font-normal text-slate-500">
              ({soBoLocDangBat})
            </span>
          )}
        </h2>

        {soBoLocDangBat > 0 && (
          <button
            type="button"
            onClick={() => onDoi({})}
            className={cn(
              'rounded-md px-1.5 py-1 text-xs font-medium text-brand-600',
              'transition-colors duration-150 ease-out hover:text-brand-700 hover:bg-brand-50',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
            )}
          >
            Xoá tất cả
          </button>
        )}
      </div>

      {/* ---------------------------------------------------- lịch rảnh -- */}
      {/*
        Bộ lọc lõi của UniWork — thứ các trang việc làm khác không có. Nó nằm
        NGOÀI danh sách nhóm thu gọn và có nền riêng, vì đây là lý do chính để
        sinh viên dùng trang này thay vì một trang đăng tin thường.
      */}
      <div className="mx-3 mb-1 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
        <label
          className={cn(
            'flex items-start gap-2.5',
            dungDuocLichRanh ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="checkbox"
            checked={Boolean(gaTri.matchAvailability)}
            disabled={!dungDuocLichRanh}
            onChange={(e) => dat({ matchAvailability: e.target.checked || undefined })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <CalendarCheck size={15} className="shrink-0 text-brand-600" />
              Chỉ hiện việc khớp lịch rảnh
              {!dungDuocLichRanh && <Lock size={12} className="shrink-0 text-slate-400" />}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {dungDuocLichRanh
                ? 'Lọc theo đúng khung giờ bạn đã khai'
                : 'Đăng nhập bằng tài khoản sinh viên và khai lịch rảnh để dùng'}
            </span>
          </span>
        </label>
      </div>

      {/* ------------------------------------------------------ khu vực -- */}
      <Nhom tieuDe="Khu vực" tomTat={gaTri.district} moSan>
        <div className="space-y-0.5">
          {DISTRICTS.map((d) => (
            <O
              key={d}
              loai="radio"
              ten="district"
              nhan={d}
              chon={gaTri.district === d}
              // Bấm lại quận đang chọn thì BỎ chọn. Radio thường không cho làm
              // vậy, nhưng ở đây không có lựa chọn "tất cả" nào để quay về —
              // thiếu nó thì chọn nhầm một quận là kẹt luôn với nó.
              onChon={() => dat({ district: gaTri.district === d ? undefined : d })}
            />
          ))}
        </div>
      </Nhom>

      {/* ----------------------------------------------- loại thời gian -- */}
      <Nhom
        tieuDe="Loại thời gian"
        tomTat={gaTri.scheduleType ? SCHEDULE_TYPE_LABELS[gaTri.scheduleType] : undefined}
        moSan
      >
        <div className="space-y-0.5">
          {SCHEDULE_TYPES.map((key: ScheduleType) => (
            <O
              key={key}
              loai="radio"
              ten="scheduleType"
              nhan={SCHEDULE_TYPE_LABELS[key]}
              chon={gaTri.scheduleType === key}
              onChon={() =>
                dat({ scheduleType: gaTri.scheduleType === key ? undefined : key })
              }
            />
          ))}
        </div>
      </Nhom>

      {/* -------------------------------------------------------- lương -- */}
      <Nhom
        tieuDe="Mức lương"
        tomTat={
          gaTri.salaryUnit
            ? gaTri.salaryFrom !== undefined
              ? `từ ${dinhDang(gaTri.salaryFrom)}đ/${SALARY_UNIT_LABELS[gaTri.salaryUnit]}`
              : `theo ${SALARY_UNIT_LABELS[gaTri.salaryUnit]}`
            : undefined
        }
      >
        {/*
          Chọn ĐƠN VỊ trước, rồi mới tới con số.
          Ba đơn vị không quy đổi về cùng một thang được — quy đổi đòi giả định
          "một ca mấy giờ", thay đổi theo từng tin. Nên thanh trượt chỉ xuất
          hiện SAU khi đã có đơn vị, và khoảng của nó đổi theo đơn vị đó.
        */}
        <div className="flex gap-1.5">
          {SALARY_UNITS.map((dv) => (
            <button
              key={dv}
              type="button"
              onClick={() => doiDonVi(gaTri.salaryUnit === dv ? undefined : dv)}
              aria-pressed={gaTri.salaryUnit === dv}
              className={cn(
                'flex-1 rounded-lg border py-1.5 text-xs font-medium',
                'transition-colors duration-150 ease-out',
                // Nhún nhẹ khi bấm: đây là nút bấm thật, phải cho cảm giác
                // giao diện có nghe thấy.
                'active:scale-[0.97] motion-reduce:active:scale-100',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
                gaTri.salaryUnit === dv
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50',
              )}
            >
              /{SALARY_UNIT_LABELS[dv]}
            </button>
          ))}
        </div>

        {khoangLuong && (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Từ</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {gaTri.salaryFrom !== undefined
                  ? `${dinhDang(gaTri.salaryFrom)}đ`
                  : 'không giới hạn'}
              </span>
            </div>

            <input
              type="range"
              min={khoangLuong.min}
              max={khoangLuong.max}
              step={khoangLuong.buoc}
              value={gaTri.salaryFrom ?? khoangLuong.min}
              onChange={(e) => dat({ salaryFrom: Number(e.target.value) })}
              className="w-full accent-brand-600"
              aria-label={`Mức lương tối thiểu theo ${SALARY_UNIT_LABELS[gaTri.salaryUnit!]}`}
            />

            <div className="mt-0.5 flex justify-between text-[11px] tabular-nums text-slate-400">
              <span>{dinhDang(khoangLuong.min)}đ</span>
              <span>{dinhDang(khoangLuong.max)}đ</span>
            </div>

            {/*
              Tin "Thoả thuận" MẶC ĐỊNH được giữ, và người dùng tự tắt được.

              Chúng không có con số để so — nhưng "không so được" khác hẳn "trả
              thấp hơn mức bạn muốn", đúng cùng sự phân biệt `null` với `0` dùng
              ở điểm phù hợp. Loại theo mặc định là biến một điều chưa biết
              thành một lời từ chối, mà tin part-time Việt Nam ghi "thoả thuận"
              rất nhiều nên đó là giấu mất phần lớn bảng tin.
            */}
            {gaTri.salaryFrom !== undefined && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-slate-600">
                <input
                  type="checkbox"
                  checked={gaTri.includeNegotiable !== false}
                  onChange={(e) =>
                    dat({ includeNegotiable: e.target.checked ? undefined : false })
                  }
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-600"
                />
                <span>
                  Gồm cả tin ghi &ldquo;Thoả thuận&rdquo;
                  <span className="mt-0.5 block text-slate-400">
                    Chúng không ghi số nên không so được với mức bạn chọn.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}
      </Nhom>

      {/* ------------------------------------------------------ kỹ năng -- */}
      <Nhom
        tieuDe="Kỹ năng"
        tomTat={gaTri.skillIds?.length ? `${gaTri.skillIds.length} kỹ năng` : undefined}
      >
        {kyNang.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa có kỹ năng nào trong danh mục.</p>
        ) : (
          <>
            {/* Cuộn trong nhóm thay vì kéo dài cả cột lọc — danh mục kỹ năng có
                thể lên vài chục dòng. */}
            <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
              {kyNang.map((k) => (
                <O
                  key={k.id}
                  loai="checkbox"
                  ten="skill"
                  nhan={k.name}
                  chon={Boolean(gaTri.skillIds?.includes(k.id))}
                  onChon={() => doiKyNang(k.id)}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Khớp <strong className="font-semibold">bất kỳ</strong> kỹ năng nào bạn chọn.
            </p>
          </>
        )}
      </Nhom>

      {/* ------------------------------------------------- số ca / tuần -- */}
      {/*
        `minShiftsPerWeek` và `commitmentMonths` là HAI bộ lọc riêng, cố ý không
        gộp: một cái là cường độ mỗi tuần, một cái là thời gian gắn bó. Tin
        part-time thật ở Việt Nam thường quy định đồng thời cả hai ("tối thiểu
        5 ca/tuần, gắn bó tối thiểu 3 tháng"), nên gộp lại là làm người lọc mất
        khả năng diễn đạt nhu cầu thật.
      */}
      <Nhom
        tieuDe="Số ca mỗi tuần"
        tomTat={gaTri.maxShiftsPerWeek ? `tối đa ${gaTri.maxShiftsPerWeek} ca` : undefined}
      >
        <p className="mb-2 text-xs text-slate-500">Bạn nhận tối đa bao nhiêu ca một tuần?</p>
        <div className="flex flex-wrap gap-1.5">
          {[2, 3, 4, 5, 6].map((n) => (
            <ChipSo
              key={n}
              nhan={`${n} ca`}
              chon={gaTri.maxShiftsPerWeek === n}
              onChon={() =>
                dat({ maxShiftsPerWeek: gaTri.maxShiftsPerWeek === n ? undefined : n })
              }
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Tin không quy định số ca vẫn hiện.
        </p>
      </Nhom>

      {/* ------------------------------------------------ tháng cam kết -- */}
      <Nhom
        tieuDe="Thời gian cam kết"
        tomTat={
          gaTri.maxCommitmentMonths ? `tối đa ${gaTri.maxCommitmentMonths} tháng` : undefined
        }
      >
        <p className="mb-2 text-xs text-slate-500">Bạn gắn bó được tối đa bao lâu?</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 3, 6, 12].map((n) => (
            <ChipSo
              key={n}
              nhan={`${n} tháng`}
              chon={gaTri.maxCommitmentMonths === n}
              onChon={() =>
                dat({
                  maxCommitmentMonths: gaTri.maxCommitmentMonths === n ? undefined : n,
                })
              }
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Tin không quy định thời gian vẫn hiện.
        </p>
      </Nhom>
    </aside>
  )
}

/** Chip số dùng chung cho hai nhóm ngưỡng ở cuối. */
function ChipSo({
  nhan,
  chon,
  onChon,
}: {
  nhan: string
  chon: boolean
  onChon: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChon}
      aria-pressed={chon}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-xs font-medium',
        'transition-colors duration-150 ease-out',
        'active:scale-[0.97] motion-reduce:active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
        chon
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50',
      )}
    >
      {nhan}
    </button>
  )
}
