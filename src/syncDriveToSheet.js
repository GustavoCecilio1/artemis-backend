import { drive, sheets } from './googleAuth.js'
import { ensureFolderAccessible, applyDriveOptions } from './driveHelpers.js'

const EXCLUDE_NAMES = new Set(['Modelos', 'Templates'])

function normalizePatientName(folderName) {
  return folderName.replace(/^Paciente[_-]/i, '').trim()
}

export async function listPatientFolders(rootFolderId, rootInfo) {
  const folderInfo = rootInfo ?? (await ensureFolderAccessible(rootFolderId))
  const q = [
    `'${rootFolderId}' in parents`,
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
        folderInfo,
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

export async function readSheetData(spreadsheetId, sheetTitle) {
  const range = `${sheetTitle}!A2:E`
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })
  const rows = response.data.values ?? []
  const map = new Map()
  rows.forEach((row, index) => {
    const [paciente, medico, status, dataEnvioHRCA, dataEnvioLaudo] = row
    if (!paciente) return
    map.set(paciente.toLowerCase(), {
      rowIndex: index + 2,
      paciente,
      medico,
      status,
      dataEnvioHRCA,
      dataEnvioLaudo,
    })
  })
  return map
}

function formatDate(isoDate) {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export async function syncDriveToSheet({
  rootFolderId,
  spreadsheetId,
  sheetTitle = 'Pagina1',
} = {}) {
  if (!rootFolderId) throw new Error('Informe rootFolderId')
  if (!spreadsheetId) throw new Error('Informe spreadsheetId')

  const rootInfo = await ensureFolderAccessible(rootFolderId)
  const folders = await listPatientFolders(rootFolderId, rootInfo)
  const sheetRows = await readSheetData(spreadsheetId, sheetTitle)

  const newEntries = []

  folders.forEach(folder => {
    const key = folder.patient.toLowerCase()
    if (!folder.patient) return
    if (!sheetRows.has(key)) {
      newEntries.push([
        folder.patient,
        '',
        'Novo',
        formatDate(folder.createdTime),
        '',
      ])
    }
  })

  if (newEntries.length === 0) {
    return { added: 0 }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetTitle}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: newEntries },
  })

  return { added: newEntries.length }
}

if (process.argv[1] && process.argv[1].includes('syncDriveToSheet')) {
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID
  const spreadsheetId = process.env.SHEETS_CONTROL_ID

  syncDriveToSheet({ rootFolderId, spreadsheetId })
    .then(result => {
      console.log(`Sincronização concluída. Novos pacientes adicionados: ${result.added}`)
      process.exit(0)
    })
    .catch(err => {
      console.error('Erro ao sincronizar Drive e Sheets:', err)
      process.exit(1)
    })
}
