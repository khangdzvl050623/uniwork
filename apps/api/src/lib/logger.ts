type Level = 'info' | 'warn' | 'error'

/**
 * Log có hai chế độ, chọn theo NODE_ENV.
 *
 * - production: JSON một dòng. Trên Render log là luồng text phẳng hàng nghìn
 *   dòng, định dạng cố định thì lọc được bằng lệnh và gắn công cụ giám sát được.
 * - development: dòng có màu, đọc bằng mắt. JSON trong terminal lúc dev chỉ
 *   tổ rối, nhất là khi chạy chung với log của Vite.
 *
 * Quy ước chung cho cả hai chế độ: error ra stderr, còn lại ra stdout. Nền tảng
 * phân biệt hai luồng này nên cảnh báo lỗi mới bắt đúng chỗ.
 */
const isProduction = process.env.NODE_ENV === 'production'

const COLORS: Record<Level, string> = {
  info: '\x1b[36m', // xanh lơ
  warn: '\x1b[33m', // vàng
  error: '\x1b[31m', // đỏ
}
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function format(level: Level, message: string, meta?: Record<string, unknown>) {
  if (isProduction) {
    return JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta })
  }

  const time = new Date().toTimeString().slice(0, 8)
  const tag = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`
  const extra = meta
    ? ` ${DIM}${Object.entries(meta)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}${RESET}`
    : ''

  return `${DIM}${time}${RESET} ${tag} ${message}${extra}`
}

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const line = format(level, message, meta)
  if (level === 'error') process.stderr.write(`${line}\n`)
  else process.stdout.write(`${line}\n`)
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
}
