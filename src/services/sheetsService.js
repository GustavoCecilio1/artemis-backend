import config from '../config/index.js'
import AppError from '../utils/AppError.js'
import { sheets } from '../googleAuth.js'

const defaultHeaders = ['Paciente', 'Medico', 'Status', 'Data de envio (HRCA)', 'Data do envio (LAUDO)']

function resolveSpreadsheetId(override) {
  const spreadsheetId = override ?? config.sheets.controlSpreadsheetId
  if (!spreadsheetId) {
    throw new AppError('SHEETS_CONTROL_ID não configurado.', 500)
  }
  return spreadsheetId
}

export async function getRows(range = 'Controle!A:F', spreadsheetId) {
  const resolvedSpreadsheetId = resolveSpreadsheetId(spreadsheetId)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: resolvedSpreadsheetId,
    range,
  })
  return response.data.values ?? []
}

export async function appendRows(values, range = 'Controle!A:F', spreadsheetId) {
  if (!Array.isArray(values)) {
    throw new AppError('Envie "values" como array de arrays.', 400)
  }
  const resolvedSpreadsheetId = resolveSpreadsheetId(spreadsheetId)
  await sheets.spreadsheets.values.append({
    spreadsheetId: resolvedSpreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
}

export async function updateRange(range, values, spreadsheetId) {
  if (!range || !Array.isArray(values)) {
    throw new AppError('Envie "range" e "values" (array de arrays).', 400)
  }
  const resolvedSpreadsheetId = resolveSpreadsheetId(spreadsheetId)
  await sheets.spreadsheets.values.update({
    spreadsheetId: resolvedSpreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
}

export async function clearRange(range, spreadsheetId) {
  if (!range) {
    throw new AppError('Informe "range" para limpar.', 400)
  }
  const resolvedSpreadsheetId = resolveSpreadsheetId(spreadsheetId)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: resolvedSpreadsheetId,
    range,
  })
}

async function getSheetInfoByTitle(spreadsheetId, sheetTitle) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title),bandedRanges(bandedRangeId))',
  })
  return metadata.data.sheets?.find(s => s.properties?.title === sheetTitle)
}

export async function setupTable({
  sheetTitle = 'Pagina1',
  headers = defaultHeaders,
  clearRange,
  spreadsheetId,
} = {}) {
  const resolvedSpreadsheetId = resolveSpreadsheetId(spreadsheetId)

  if (!Array.isArray(headers) || headers.length === 0) {
    throw new AppError('Envie "headers" como array com pelo menos um título.', 400)
  }

  const sheetInfo = await getSheetInfoByTitle(resolvedSpreadsheetId, sheetTitle)
  const sheetId = sheetInfo?.properties?.sheetId
  if (sheetId === undefined) {
    throw new AppError(`A aba "${sheetTitle}" não foi encontrada.`, 404)
  }
  const existingBandings = sheetInfo?.bandedRanges ?? []

  const targetClearRange = clearRange ?? `${sheetTitle}!A1:Z1000`

  await sheets.spreadsheets.values.clear({
    spreadsheetId: resolvedSpreadsheetId,
    range: targetClearRange,
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: resolvedSpreadsheetId,
    range: `${sheetTitle}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  })

  const headerBackground = { red: 0.141, green: 0.341, blue: 0.6 }
  const headerTextColor = { red: 1, green: 1, blue: 1 }
  const firstBandColor = { red: 0.949, green: 0.964, blue: 0.988 }
  const secondBandColor = { red: 1, green: 1, blue: 1 }

  const deleteBandingRequests = existingBandings.map(b => ({
    deleteBanding: { bandedRangeId: b.bandedRangeId },
  }))

  const requests = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
            columnCount: headers.length,
          },
        },
        fields: 'gridProperties.frozenRowCount,gridProperties.columnCount',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBackground,
            textFormat: {
              foregroundColor: headerTextColor,
              bold: true,
            },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    {
      addBanding: {
        bandedRange: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length,
          },
          rowProperties: {
            firstBandColor,
            secondBandColor,
          },
        },
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: headers.length,
        },
        properties: {
          pixelSize: 220,
        },
        fields: 'pixelSize',
      },
    },
  ]

  const allRequests = [...deleteBandingRequests, ...requests]

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: resolvedSpreadsheetId,
    requestBody: { requests: allRequests },
  })

  return { message: 'Planilha formatada com sucesso.', headers, sheetTitle }
}

export async function getPatientMap(sheetTitle = 'Pagina1', spreadsheetId) {
  const resolvedSpreadsheetId = resolveSpreadsheetId(spreadsheetId)
  const range = `${sheetTitle}!A2:E`
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: resolvedSpreadsheetId,
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
