import { Router } from 'express'
import multer from 'multer'
import { Readable } from 'stream'
import { drive } from './googleAuth.js'
import { ensureFolderAccessible, applyDriveOptions } from './driveHelpers.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID

if (!rootFolderId) {
  console.warn('⚠️  A variável DRIVE_ROOT_FOLDER_ID não está definida. As rotas do Drive exigem esse valor.')
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

async function findFolderByName(name, rootInfo) {
  const queryParts = [
    `'${rootFolderId}' in parents`,
    `mimeType = '${FOLDER_MIME}'`,
    `name = '${name.replace(/'/g, "\\'")}'`,
    'trashed = false',
  ]
  const response = await drive.files.list(
    applyDriveOptions(
      {
        q: queryParts.join(' and '),
        fields: 'files(id, name, webViewLink)',
        pageSize: 1,
      },
      rootInfo,
    ),
  )
  return response.data.files?.[0] ?? null
}

async function ensureFolder(patientId) {
  if (!rootFolderId) {
    throw new Error('DRIVE_ROOT_FOLDER_ID não configurado.')
  }
  const folderName = `Paciente_${patientId}`
  const rootInfo = await ensureFolderAccessible(rootFolderId)
  const existing = await findFolderByName(folderName, rootInfo)
  if (existing) {
    return existing
  }
  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: FOLDER_MIME,
      parents: [rootFolderId],
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  })
  return response.data
}

router.get('/patients/:patientId/folder', async (req, res) => {
  try {
    const { patientId } = req.params
    const createIfMissing = req.query.create !== 'false'
    if (!patientId) {
      return res.status(400).json({ message: 'Informe patientId na URL.' })
    }
    const folderName = `Paciente_${patientId}`
    const rootInfo = await ensureFolderAccessible(rootFolderId)
    let folder = await findFolderByName(folderName, rootInfo)
    if (!folder && createIfMissing) {
      folder = await ensureFolder(patientId)
    }
    if (!folder) {
      return res.status(404).json({ message: 'Pasta não encontrada e create=false.' })
    }
    res.json(folder)
  } catch (error) {
    console.error('Erro ao buscar/garantir pasta', error)
    res.status(500).json({ message: 'Erro ao acessar Google Drive', details: error.message })
  }
})

router.post('/patients/:patientId/upload', upload.single('file'), async (req, res) => {
  try {
    const { patientId } = req.params
    if (!patientId) {
      return res.status(400).json({ message: 'Informe patientId na URL.' })
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Envie um arquivo no campo "file".' })
    }
    const folder = await ensureFolder(patientId)
    const fileMetadata = {
      name: req.file.originalname,
      parents: [folder.id],
    }
    const stream = Readable.from(req.file.buffer)
    const media = {
      mimeType: req.file.mimetype,
      body: stream,
    }
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    })
    res.status(201).json({
      folderId: folder.id,
      file: response.data,
    })
  } catch (error) {
    console.error('Erro ao fazer upload para o Drive', error)
    res.status(500).json({ message: 'Erro ao enviar arquivo', details: error.message })
  }
})

export default router
