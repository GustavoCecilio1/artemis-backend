import dotenv from 'dotenv'

dotenv.config()

const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  google: {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    credentialsJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  },
  drive: {
    rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID,
  },
  sheets: {
    controlSpreadsheetId: process.env.SHEETS_CONTROL_ID,
  },
}

if (!config.drive.rootFolderId) {
  console.warn(
    '⚠️  A variável DRIVE_ROOT_FOLDER_ID não está definida. As rotas do Drive exigem esse valor.',
  )
}

if (!config.sheets.controlSpreadsheetId) {
  console.warn(
    '⚠️  A variável SHEETS_CONTROL_ID não está definida. As rotas do Google Sheets exigem esse valor.',
  )
}

export default config
