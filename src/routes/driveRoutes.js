import { Router } from 'express'
import multer from 'multer'
import * as driveController from '../controllers/driveController.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/patients/:patientId/folder', driveController.getPatientFolder)
router.post('/patients/:patientId/upload', upload.single('file'), driveController.uploadPatientFile)

export default router
