import { Router } from 'express'
import { healthController } from './health.controller.js'

export const healthRoutes = Router()

healthRoutes.get('/', healthController)
