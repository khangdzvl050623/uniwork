import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

const SO_O = 6

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  /** Gọi khi người dùng vừa điền đủ 6 chữ số — dùng để tự gửi. */
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
}

/**
 * Sáu ô nhập cho mã xác thực (T47).
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO SÁU Ô RIÊNG THAY VÌ MỘT Ô DÀI
 * ---------------------------------------------------------------------------
 * Một ô dài thì người dùng không biết mã có mấy chữ số cho tới khi gõ sai. Sáu
 * ô nói ngay điều đó mà không cần một dòng chữ nào.
 *
 * Đổi lại, sáu ô đòi phải tự lo mấy thứ mà một ô được trình duyệt cho không —
 * và thiếu bất kỳ thứ nào dưới đây là form trở nên khó chịu:
 *
 * - DÁN: người dùng copy mã 6 số từ email rồi dán. Không xử lý thì cả 6 chữ số
 *   chui hết vào ô đầu tiên. Đây là cách dùng phổ biến NHẤT, không phải ca hiếm.
 * - XOÁ LÙI: bấm Backspace ở ô rỗng phải nhảy về ô trước và xoá luôn chữ ở đó.
 *   Không có thì người dùng phải bấm Backspace hai lần cho mỗi chữ số.
 * - PHÍM MŨI TÊN: đi lại giữa các ô để sửa đúng một chữ số gõ nhầm.
 * - `autoComplete="one-time-code"`: iOS và Chrome đọc được mã trong tin nhắn và
 *   gợi ý điền ngay trên bàn phím. Chỉ đặt ở ô ĐẦU TIÊN, đặt ở cả sáu ô thì
 *   trình duyệt bối rối và không gợi ý gì cả.
 */
export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  /*
   * Ô trống Ở GIỮA được giữ chỗ bằng dấu cách, không phải bị xoá hẳn.
   *
   * Không giữ chỗ thì xoá ô số 1 của "123456" sẽ cho ra "23456" — các chữ số
   * phía sau dồn lên một ô, và người dùng thấy ô vừa xoá bỗng hiện số khác.
   * Trông y như lỗi hiển thị.
   *
   * Dấu cách thừa ở cuối thì cắt đi, nên gõ dở "12" vẫn là "12" chứ không phải
   * "12    ".
   */
  const capNhat = (moi: string) => {
    onChange(moi)
    // Đủ 6 và TOÀN chữ số mới coi là xong — chuỗi " 23456" cũng dài 6 nhưng
    // đang khuyết một ô.
    if (/^\d{6}$/.test(moi)) onComplete?.(moi)
  }

  const focus = (index: number) => {
    refs.current[Math.max(0, Math.min(SO_O - 1, index))]?.focus()
  }

  const goChu = (index: number, raw: string) => {
    // Lọc bỏ mọi thứ không phải chữ số — bàn phím điện thoại vẫn cho gõ dấu
    // chấm, dấu trừ ngay cả khi inputMode là numeric.
    const so = raw.replace(/\D/g, '')
    if (!so) return

    const kyTu = value.padEnd(SO_O, ' ').split('')

    // Gõ nhiều chữ số cùng lúc (bàn phím gợi ý mã, hoặc dán không qua sự kiện
    // paste) thì rải từ ô hiện tại trở đi.
    for (let i = 0; i < so.length && index + i < SO_O; i++) {
      kyTu[index + i] = so[i]
    }

    capNhat(kyTu.join('').trimEnd())
    focus(index + so.length)
  }

  const goPhim = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()

      // Đệm đủ 6 ô TRƯỚC khi sửa, để xoá ô giữa không làm dồn các số phía sau.
      const kyTu = value.padEnd(SO_O, ' ').split('')

      if (kyTu[index] !== ' ') {
        // Ô đang có chữ: xoá tại chỗ, con trỏ ở nguyên đó.
        kyTu[index] = ' '
        capNhat(kyTu.join('').trimEnd())
      } else if (index > 0) {
        // Ô rỗng: lùi về ô trước và xoá chữ ở đó, gộp hai thao tác làm một.
        kyTu[index - 1] = ' '
        capNhat(kyTu.join('').trimEnd())
        focus(index - 1)
      }
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(index - 1)
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(index + 1)
    }
  }

  const dan = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const so = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, SO_O)
    if (!so) return

    capNhat(so)
    focus(so.length)
  }

  return (
    // Ô co giãn theo bề ngang màn hình thay vì cố định 48px.
    //
    // Sáu ô cố định `w-12` cộng khoảng cách là 328px. Trên iPhone SE (bề ngang
    // 320px), sau padding của trang và của thẻ chỉ còn khoảng 240px — tràn ra
    // ngoài và cả trang bị cuộn ngang. Dùng `flex-1` kèm trần `max-w-12` thì ô
    // giữ đúng kích thước cũ ở màn rộng, và tự thu lại vừa đủ ở màn hẹp.
    <div
      className="flex justify-center gap-1.5 sm:gap-2"
      role="group"
      aria-label="Mã xác thực 6 chữ số"
    >
      {Array.from({ length: SO_O }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          // inputMode numeric để điện thoại mở thẳng bàn phím số.
          inputMode="numeric"
          // maxLength 1 nhưng vẫn xử lý chuỗi dài trong `goChu`: trình duyệt
          // trên Android đôi khi bơm cả chuỗi vào bất kể maxLength.
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Chữ số thứ ${i + 1}`}
          // `trim()` vì ô khuyết ở giữa được giữ chỗ bằng dấu cách — hiện dấu
          // cách ra thì ô trông như có nội dung mà lại trống.
          value={value[i]?.trim() ?? ''}
          disabled={disabled}
          onChange={(e) => goChu(i, e.target.value)}
          onKeyDown={(e) => goPhim(i, e)}
          onPaste={dan}
          // Bấm vào ô nào thì bôi đen chữ trong đó, để gõ đè được ngay thay vì
          // phải xoá trước.
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-12 min-w-0 flex-1 basis-0 rounded-lg border bg-white text-center text-lg font-semibold text-slate-900',
            'max-w-12 sm:h-14 sm:text-xl',
            'outline-none transition-[border-color,box-shadow] duration-150 ease-out',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            error ? 'border-red-400' : 'border-slate-200',
          )}
        />
      ))}
    </div>
  )
}
