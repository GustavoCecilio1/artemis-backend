import { Readable } from 'stream'
import config from '../config/index.js'
import AppError from '../utils/AppError.js'
import { drive } from '../googleAuth.js'
import { ensureFolderAccessible, applyDriveOptions } from '../driveHelpers.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function resolveRootFolderId(override) {
  const rootFolderId = override ?? config.drive.rootFolderId
  if (!rootFolderId) {
    throw new AppError('DRIVE_ROOT_FOLDER_ID não configurado.', 500)
  }
  return rootFolderId
}

function sanitizeFolderName(name) {
  return name.replace(/'/g, "\\'")
}

function buildFolderName(patientId) {
  return `Paciente_${patientId}`
}

export async function getRootFolderInfo(rootFolderId) {
  const resolvedRootFolderId = resolveRootFolderId(rootFolderId)
  return ensureFolderAccessible(resolvedRootFolderId)
}

export async function findPatientFolder(patientId, rootInfo, rootFolderId) {
  const resolvedRootFolderId = resolveRootFolderId(rootFolderId)
  const folderName = buildFolderName(patientId)
  const queryParts = [
    `'${resolvedRootFolderId}' in parents`,
    `mimeType = '${FOLDER_MIME}'`,
    `name = '${sanitizeFolderName(folderName)}'`,
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

export async function ensurePatientFolder(patientId, { rootFolderId } = {}) {
  if (!patientId) {
    throw new AppError('Informe patientId na URL.', 400)
  }
  const resolvedRootFolderId = resolveRootFolderId(rootFolderId)
  const rootInfo = await getRootFolderInfo(resolvedRootFolderId)
  const existing = await findPatientFolder(patientId, rootInfo, resolvedRootFolderId)
  if (existing) {
    return existing
  }
  const response = await drive.files.create({
    requestBody: {
      name: buildFolderName(patientId),
      mimeType: FOLDER_MIME,
      parents: [resolvedRootFolderId],
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  })
  return response.data
}

export async function getPatientFolder(patientId, { createIfMissing = true, rootFolderId } = {}) {
  if (!patientId) {
    throw new AppError('Informe patientId na URL.', 400)
  }
  const resolvedRootFolderId = resolveRootFolderId(rootFolderId)
  const rootInfo = await getRootFolderInfo(resolvedRootFolderId)
  let folder = await findPatientFolder(patientId, rootInfo, resolvedRootFolderId)
  if (!folder && createIfMissing) {
    folder = await ensurePatientFolder(patientId, { rootFolderId: resolvedRootFolderId })
  }
  if (!folder) {
    throw new AppError('Pasta não encontrada e create=false.', 404)
  }
  return folder
}

export async function uploadFileToPatient(patientId, file, options = {}) {
  if (!file) {
    throw new AppError('Envie um arquivo no campo "file".', 400)
  }
  const folder = await ensurePatientFolder(patientId, options)
  const fileMetadata = {
    name: file.originalname,
    parents: [folder.id],
  }
  const media = {
    mimeType: file.mimetype,
    body: Readable.from(file.buffer),
  }
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  })
  return {
    folderId: folder.id,
    file: response.data,
  }
}

const EXCLUDE_NAMES = new Set(['Modelos', 'Templates'])

function normalizePatientName(folderName) {
  return folderName.replace(/^Paciente[_-]/i, '').trim()
}

export async function listPatientFolders(rootFolderId) {
  const resolvedRootFolderId = resolveRootFolderId(rootFolderId)
  const rootInfo = await getRootFolderInfo(resolvedRootFolderId)
  const q = [
    `'${resolvedRootFolderId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ')

  let folders = []
  let pageToken

  do {
    const response = await drive.files.list(
      applyDriveOptions(
        {
          q,
          fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
          orderBy: 'createdTime desc',
          pageToken,
          pageSize: 100,
        },
        rootInfo,
      ),
    )
    const batch = response.data.files?.filter(f => !EXCLUDE_NAMES.has(f.name)) ?? []
    folders = folders.concat(batch)
    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return folders.map(folder => ({
    id: folder.id,
    name: folder.name,
    createdTime: folder.createdTime,
    modifiedTime: folder.modifiedTime,
    patient: normalizePatientName(folder.name),
  }))
}
