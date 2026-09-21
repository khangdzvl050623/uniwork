export { aiConfig, CO_KHOA_THAT, ngayVN, ngayPacific, ngayUTC } from './config.js'
export { modelChat, resetProviderCache } from './provider.js'
export { kiemTraKetNoi, type KetQuaKiemTra } from './kiem-tra.js'
export { giuLuot, demLuotConLai, DangBanError } from './quota.js'
export type { KetQuaGiuLuot, ClientPrisma } from './quota.js'

/*
 * `tool` được xuất lại từ đây, KHÔNG để apps/api import thẳng từ 'ai'.
 *
 * Bộ tool phải sống cạnh service mà nó gọi (apps/api/src/modules/chat), nên
 * apps/api cần hàm `tool()` để AI SDK suy được kiểu giữa `inputSchema` và tham
 * số của `execute`. Xuất lại ở đây giữ nguyên luật đã đặt ở bước 1: chỉ MỘT
 * package khai `ai` trong dependencies, nên nâng cấp SDK là sửa một chỗ và
 * `pnpm why ai` chỉ ra đúng một đường.
 */
export { tool, type Tool, type ToolSet } from 'ai'
