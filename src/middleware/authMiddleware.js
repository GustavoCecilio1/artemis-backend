import AppError from '../utils/AppError.js'
import { validateSession } from '../services/authService.js'

export function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim()

    if (!token) {
      return next(new AppError('Autenticação necessária.', 401))
    }

    try {
      const user = validateSession(token)
      if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return next(new AppError('Acesso negado para o recurso solicitado.', 403))
      }
      req.user = user
      req.authToken = token
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

export default requireAuth
