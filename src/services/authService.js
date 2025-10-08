import crypto from 'node:crypto'
import config from '../config/index.js'
import AppError from '../utils/AppError.js'

const sessions = new Map()

function toPublicUser(user) {
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName ?? user.username,
    permissions: {
      canViewAllRoles: user.role === 'admin',
    },
  }
}

function findUser(username) {
  return config.auth.users.find(user => user.username === username)
}

function touchSession(session) {
  session.issuedAt = Date.now()
}

export function authenticate({ username, password }) {
  const normalized = username?.toString().trim() ?? ''
  const providedPassword = password?.toString() ?? ''

  if (!normalized || !providedPassword) {
    throw new AppError('Usuário e senha são obrigatórios.', 400)
  }

  const user = findUser(normalized)
  if (!user || user.password !== providedPassword) {
    throw new AppError('Credenciais inválidas.', 401)
  }

  const token = crypto.randomUUID()
  const session = {
    token,
    username: user.username,
    role: user.role,
    displayName: user.displayName ?? user.username,
    issuedAt: Date.now(),
  }
  sessions.set(token, session)

  return {
    token,
    user: toPublicUser(user),
  }
}

export function validateSession(token) {
  if (!token) {
    throw new AppError('Sessão inválida ou expirada.', 401)
  }

  const session = sessions.get(token)
  if (!session) {
    throw new AppError('Sessão inválida ou expirada.', 401)
  }

  const now = Date.now()
  if (now - session.issuedAt > config.auth.sessionTtlMs) {
    sessions.delete(token)
    throw new AppError('Sessão expirada. Faça login novamente.', 401)
  }

  touchSession(session)

  return {
    username: session.username,
    role: session.role,
    displayName: session.displayName,
    permissions: {
      canViewAllRoles: session.role === 'admin',
    },
  }
}

export function revokeSession(token) {
  if (token) {
    sessions.delete(token)
  }
}

export function listRoles() {
  return Array.from(new Set(config.auth.users.map(user => user.role)))
}
