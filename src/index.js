import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import driveRoutes from './driveRoutes.js'
import sheetsRoutes from './sheetsRoutes.js'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/drive', driveRoutes)
app.use('/api/sheets', sheetsRoutes)

const port = process.env.PORT ?? 4000

app.listen(port, () => {
  console.log(`✅ Backend Ártemis ↔ HRCA rodando na porta ${port}`)
})
