import * as dashboardService from '../services/dashboardService.js'

export async function getSummary(req, res, next) {
  try {
    const { sheetTitle } = req.query
    const summary = await dashboardService.getDashboardSummary({
      sheetTitle: sheetTitle?.toString() ?? 'Pagina1',
      role: req.user?.role ?? 'admin',
    })
    res.json({
      ...summary,
      role: req.user?.role ?? summary.role ?? 'admin',
      viewer: req.user ?? null,
    })
  } catch (error) {
    next(error)
  }
}
