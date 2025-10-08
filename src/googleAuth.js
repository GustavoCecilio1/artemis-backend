import { google } from 'googleapis'
import path from 'path'
import fs from 'fs'
import config from './config/index.js'

let keyFile = config.google.credentialsPath

if (!keyFile) {
  const jsonContent = config.google.credentialsJson
  if (!jsonContent) {
    throw new Error(
      'Defina GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_SERVICE_ACCOUNT_JSON com o conteúdo da service account.',
    )
  }
  const tmpPath = path.resolve('/tmp/google-service-account.json')
  try {
    fs.writeFileSync(tmpPath, jsonContent)
    keyFile = tmpPath
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile
  } catch (error) {
    throw new Error(`Falha ao criar arquivo de credenciais temporário: ${error.message}`)
  }
}

const resolvedKeyFile = path.isAbsolute(keyFile) ? keyFile : path.resolve(process.cwd(), keyFile)

if (!fs.existsSync(resolvedKeyFile)) {
  throw new Error(
    `Arquivo de credenciais não encontrado em ${resolvedKeyFile}. Informe um caminho válido ou preencha GOOGLE_SERVICE_ACCOUNT_JSON.`,
  )
}

const scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
]

export const auth = new google.auth.GoogleAuth({
  keyFile: resolvedKeyFile,
  scopes,
})

export const drive = google.drive({ version: 'v3', auth })
export const sheets = google.sheets({ version: 'v4', auth })
