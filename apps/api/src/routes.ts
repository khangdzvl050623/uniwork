import { Router } from 'express'
import { authRoutes } from './modules/auth/auth.routes.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { skillsRoutes } from './modules/skills/skills.routes.js'

/**
 * Gom router của tất cả module lại, gắn dưới tiền tố /api.
 *
 * Mỗi module tự khai đường dẫn tương đối của mình, chỗ này quyết định nó nằm ở
 * đâu. Muốn đổi /api thành /api/v1 thì sửa đúng một dòng trong app.ts.
 */
export const apiRouter = Router()

apiRouter.use('/health', healthRoutes)
apiRouter.use('/auth', authRoutes)
apiRouter.use('/skills', skillsRoutes)
