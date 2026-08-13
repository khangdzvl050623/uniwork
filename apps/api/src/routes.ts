import { Router } from 'express'
import { healthRoutes } from './modules/health/health.routes.js'

/**
 * Gom router của tất cả module lại, gắn dưới tiền tố /api.
 *
 * Mỗi module tự khai đường dẫn tương đối của mình, chỗ này quyết định nó nằm ở
 * đâu. Muốn đổi /api thành /api/v1 thì sửa đúng một dòng trong app.ts.
 */
export const apiRouter = Router()

apiRouter.use('/health', healthRoutes)
