type Level = 'info' | 'warn' | 'error'

/**
 * Log dạng JSON một dòng, không dùng console.log rải rác.
 *
 * Lý do dùng JSON: trên Render (và mọi nền tảng container) log là một luồng
 * text phẳng. Nếu mỗi chỗ tự in một kiểu thì khi có sự cố phải đọc bằng mắt.
 * JSON một dòng thì lọc được bằng lệnh — ví dụ chỉ lấy dòng level=error.
 *
 * Quy ước: info/warn ra stdout, error ra stderr. Nền tảng phân biệt hai luồng
 * này, nhờ đó cảnh báo lỗi mới bắt đúng.
 */
function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  })

  if (level === 'error') process.stderr.write(`${line}\n`)
  else process.stdout.write(`${line}\n`)
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
}
