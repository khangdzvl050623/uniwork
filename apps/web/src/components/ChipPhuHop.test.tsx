import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MatchBreakdown } from '@uniwork/shared'
import { ChipPhuHop } from './ChipPhuHop'

/**
 * Test cho chip điểm phù hợp.
 *
 * Hai luật dễ làm sai nhất, cả hai đều hỏng ÂM THẦM — giao diện vẫn vẽ đẹp:
 *
 * 1. Con số tổng hợp KHÔNG được hiện thẳng. Nó là khoá sắp xếp, không phải lời
 *    nói với người dùng.
 * 2. Độ phủ IM LẶNG khi đủ. Hiện "1/3 tiêu chí" cho một hồ sơ hoàn chỉnh là
 *    trách nhầm người về một thứ chẳng ai hỏi.
 */

function breakdown(ghiDe: Partial<MatchBreakdown> = {}): MatchBreakdown {
  return {
    shifts: { matched: 8, total: 20, required: 5, score: 40, weight: 0.5 },
    skills: { matched: 3, total: 5, score: 60, weight: 0.3 },
    commitment: { months: 4, required: 6, score: 67, weight: 0.2 },
    coverage: { apDung: 3, doDuoc: 3 },
    eligible: true,
    finalScore: 51,
    ...ghiDe,
  }
}

describe('ChipPhuHop', () => {
  it('hiện chi tiết từng thành phần, KHÔNG hiện con số tổng hợp', () => {
    render(<ChipPhuHop breakdown={breakdown()} />)

    expect(screen.getByText('8/20 ca')).toBeTruthy()
    expect(screen.getByText('3/5 kỹ năng')).toBeTruthy()
    expect(screen.getByText('4/6 tháng')).toBeTruthy()

    // 51 là khoá sắp xếp, không phải thứ nói với người dùng. "51%" một mình
    // không cho họ biết phải làm gì để nó lên.
    expect(screen.queryByText(/51/)).toBeNull()
  })

  it('độ phủ ĐỦ thì im lặng — không nhắc gì', () => {
    render(<ChipPhuHop breakdown={breakdown({ coverage: { apDung: 3, doDuoc: 3 } })} />)
    expect(screen.queryByText(/tiêu chí/)).toBeNull()
  })

  it('độ phủ THIẾU thì nói rõ tính trên mấy tiêu chí', () => {
    render(
      <ChipPhuHop
        breakdown={breakdown({
          commitment: { months: null, required: 6, score: null, weight: 0.2, vangVi: 'THIEU_DU_LIEU' },
          coverage: { apDung: 3, doDuoc: 2 },
        })}
      />,
    )
    expect(screen.getByText('2/3 tiêu chí')).toBeTruthy()
    // Thành phần không đo được thì không vẽ chip rỗng.
    expect(screen.queryByText(/tháng/)).toBeNull()
  })

  it('tin không yêu cầu kỹ năng → không chip kỹ năng, và VẪN im lặng vì mẫu số đã loại nó', () => {
    render(
      <ChipPhuHop
        breakdown={breakdown({
          skills: { matched: 0, total: 0, score: null, weight: 0.3, vangVi: 'KHONG_AP_DUNG' },
          commitment: { months: null, required: null, score: null, weight: 0.2, vangVi: 'KHONG_AP_DUNG' },
          coverage: { apDung: 1, doDuoc: 1 },
        })}
      />,
    )

    expect(screen.getByText('8/20 ca')).toBeTruthy()
    expect(screen.queryByText(/kỹ năng/)).toBeNull()
    // Đây là ca dễ sai nhất: mẫu số cứng bằng 3 sẽ ghi "1/3 tiêu chí" và bêu
    // một hồ sơ hoàn chỉnh là thiếu.
    expect(screen.queryByText(/tiêu chí/)).toBeNull()
  })

  it('không đủ ca thì chip ca đổi màu cảnh báo, không chỉ là một con số thấp', () => {
    const { container } = render(
      <ChipPhuHop
        breakdown={breakdown({
          shifts: { matched: 2, total: 20, required: 5, score: 10, weight: 0.5 },
          eligible: false,
        })}
      />,
    )
    expect(container.querySelector('.text-rose-700')).not.toBeNull()
  })

  it('chưa có breakdown (đơn từ trước Sprint 4) → không vẽ gì, không nổ', () => {
    const { container } = render(<ChipPhuHop breakdown={null} />)
    expect(container.innerHTML).toBe('')
  })
})
