import * as sheetsService from '../services/sheetsService.js'

export async function getRows(req, res, next) {
  try {
    const range = req.query.range?.toString()
    const rows = await sheetsService.getRows(range)
    res.json(rows)
  } catch (error) {
    next(error)
  }
}

export async function appendRows(req, res, next) {
  try {
    const { values, range } = req.body
    await sheetsService.appendRows(values, range)
    res.status(201).json({ message: 'Linhas adicionadas com sucesso.' })
  } catch (error) {
    next(error)
  }
}

export async function updateRange(req, res, next) {
  try {
    const { range, values } = req.body
    await sheetsService.updateRange(range, values)
    res.status(200).json({ message: 'Atualização realizada com sucesso.' })
  } catch (error) {
    next(error)
  }
}

export async function clearRange(req, res, next) {
  try {
    const { range } = req.body
    await sheetsService.clearRange(range)
    res.status(200).json({ message: 'Intervalo limpo com sucesso.' })
  } catch (error) {
    next(error)
  }
}

export async function setupTable(req, res, next) {
  try {
    const result = await sheetsService.setupTable(req.body)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}
