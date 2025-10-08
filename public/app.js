const numberFormatter = new Intl.NumberFormat('pt-BR')
const storageKey = 'artemis:dashboard:token'
let authToken = null
let currentUser = null
let currentSummary = null
let loginOverlay = null
let loginForm = null
let loginError = null

const roleLabels = {
  admin: 'Admin',
  operations: 'Operações',
  reviewer: 'Revisor',
  doctor: 'Médico',
  hrca: 'HRCA',
}

function loadStoredToken() {
  try {
    return window.localStorage?.getItem(storageKey) ?? null
  } catch (error) {
    console.warn('Não foi possível recuperar o token salvo.', error)
    return null
  }
}

function persistToken(token) {
  try {
    if (token) {
      window.localStorage?.setItem(storageKey, token)
    } else {
      window.localStorage?.removeItem(storageKey)
    }
  } catch (error) {
    console.warn('Não foi possível persistir o token de sessão.', error)
  }
}

function setAuthToken(token) {
  authToken = token
  persistToken(token)
}

authToken = loadStoredToken()

function isAuthenticated() {
  return Boolean(authToken && currentUser)
}

async function fetchSummary(sheetTitle) {
  const params = new URLSearchParams()
  if (sheetTitle) {
    params.set('sheetTitle', sheetTitle)
  }
  const headers = {}
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  const response = await fetch(`/api/dashboard/summary?${params.toString()}`, { headers })
  if (response.status === 401) {
    clearAuth()
    showLogin('Sessão expirada. Faça login novamente para continuar.')
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (response.status === 403) {
    throw new Error('Você não tem permissão para acessar esta visão.')
  }
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

function ensureLoginRefs() {
  if (!loginOverlay) {
    loginOverlay = document.querySelector('#login-overlay')
  }
  if (!loginForm) {
    loginForm = document.querySelector('#login-form')
  }
  if (!loginError) {
    loginError = document.querySelector('#login-error')
  }
}

function updateSessionInfo(user) {
  const sessionBox = document.querySelector('#session-box')
  const display = document.querySelector('#session-display')
  const role = document.querySelector('#session-role')
  if (!sessionBox || !display || !role) return

  if (!user) {
    display.textContent = 'Desconectado'
    role.textContent = '—'
    sessionBox.classList.add('session--hidden')
  } else {
    display.textContent = user.displayName ?? user.username ?? 'Usuário'
    role.textContent = roleLabels[user.role] ?? user.role ?? '—'
    sessionBox.classList.remove('session--hidden')
  }

  if (document.body) {
    document.body.dataset.role = user?.role ?? 'guest'
  }
}

function setLoginError(message = '') {
  ensureLoginRefs()
  if (loginError) {
    loginError.textContent = message
  }
}

function showLogin(message) {
  ensureLoginRefs()
  if (loginForm) {
    loginForm.reset()
  }
  if (loginOverlay) {
    loginOverlay.classList.remove('hidden')
  }
  setLoginError(message ?? '')
  const usernameInput = document.querySelector('#login-username')
  if (usernameInput) {
    window.requestAnimationFrame(() => usernameInput.focus())
  }
}

function hideLogin() {
  ensureLoginRefs()
  if (loginOverlay) {
    loginOverlay.classList.add('hidden')
  }
  setLoginError('')
}

function resetDashboard() {
  currentSummary = null
  setText('#drive-total', '--')
  setText('#sheet-total', '--')
  setText('#sla-critical', '--')
  setText('#open-pendencies', '--')
  setText('#last-sync', '--')
  setText('#kpi-context', 'Últimos 7 dias')
  setText('#role-context', 'Faça login para visualizar sua visão.')
  renderKPIs([])
  renderRoleViews([], [])
  renderTables({})
  renderActions([])
}

function clearAuth() {
  setAuthToken(null)
  currentUser = null
  updateSessionInfo(null)
  resetDashboard()
}

async function performLogin(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Credenciais inválidas.')
  }

  return response.json()
}

async function restoreSession() {
  if (!authToken) {
    return false
  }

  try {
    const response = await fetch('/api/auth/session', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
    if (!response.ok) {
      throw new Error('Sessão inválida')
    }
    const data = await response.json()
    currentUser = data.user ?? null
    updateSessionInfo(currentUser)
    return true
  } catch (error) {
    console.warn('Sessão anterior inválida. Limpando credenciais.', error)
    clearAuth()
    return false
  }
}

async function performLogout() {
  if (!authToken) {
    clearAuth()
    showLogin()
    return
  }

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
  } catch (error) {
    console.warn('Falha ao encerrar sessão no servidor.', error)
  } finally {
    clearAuth()
    showLogin()
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault()
  ensureLoginRefs()
  if (!loginForm) return

  const formData = new FormData(loginForm)
  const username = formData.get('username')?.toString().trim()
  const password = formData.get('password')?.toString()

  const submitButton = loginForm.querySelector('button[type="submit"]')
  if (submitButton) {
    submitButton.disabled = true
    submitButton.textContent = 'Entrando...'
  }

  try {
    setLoginError('')
    if (!username || !password) {
      throw new Error('Informe usuário e senha.')
    }
    const session = await performLogin(username, password)
    setAuthToken(session.token)
    currentUser = session.user ?? null
    updateSessionInfo(currentUser)
    hideLogin()
    await loadDashboard()
  } catch (error) {
    setLoginError(error.message ?? 'Falha ao autenticar. Tente novamente.')
  } finally {
    if (submitButton) {
      submitButton.disabled = false
      submitButton.textContent = 'Entrar'
    }
  }
}

function handleLogoutClick() {
  performLogout().catch(error => {
    console.error('Erro ao processar logout.', error)
  })
}

function renderKPIs(kpis = []) {
  const container = document.querySelector('#kpi-grid')
  if (!container) return
  container.innerHTML = ''
  if (!kpis.length) {
    container.innerHTML = `<p class="empty">${
      isAuthenticated() ? 'Nenhum KPI disponível.' : 'Faça login para visualizar os KPIs.'
    }</p>`
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
    tabs.classList.add('role-tabs--hidden')
    content.innerHTML = `<p class="empty">${
      isAuthenticated() ? 'Nenhuma visão configurada.' : 'Faça login para acessar sua visão.'
    }</p>`
    return
  }

  if (roleViews.length <= 1) {
    tabs.classList.add('role-tabs--hidden')
  } else {
    tabs.classList.remove('role-tabs--hidden')
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
    container.innerHTML = `<p class="empty">${
      isAuthenticated()
        ? 'Nenhuma tabela disponível.'
        : 'Faça login para visualizar as tabelas operacionais.'
    }</p>`
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
    container.innerHTML = `<p class="empty">${
      isAuthenticated() ? 'Nenhuma ação disponível.' : 'Faça login para habilitar as ações rápidas.'
    }</p>`
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
  if (summary.viewer) {
    currentUser = summary.viewer
    updateSessionInfo(currentUser)
  }
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

  const primaryRoleLabel = summary.roleViews?.[0]?.label ?? roleLabels[summary.role] ?? summary.role
  if (summary.viewer?.permissions?.canViewAllRoles) {
    setText('#role-context', 'Visão administrativa com acesso a todos os papéis.')
  } else if (primaryRoleLabel) {
    setText('#role-context', `Visão do papel ${primaryRoleLabel}.`)
  } else {
    setText('#role-context', 'Visão atual do dashboard.')
  }

  renderKPIs(summary.kpis)
  renderRoleViews(summary.roleViews, summary.actions)
  renderTables(summary.tables)
  renderActions(summary.actions)
}

async function loadDashboard() {
  if (!authToken) {
    showLogin()
    return
  }
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

window.addEventListener('DOMContentLoaded', async () => {
  ensureLoginRefs()
  updateSessionInfo(currentUser)
  resetDashboard()

  const refreshButton = document.querySelector('#refresh')
  if (refreshButton) {
    refreshButton.addEventListener('click', loadDashboard)
  }

  const logoutButton = document.querySelector('#logout')
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogoutClick)
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit)
  }

  const restored = await restoreSession()
  if (restored) {
    hideLogin()
    await loadDashboard()
  } else {
    showLogin()
  }
})
