import { describe, expect, it } from 'vitest'
import { layDeNghi, suyNhan, type GoiTool } from './nhan.js'

const g = (ten: string, ketQua: unknown): GoiTool => ({ ten, ketQua })

describe('layDeNghi', () => {
  it('lấy lời đề nghị khi model gọi đúng tool', () => {
    const kq = layDeNghi([
      g('timViecLam', { ok: true, tin: [] }),
      g('deNghiChuyenNhaTuyenDung', {
        ok: true,
        deNghi: { jobId: 'j1', tenTin: 'Pha chế', congTy: 'Quán A', lyDo: 'xin về sớm' },
      }),
    ])
    expect(kq).toMatchObject({ jobId: 'j1', lyDo: 'xin về sớm' })
  })

  /*
   * Model bịa jobId thì tool trả `deNghi: null` kèm `lyDoTuChoi`. Không bắt ca
   * này thì giao diện hiện một cái nút trỏ tới tin không tồn tại.
   */
  it('trả null khi tool từ chối vì không tìm thấy tin', () => {
    expect(
      layDeNghi([g('deNghiChuyenNhaTuyenDung', { ok: true, deNghi: null, lyDoTuChoi: 'Không tìm thấy' })]),
    ).toBeNull()
  })

  it('trả null khi model không gọi tool đó', () => {
    expect(layDeNghi([g('timViecLam', { ok: true, tin: [] })])).toBeNull()
  })
})

describe('suyNhan — telemetry, KHÔNG phải thước đo chất lượng', () => {
  /*
   * ---------------------------------------------------------------------
   * VÌ SAO CÓ UNKNOWN VÀ VÌ SAO KHÔNG ĐƯỢC BỎ NÓ
   * ---------------------------------------------------------------------
   * "Không gọi tool nào" có thể là ngoài phạm vi, có thể là thiếu ngữ cảnh, và
   * cũng có thể là model trả lời sai mà không thèm tra cứu. Dấu vết không phân
   * biệt được ba ca đó.
   *
   * Ép chúng vào một nhãn nào cũng được, nhưng khi đó tỉ lệ UNKNOWN cao — tín
   * hiệu DUY NHẤT cho biết quy tắc suy nhãn cần sửa — biến mất.
   */
  it('không gọi tool nào thì là UNKNOWN, không đoán bừa', () => {
    expect(suyNhan([])).toBe('UNKNOWN')
  })

  it('gọi deNghiChuyenNhaTuyenDung thì là CAN_NHA_TUYEN_DUNG', () => {
    expect(suyNhan([g('timViecLam', { ok: true, tin: [{ id: 'j1' }] }), g('deNghiChuyenNhaTuyenDung', {})])).toBe(
      'CAN_NHA_TUYEN_DUNG',
    )
  })

  it('gọi huongDanSuDung thì là HUONG_DAN_SU_DUNG', () => {
    expect(suyNhan([g('huongDanSuDung', { ok: true, huongDan: '...' })])).toBe('HUONG_DAN_SU_DUNG')
  })

  it('tra cứu có kết quả thì là TRA_CUU', () => {
    expect(suyNhan([g('timViecLam', { ok: true, tin: [{ id: 'j1' }], tong: 1 })])).toBe('TRA_CUU')
  })

  /*
   * "Đúng phạm vi nhưng không có dữ liệu" là một NHÓM RIÊNG trong đề bài —
   * "có việc gia sư ở Cà Mau không". Gộp nó vào TRA_CUU thì không đo được tỉ lệ
   * người dùng tìm mà không ra gì, mà đó là số liệu sản phẩm cần biết.
   */
  it('tra cứu ra mảng rỗng thì là KHONG_CO_DU_LIEU', () => {
    expect(suyNhan([g('timViecLam', { ok: true, tin: [], tong: 0 })])).toBe('KHONG_CO_DU_LIEU')
  })

  it('tool hỏng cũng là KHONG_CO_DU_LIEU, không tính là tra cứu được', () => {
    expect(suyNhan([g('xemHoSoCuaToi', { ok: false, lyDo: 'Chưa có hồ sơ' })])).toBe('KHONG_CO_DU_LIEU')
  })
})
