import { drive } from './googleAuth.js'

export async function getFolderInfo(folderId) {
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,driveId',
    supportsAllDrives: true,
  })
  return response.data
}

export function applyDriveOptions(params, folderInfo) {
  const base = {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }
  if (folderInfo?.driveId) {
    base.corpora = 'drive'
    base.driveId = folderInfo.driveId
  } else {
    base.corpora = 'user'
  }
  return { ...params, ...base }
}

export async function ensureFolderAccessible(folderId) {
  try {
    return await getFolderInfo(folderId)
  } catch (error) {
    const message = error?.errors?.[0]?.message || error?.message
    const err = new Error(
      `Não foi possível acessar a pasta raiz ${folderId}. ` +
        'Verifique se o ID está correto e se a service account possui permissão (Editor) na pasta ou no Drive compartilhado. ' +
        `Detalhes: ${message}`,
    )
    err.original = error
    throw err
  }
}

export { drive }
