import dotenv from 'dotenv'

dotenv.config()

function parseUsers() {
  if (process.env.DASHBOARD_USERS) {
    try {
      const raw = JSON.parse(process.env.DASHBOARD_USERS)
      if (Array.isArray(raw)) {
        const parsed = raw
          .map(entry => ({
            username: entry.username,
            password: entry.password,
            role: entry.role,
            displayName: entry.displayName ?? entry.username,
          }))
          .filter(user => user.username && user.password && user.role)
        if (parsed.length > 0) {
          return parsed
        }
        console.warn('⚠️  DASHBOARD_USERS não contém usuários válidos. Recuo para configuração padrão.')
      }
    } catch (error) {
      console.warn('⚠️  Falha ao interpretar DASHBOARD_USERS. Recuo para configuração padrão.', error)
    }
  }

  function buildFallbackUser({ username, role, envKey, defaultPassword, displayName }) {
    const password = process.env[envKey] ?? defaultPassword
    if (!process.env[envKey]) {
      console.warn(
        `⚠️  ${envKey} não definida. Usando senha padrão para ${username}. Configure a variável para produção.`,
      )
    }
    return {
      username,
      password,
      role,
      displayName,
    }
  }

  return [
    buildFallbackUser({
      username: 'admin',
      role: 'admin',
      envKey: 'DASHBOARD_ADMIN_PASSWORD',
      defaultPassword: 'admin123',
      displayName: 'Administrador',
    }),
    buildFallbackUser({
      username: 'operacoes',
      role: 'operations',
      envKey: 'DASHBOARD_OPERATIONS_PASSWORD',
      defaultPassword: 'operacoes123',
      displayName: 'Operações',
    }),
    buildFallbackUser({
      username: 'revisor',
      role: 'reviewer',
      envKey: 'DASHBOARD_REVIEWER_PASSWORD',
      defaultPassword: 'revisor123',
      displayName: 'Revisor',
    }),
    buildFallbackUser({
      username: 'medico',
      role: 'doctor',
      envKey: 'DASHBOARD_DOCTOR_PASSWORD',
      defaultPassword: 'medico123',
      displayName: 'Médico',
    }),
    buildFallbackUser({
      username: 'hrca',
      role: 'hrca',
      envKey: 'DASHBOARD_HRCA_PASSWORD',
      defaultPassword: 'hrca123',
      displayName: 'HRCA',
    }),
  ]
}

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
  auth: {
    sessionTtlMs: Number.parseInt(process.env.AUTH_SESSION_TTL ?? '14400000', 10),
    users: parseUsers(),
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
