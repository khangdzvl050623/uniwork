import type { ChatKind } from '@prisma/client'
import type { ToolSet } from '@uniwork/ai-runtime'
import {
  CAU_KHI_CHAM_TRAN,
  HE_THONG_SINH_VIEN,
  PROMPT_VERSION,
} from './prompts/he-thong-sinh-vien.js'
import { dungToolSinhVien } from './tools.sinh-vien.js'

/**
 * Luồng nào CÓ trợ lý AI, và trợ lý đó dùng prompt nào, tool nào.
 *
 * ===========================================================================
 * ĐÂY LÀ LỚP CHẶN — KHÔNG PHẢI TOOL
 * ===========================================================================
 * Trước đây `chayLuot` cứng prompt và tool của sinh viên cho MỌI luồng, còn
 * `batDauLuot` chỉ kiểm `state`. Hệ quả:
 *
 *   nhà tuyển dụng tạo luồng `AI_EMPLOYER` rồi gọi `/tro-ly/hoi` → chạy được
 *   trợ lý SINH VIÊN, tốn một lượt, nhận câu trả lời vô nghĩa
 *
 *   luồng `AI_SUPPORT` chưa xin hỗ trợ (đang `AI_ACTIVE`) → có AI trả lời ngay
 *   trong kênh hỗ trợ, trái thẳng thiết kế "không có AI trong luồng hỗ trợ"
 *
 * Không rò dữ liệu: tool gọi service theo `userId`, tài khoản không có hồ sơ
 * sinh viên thì nhận `notFound` và tool trả `{ok:false}`. Nhưng đó là may mắn
 * của tool, không phải thiết kế — lớp chặn đặt nhầm chỗ. Review 2026-10-05.
 *
 * Câu hỏi đúng là "luồng này có cấu hình trợ lý hợp lệ không", và câu trả lời
 * nằm ở đây, MỘT chỗ. `batDauLuot` hỏi bảng này TRƯỚC khi giữ lượt, nên luồng
 * không có trợ lý bị từ chối mà không tốn gì.
 *
 * ---------------------------------------------------------------------------
 * THÊM TRỢ LÝ MỚI = THÊM MỘT DÒNG
 * ---------------------------------------------------------------------------
 * Trợ lý cho nhà tuyển dụng nằm trong hướng phát triển (2026-10-05). Khi có,
 * nó là một mục `AI_EMPLOYER` ở bảng dưới — prompt riêng, tool riêng — và mọi
 * chỗ khác tự nhận ra.
 *
 * Lưu ý cho lúc đó: tool của nhà tuyển dụng sẽ đụng dữ liệu SINH VIÊN. Hai
 * ràng buộc phải giữ — Gemini gói free cấm gửi dữ liệu cá nhân, và luật
 * `TRANG_THAI_MO_LIEN_HE` chỉ mở liên hệ khi đơn đã vào vòng trong. Trợ lý
 * không được thành cửa sau đi vòng qua luật đó.
 */

export interface NguCanhTroLy {
  /** Lấy từ `req.user`. KHÔNG BAO GIỜ từ đầu vào của model. */
  userId: string
  jobIdDangXem?: string
}

export interface CauHinhTroLy {
  system: string
  /** Ghi vào `AiTurn` để biết câu trả lời nào sinh ra từ prompt nào. */
  promptVersion: string
  /** Câu trả lời thay thế khi model chạm trần số vòng gọi tool. */
  cauKhiChamTran: string
  dungTool: (ngu: NguCanhTroLy) => ToolSet
}

/*
 * `Partial` có chủ đích: thiếu một `kind` ở đây nghĩa là luồng đó KHÔNG có
 * trợ lý, và TypeScript bắt mọi chỗ dùng phải xử lý trường hợp `undefined`.
 */
const TRO_LY_THEO_KENH: Partial<Record<ChatKind, CauHinhTroLy>> = {
  AI_STUDENT: {
    system: HE_THONG_SINH_VIEN,
    promptVersion: PROMPT_VERSION,
    cauKhiChamTran: CAU_KHI_CHAM_TRAN,
    dungTool: (ngu) => dungToolSinhVien(ngu),
  },
}

/** `null` = luồng này không có trợ lý AI. */
export function cauHinhTroLy(kind: ChatKind): CauHinhTroLy | null {
  return TRO_LY_THEO_KENH[kind] ?? null
}
