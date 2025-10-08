async function fetchSummary(sheetTitle) {
  const params = new URLSearchParams()
  if (sheetTitle) {
    params.set('sheetTitle', sheetTitle)
  }
  const response = await fetch(`/api/dashboard/summary?${params.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Falha ao carregar resumo do dashboard.')
  }
  return response.json()
}

function renderStatus(statusBreakdown) {
  const grid = document.querySelector('#status-grid')
  grid.innerHTML = ''
  const entries = Object.entries(statusBreakdown)
  if (entries.length === 0) {
    grid.innerHTML = '<p class="empty">Nenhum status encontrado na planilha.</p>'
    return
  }
  entries.forEach(([label, value]) => {
    const div = document.createElement('div')
    div.className = 'status-item'
    div.innerHTML = `
      <span class="status-item__label">${label}</span>
      <span class="status-item__value">${value}</span>
    `
    grid.appendChild(div)
  })
}

function renderTableBody(selector, rows, emptyMessage) {
  const tbody = document.querySelector(selector)
  tbody.innerHTML = ''
  if (!rows || rows.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    const table = tbody.closest('table')
    const columnCount = table ? table.querySelectorAll('thead th').length : 1
    td.colSpan = columnCount
    td.className = 'empty'
    td.textContent = emptyMessage
    tr.appendChild(td)
    tbody.appendChild(tr)
    return
  }

  rows.forEach(row => {
    const tr = document.createElement('tr')
    Object.values(row).forEach(value => {
      const td = document.createElement('td')
      td.textContent = value || '—'
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
}

function updateSummary(summary) {
  document.querySelector('#drive-count').textContent = summary.totals.drivePatients
  document.querySelector('#sheet-count').textContent = summary.totals.sheetEntries
  document.querySelector('#pending-count').textContent = summary.pending.length
  document.querySelector('#pending-total').textContent = `${summary.pending.length} paciente(s)`
  document.querySelector('#status-total').textContent = `${summary.totals.sheetEntries} registro(s)`
  document.querySelector('#recent-total').textContent = `${summary.recentFolders.length} pasta(s)`
  document.querySelector('#last-sync').textContent = new Date(summary.lastSync).toLocaleString('pt-BR')

  renderStatus(summary.statusBreakdown)

  renderTableBody(
    '#pending-body',
    summary.pending.map(item => ({
      Paciente: item.patient,
      'Data de criação': item.createdTime,
      'ID da pasta': item.folderId,
    })),
    'Nenhum paciente pendente encontrado.',
  )

  renderTableBody(
    '#recent-body',
    summary.recentFolders.map(item => ({
      Paciente: item.patient,
      'Criado em': item.createdTime,
      'Modificado em': item.modifiedTime,
      'ID da pasta': item.folderId,
    })),
    'Nenhuma pasta recente encontrada.',
  )
}

async function loadDashboard() {
  const sheetTitleInput = document.querySelector('#sheet-title')
  const sheetTitle = sheetTitleInput.value.trim()
  const button = document.querySelector('#refresh')
  button.disabled = true
  button.textContent = 'Atualizando...'
  try {
    const summary = await fetchSummary(sheetTitle)
    updateSummary(summary)
  } catch (error) {
    alert(error.message)
  } finally {
    button.disabled = false
    button.textContent = 'Atualizar'
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#refresh').addEventListener('click', loadDashboard)
  loadDashboard()
})
