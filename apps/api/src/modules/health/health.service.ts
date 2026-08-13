import type { HealthResponse } from '@uniwork/shared'
import { APP_VERSION } from '../../config/env.js'

/**
 * Endpoint này bị cron-job.org gọi mỗi 5 phút suốt ngày đêm để Render không ngủ.
 *
 * Vì vậy nó phải **cực nhẹ và tuyệt đối không chạm database**. Nếu có một câu
 * truy vấn ở đây, mỗi lần ping sẽ đánh thức luôn compute của Neon và đốt hết
 * hạn mức giờ miễn phí trong khi chẳng ai dùng app.
 *
 * `uptime` là số giây process đã chạy. Con số này reset về gần 0 mỗi lần Render
 * đánh thức instance — nhìn vào đó biết được service vừa ngủ dậy hay chạy liên tục.
 */
export function getHealth(): HealthResponse {
  return {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    version: APP_VERSION,
  }
}
