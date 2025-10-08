import express from 'express'
import cors from 'cors'
import registerRoutes from './routes/index.js'
import config from './config/index.js'
import AppError from './utils/AppError.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(express.static('public'))

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: config.env, timestamp: new Date().toISOString() })
  })

  registerRoutes(app)

  app.use((err, req, res, next) => {
    const status = err instanceof AppError ? err.statusCode : 500
    const payload = {
      message: err.message ?? 'Erro inesperado no servidor.',
    }
    if (err.details) {
      payload.details = err.details
    }
    if (config.env !== 'production') {
      payload.stack = err.stack
    }
    console.error('Erro na requisição:', err)
    res.status(status).json(payload)
  })

  return app
}

export default createApp
