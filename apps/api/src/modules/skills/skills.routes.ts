import { Router } from 'express'
import { listSkillsController } from './skills.controller.js'

export const skillsRoutes = Router()

skillsRoutes.get('/', listSkillsController)
