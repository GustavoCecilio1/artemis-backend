import * as dashboardService from '../services/dashboardService.js'

export async function getSummary(req, res, next) {
  try {
    const { sheetTitle, limit } = req.query
    const summary = await dashboardService.getDashboardSummary({
      sheetTitle: sheetTitle?.toString() ?? 'Pagina1',
      recentLimit: limit ? Number.parseInt(limit, 10) || undefined : undefined,
    })
    res.json(summary)
  } catch (error) {
    next(error)
  }
}
