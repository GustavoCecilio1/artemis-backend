import driveRoutes from './driveRoutes.js'
import sheetsRoutes from './sheetsRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import authRoutes from './authRoutes.js'

export default function registerRoutes(app) {
  app.use('/api/auth', authRoutes)
  app.use('/api/drive', driveRoutes)
  app.use('/api/sheets', sheetsRoutes)
  app.use('/api/dashboard', dashboardRoutes)
}
