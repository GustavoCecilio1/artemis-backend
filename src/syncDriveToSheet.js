import config from './config/index.js'
import * as driveService from './services/driveService.js'
import * as sheetsService from './services/sheetsService.js'

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
  rootFolderId = config.drive.rootFolderId,
  spreadsheetId = config.sheets.controlSpreadsheetId,
  sheetTitle = 'Pagina1',
} = {}) {
  if (!rootFolderId) throw new Error('Informe rootFolderId')
  if (!spreadsheetId) throw new Error('Informe spreadsheetId')

  const folders = await driveService.listPatientFolders(rootFolderId)
  const sheetRows = await sheetsService.getPatientMap(sheetTitle, spreadsheetId)

  const newEntries = []

  folders.forEach(folder => {
    const key = folder.patient?.toLowerCase()
    if (!folder.patient || !key) return
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

  await sheetsService.appendRows(newEntries, `${sheetTitle}!A1`, spreadsheetId)

  return { added: newEntries.length }
}

if (process.argv[1] && process.argv[1].includes('syncDriveToSheet')) {
  const rootFolderId = config.drive.rootFolderId
  const spreadsheetId = config.sheets.controlSpreadsheetId

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
