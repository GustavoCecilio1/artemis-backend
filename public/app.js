const numberFormatter = new Intl.NumberFormat('pt-BR')
let currentSummary = null

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

function setText(selector, value) {
  const element = document.querySelector(selector)
  if (element) {
    element.textContent = value
  }
}

function renderKPIs(kpis = []) {
  const container = document.querySelector('#kpi-grid')
  if (!container) return
  container.innerHTML = ''
  if (!kpis.length) {
    container.innerHTML = '<p class="empty">Nenhum KPI disponível.</p>'
    return
  }

  kpis.forEach(kpi => {
    const card = document.createElement('article')
    card.className = 'kpi-card'
    card.innerHTML = `
      <header class="kpi-card__header">
        <span class="kpi-card__label">${kpi.label}</span>
        <span class="kpi-card__description">${kpi.description ?? ''}</span>
      </header>
      <div class="kpi-card__body">
        <strong class="kpi-card__value">${kpi.value}</strong>
        <span class="kpi-card__trend ${kpi.trend?.positive ? 'kpi-card__trend--up' : 'kpi-card__trend--down'}">
          ${kpi.trend?.label ?? ''}
        </span>
      </div>
    `
    container.appendChild(card)
  })
}

function renderRoleViews(roleViews = [], actions = []) {
  const tabs = document.querySelector('#role-tabs')
  const content = document.querySelector('#role-content')
  if (!tabs || !content) return
  tabs.innerHTML = ''
  content.innerHTML = ''

  if (!roleViews.length) {
    content.innerHTML = '<p class="empty">Nenhuma visão configurada.</p>'
    return
  }

  const actionsMap = new Map(actions.map(action => [action.id, action]))
  let activeId = roleViews[0]?.id

  function renderContent(roleId) {
    const role = roleViews.find(item => item.id === roleId) ?? roleViews[0]
    if (!role) {
      content.innerHTML = '<p class="empty">Não foi possível carregar a visão selecionada.</p>'
      return
    }

    const highlights = (role.highlights ?? []).map(highlight => `<span class="pill">${highlight}</span>`).join('')
    const metrics = (role.metrics ?? [])
      .map(metric => `
        <div class="role-metric">
          <span class="role-metric__label">${metric.label}</span>
          <strong class="role-metric__value">${metric.value}</strong>
          ${metric.trend ? `<span class="role-metric__trend ${metric.trend.positive ? 'role-metric__trend--up' : 'role-metric__trend--down'}">${metric.trend.label}</span>` : ''}
        </div>
      `)
      .join('')
    const focus = (role.focus ?? [])
      .map(item => `<li>${item}</li>`)
      .join('')

    const roleActions = (role.actions ?? [])
      .map(actionId => actionsMap.get(actionId))
      .filter(Boolean)
      .map(
        action => `
          <button class="chip chip--action" data-action="${action.id}">
            ${action.label}
          </button>
        `,
      )
      .join('')

    content.innerHTML = `
      <article class="role-card">
        <header>
          <h4>${role.label}</h4>
          <p>${role.summary ?? ''}</p>
        </header>
        <div class="role-highlights">${highlights}</div>
        <div class="role-metrics">${metrics}</div>
        <section class="role-focus">
          <h5>Foco imediato</h5>
          <ul>${focus}</ul>
        </section>
        <footer class="role-actions">
          <h5>Ações sugeridas</h5>
          <div class="chip-group">${roleActions || '<span class="empty">Sem ações sugeridas.</span>'}</div>
        </footer>
      </article>
    `

    content.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', () => handleAction(button.dataset.action))
    })
  }

  roleViews.forEach(role => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `role-tab${role.id === activeId ? ' role-tab--active' : ''}`
    button.textContent = role.label
    button.addEventListener('click', () => {
      activeId = role.id
      tabs.querySelectorAll('.role-tab').forEach(tab => tab.classList.remove('role-tab--active'))
      button.classList.add('role-tab--active')
      renderContent(activeId)
    })
    tabs.appendChild(button)
  })

  renderContent(activeId)
}

