import * as authService from '../services/authService.js'

export async function login(req, res, next) {
  try {
    const { username, password } = req.body ?? {}
    const result = await authService.authenticate({ username, password })
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function session(req, res, next) {
  try {
    res.json({ user: req.user })
  } catch (error) {
    next(error)
  }
}

export async function logout(req, res, next) {
  try {
    authService.revokeSession(req.authToken)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
