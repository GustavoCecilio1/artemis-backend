import config from './config/index.js'
import { createApp } from './app.js'

const app = createApp()

const port = config.port

app.listen(port, () => {
  console.log(`✅ Backend Ártemis ↔ HRCA rodando na porta ${port}`)
})