function renderTables(tables = {}) {
  const container = document.querySelector('#tables-grid')
  if (!container) return
  container.innerHTML = ''
  const tableEntries = Object.values(tables)
  if (!tableEntries.length) {
    container.innerHTML = '<p class="empty">Nenhuma tabela disponível.</p>'
    return
  }

  tableEntries.forEach(table => {
    const card = document.createElement('article')
    card.className = 'table-card'
    const header = document.createElement('header')
    header.className = 'table-card__header'
    header.innerHTML = `
      <div>
        <h4>${table.title}</h4>
        ${table.subtitle ? `<p>${table.subtitle}</p>` : ''}
      </div>
    `
    card.appendChild(header)

    const wrapper = document.createElement('div')
    wrapper.className = 'table-wrapper'
    const tableEl = document.createElement('table')
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    ;(table.columns ?? []).forEach(column => {
      const th = document.createElement('th')
      th.textContent = column.label
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    tableEl.appendChild(thead)

    const tbody = document.createElement('tbody')
    const rows = table.rows ?? []
    if (!rows.length) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = (table.columns ?? []).length || 1
      td.className = 'empty'
      td.textContent = 'Sem registros para o período.'
      tr.appendChild(td)
      tbody.appendChild(tr)
    } else {
      rows.forEach(row => {
        const tr = document.createElement('tr')
        ;(table.columns ?? []).forEach(column => {
          const td = document.createElement('td')
          td.appendChild(renderCellValue(row[column.key]))
          tr.appendChild(td)
        })
        tbody.appendChild(tr)
      })
    }

    tableEl.appendChild(tbody)
    wrapper.appendChild(tableEl)
    card.appendChild(wrapper)
    container.appendChild(card)
  })
}

function renderCellValue(value) {
  if (value && typeof value === 'object') {
    if (value.type === 'badge') {
      const span = document.createElement('span')
      span.className = `badge badge--${value.tone ?? 'neutral'}`
      span.textContent = value.label ?? ''
      return span
    }
    if (value.type === 'progress') {
      const container = document.createElement('div')
      container.className = 'progress'
      const fill = document.createElement('div')
      fill.className = 'progress__fill'
      const percent = Math.max(0, Math.min(100, value.percent ?? 0))
      fill.style.width = `${percent}%`
      container.appendChild(fill)
      const label = document.createElement('span')
      label.className = 'progress__label'
      label.textContent = `${percent}%`
      container.appendChild(label)
      return container
    }
    if (value.type === 'code') {
      const code = document.createElement('code')
      code.textContent = value.value ?? ''
      return code
    }
  }

  const span = document.createElement('span')
  span.textContent = value ?? '—'
  return span
}

function renderActions(actions = []) {
  const container = document.querySelector('#actions-grid')
  if (!container) return
  container.innerHTML = ''
  if (!actions.length) {
    container.innerHTML = '<p class="empty">Nenhuma ação disponível.</p>'
    return
  }

  actions.forEach(action => {
    const card = document.createElement('article')
    card.className = 'action-card'
    card.innerHTML = `
      <div class="action-card__body">
        <h4>${action.label}</h4>
        <p>${action.description ?? ''}</p>
      </div>
      <button type="button" class="action-card__button" data-action="${action.id}">
        Executar
      </button>
    `
    card.querySelector('button').addEventListener('click', () => handleAction(action.id))
    container.appendChild(card)
  })
}

function extractTableValue(value) {
  if (value && typeof value === 'object') {
    if (value.type === 'badge') return value.label ?? ''
    if (value.type === 'progress') return `${value.percent ?? 0}%`
    if (value.type === 'code') return value.value ?? ''
  }
  if (value === null || value === undefined) return ''
  return value
}

function downloadCsv(table) {
  const headers = (table.columns ?? []).map(column => column.label)
  const rows = (table.rows ?? []).map(row =>
    (table.columns ?? []).map(column => extractTableValue(row[column.key])),
  )
  const lines = [headers, ...rows]
    .map(line => line.map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${table.id || 'export'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleAction(actionId) {
  if (!currentSummary) return
  const { tables, recommendations } = currentSummary

  switch (actionId) {
    case 'notify': {
      const targets = recommendations?.notifications ?? []
      if (!targets.length) {
        alert('Nenhuma pendência crítica encontrada para notificar.')
        return
      }
      const message = targets
        .map(target => `${target.paciente} (${target.medico || 'Sem médico'}) - ${target.horas}h · ${target.severidade}`)
        .join('\n')
      alert(`Enviar alerta para:\n${message}`)
      break
    }
    case 'redistribute': {
      const redistribution = recommendations?.redistribution ?? []
      if (!redistribution.length) {
        alert('Sem sugestões de redistribuição no momento.')
        return
      }
      const suggestion = redistribution
        .slice(0, 5)
        .map(
          row => `${row.medico}: ${row.pendentes} pendente(s), ${row.assinados} assinatura(s) concluída(s)`,
        )
        .join('\n')
      alert(`Sugerir redistribuição para:\n${suggestion}`)
      break
    }
    case 'exportCsv': {
      const primaryTable = tables?.slaPendencies ?? Object.values(tables ?? {})[0]
      if (!primaryTable) {
        alert('Nenhum dado disponível para exportação.')
        return
      }
      downloadCsv(primaryTable)
      break
    }
    case 'generateProtocol': {
      const protocol = recommendations?.protocol
      if (!protocol) {
        alert('Não há protocolo semanal disponível para gerar.')
        return
      }
      const protocolText = `Semana ${protocol.semana} (${protocol.periodo}) – Hash ${protocol.hash}`
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(protocolText)
          alert(`Protocolo copiado para a área de transferência:\n${protocolText}`)
          return
        } catch (error) {
          console.warn('Falha ao copiar para a área de transferência', error)
        }
      }
      alert(protocolText)
      break
    }
    default:
      console.warn('Ação não reconhecida:', actionId)
  }
}

function updateSummary(summary) {
  currentSummary = summary
  const totals = summary.totals ?? {}

  setText('#drive-total', numberFormatter.format(totals.drivePatients ?? 0))
  setText('#sheet-total', numberFormatter.format(totals.sheetEntries ?? 0))
  setText('#sla-critical', numberFormatter.format(totals.slaCritical ?? 0))
  setText('#open-pendencies', numberFormatter.format(totals.openPendencies ?? 0))

  if (summary.lastSync) {
    setText('#last-sync', new Date(summary.lastSync).toLocaleString('pt-BR'))
  }

  if (summary.sheetTitle) {
    setText('#kpi-context', `Últimos 7 dias · Aba ${summary.sheetTitle}`)
  }

  renderKPIs(summary.kpis)
  renderRoleViews(summary.roleViews, summary.actions)
  renderTables(summary.tables)
  renderActions(summary.actions)
}

async function loadDashboard() {
  const sheetTitleInput = document.querySelector('#sheet-title')
  const sheetTitle = sheetTitleInput?.value?.trim()
  const button = document.querySelector('#refresh')
  if (button) {
    button.disabled = true
    button.textContent = 'Atualizando...'
  }
  try {
    const summary = await fetchSummary(sheetTitle)
    updateSummary(summary)
  } catch (error) {
    alert(error.message)
  } finally {
    if (button) {
      button.disabled = false
      button.textContent = 'Atualizar'
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.querySelector('#refresh')
  if (refreshButton) {
    refreshButton.addEventListener('click', loadDashboard)
  }
  loadDashboard()
})
