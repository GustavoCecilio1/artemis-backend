import { Router } from 'express'
import * as dashboardController from '../controllers/dashboardController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/summary', requireAuth(), dashboardController.getSummary)

export default router
