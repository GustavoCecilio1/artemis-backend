import * as driveService from '../services/driveService.js'

export async function getPatientFolder(req, res, next) {
  try {
    const { patientId } = req.params
    const createIfMissing = req.query.create !== 'false'
    const folder = await driveService.getPatientFolder(patientId, { createIfMissing })
    res.json(folder)
  } catch (error) {
    next(error)
  }
}

export async function uploadPatientFile(req, res, next) {
  try {
    const { patientId } = req.params
    const result = await driveService.uploadFileToPatient(patientId, req.file)
    res.status(201).json(result)
  } catch (error) {
    next(error)
  }
}
