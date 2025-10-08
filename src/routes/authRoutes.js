import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.post('/login', authController.login)
router.get('/session', requireAuth(), authController.session)
router.post('/logout', requireAuth(), authController.logout)

export default router
