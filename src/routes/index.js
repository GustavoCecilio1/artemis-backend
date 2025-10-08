import driveRoutes from './driveRoutes.js'
import sheetsRoutes from './sheetsRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'

export default function registerRoutes(app) {
  app.use('/api/drive', driveRoutes)
  app.use('/api/sheets', sheetsRoutes)
  app.use('/api/dashboard', dashboardRoutes)
}
