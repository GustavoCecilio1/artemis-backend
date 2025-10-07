import { Router } from 'express'
import { sheets } from './googleAuth.js'

const router = Router()
const spreadsheetId = process.env.SHEETS_CONTROL_ID

if (!spreadsheetId) {
  console.warn('⚠️  A variável SHEETS_CONTROL_ID não está definida. As rotas do Sheets exigem esse valor.')
}

const defaultHeaders = ['Paciente', 'Medico', 'Status', 'Data de envio (HRCA)', 'Data do envio (LAUDO)']

async function getSheetInfoByTitle(sheetTitle) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title),bandedRanges(bandedRangeId))',
  })
  return metadata.data.sheets?.find(s => s.properties?.title === sheetTitle)
}

router.get('/rows', async (req, res) => {
  try {
    if (!spreadsheetId) {
      return res.status(500).json({ message: 'SHEETS_CONTROL_ID não configurado.' })
    }
    const range = req.query.range?.toString() ?? 'Controle!A:F'
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })
    res.json(response.data.values ?? [])
  } catch (error) {
    console.error('Erro ao ler planilha', error)
    res.status(500).json({ message: 'Erro ao acessar Google Sheets', details: error.message })
  }
})

router.post('/append', async (req, res) => {
  try {
    if (!spreadsheetId) {
      return res.status(500).json({ message: 'SHEETS_CONTROL_ID não configurado.' })
    }
    const { values, range } = req.body
    if (!Array.isArray(values)) {
      return res.status(400).json({ message: 'Envie "values" como array de arrays.' })
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: range ?? 'Controle!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    })
    res.status(201).json({ message: 'Linhas adicionadas com sucesso.' })
  } catch (error) {
    console.error('Erro ao escrever na planilha', error)
    res.status(500).json({ message: 'Erro ao gravar no Google Sheets', details: error.message })
  }
})

router.post('/update', async (req, res) => {
  try {
    if (!spreadsheetId) {
      return res.status(500).json({ message: 'SHEETS_CONTROL_ID não configurado.' })
    }
    const { range, values } = req.body
    if (!range || !Array.isArray(values)) {
      return res.status(400).json({ message: 'Envie "range" e "values" (array de arrays).' })
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    })
    res.status(200).json({ message: 'Atualização realizada com sucesso.' })
  } catch (error) {
    console.error('Erro ao atualizar planilha', error)
    res.status(500).json({ message: 'Erro ao atualizar Google Sheets', details: error.message })
  }
})

router.post('/clear', async (req, res) => {
  try {
    if (!spreadsheetId) {
      return res.status(500).json({ message: 'SHEETS_CONTROL_ID não configurado.' })
    }
    const { range } = req.body
    if (!range) {
      return res.status(400).json({ message: 'Informe "range" para limpar.' })
    }
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    })
    res.status(200).json({ message: 'Intervalo limpo com sucesso.' })
  } catch (error) {
    console.error('Erro ao limpar planilha', error)
    res.status(500).json({ message: 'Erro ao limpar Google Sheets', details: error.message })
  }
})

export default router

router.post('/setup-table', async (req, res) => {
  try {
    if (!spreadsheetId) {
      return res.status(500).json({ message: 'SHEETS_CONTROL_ID não configurado.' })
    }

    const {
      sheetTitle = 'Pagina1',
      headers = defaultHeaders,
      clearRange = `${sheetTitle}!A1:Z1000`,
    } = req.body ?? {}

    if (!Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({ message: 'Envie "headers" como array com pelo menos um título.' })
    }

    const sheetInfo = await getSheetInfoByTitle(sheetTitle)
    const sheetId = sheetInfo?.properties?.sheetId
    if (sheetId === undefined) {
      return res.status(404).json({ message: `A aba "${sheetTitle}" não foi encontrada.` })
    }
    const existingBandings = sheetInfo?.bandedRanges ?? []

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: clearRange,
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId,
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
      spreadsheetId,
      requestBody: { requests: allRequests },
    })

    res.status(200).json({ message: 'Planilha formatada com sucesso.', headers, sheetTitle })
  } catch (error) {
    console.error('Erro ao configurar planilha', error)
    res.status(500).json({ message: 'Erro ao configurar planilha', details: error.message })
  }
})
