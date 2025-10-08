import * as driveService from './driveService.js'
import * as sheetsService from './sheetsService.js'

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

export async function getDashboardSummary({ sheetTitle = 'Pagina1', recentLimit = 6 } = {}) {
  const [folders, sheetMap] = await Promise.all([
    driveService.listPatientFolders(),
    sheetsService.getPatientMap(sheetTitle),
  ])

  const totals = {
    drivePatients: folders.length,
    sheetEntries: sheetMap.size,
  }

  const pending = folders
    .filter(folder => folder.patient && !sheetMap.has(folder.patient.toLowerCase()))
    .map(folder => ({
      patient: folder.patient,
      createdTime: formatDate(folder.createdTime),
      folderId: folder.id,
    }))

  const recentFolders = [...folders]
    .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
    .slice(0, recentLimit)
    .map(folder => ({
      patient: folder.patient,
      createdTime: formatDate(folder.createdTime),
      modifiedTime: formatDate(folder.modifiedTime),
      folderId: folder.id,
    }))

  const statusBreakdown = {}
  sheetMap.forEach(entry => {
    const key = entry.status?.trim() || 'Sem status'
    statusBreakdown[key] = (statusBreakdown[key] ?? 0) + 1
  })

  return {
    totals,
    pending,
    recentFolders,
    statusBreakdown,
    lastSync: new Date().toISOString(),
  }
}
