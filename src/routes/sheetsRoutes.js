import { Router } from 'express'
import * as sheetsController from '../controllers/sheetsController.js'

const router = Router()

router.get('/rows', sheetsController.getRows)
router.post('/append', sheetsController.appendRows)
router.post('/update', sheetsController.updateRange)
router.post('/clear', sheetsController.clearRange)
router.post('/setup-table', sheetsController.setupTable)

export default router
