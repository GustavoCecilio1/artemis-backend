import crypto from 'node:crypto'
import * as driveService from './driveService.js'
import * as sheetsService from './sheetsService.js'

function safeDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const trimmed = value.toString().trim()
  if (!trimmed) return null
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) return direct

  const [datePart, timePart] = trimmed.split(/\s+/)
  if (!datePart) return null
  const [day, month, year] = datePart.split(/[\/-]/).map(Number)
  if (!day || !month || !year) return null
  let hours = 0
  let minutes = 0
  if (timePart) {
    const [h, m] = timePart.split(':').map(Number)
    if (!Number.isNaN(h)) hours = h
    if (!Number.isNaN(m)) minutes = m
  }
  const parsed = new Date(year, month - 1, day, hours, minutes)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hoursBetween(start, end) {
  if (!start || !end) return 0
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

function isoWeek(date) {
  if (!date) return null
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((target - yearStart) / (1000 * 60 * 60 * 24) + 1) / 7)
  return `${target.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`
}

function toNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return 0
  return Number.parseFloat(value.toFixed(digits))
}

function toPercentage(value, digits = 1) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}%` : '0%'
}

function formatTrend(delta, suffix = '') {
  const rounded = Number.isFinite(delta) ? toNumber(delta, 1) : 0
  return {
    value: rounded,
    label: `${rounded > 0 ? '+' : ''}${rounded}${suffix}`,
    positive: rounded >= 0,
  }
}

function buildKpis({
  scope,
  previousScope,
  now,
}) {
  const withLeadTime = scope.filter(entry => entry.envioHRCA)
  const prevWithLeadTime = previousScope.filter(entry => entry.envioHRCA)
  const completed = withLeadTime.filter(entry => entry.envioLaudo)
  const prevCompleted = prevWithLeadTime.filter(entry => entry.envioLaudo)

  const onTime = completed.filter(entry => hoursBetween(entry.envioHRCA, entry.envioLaudo) <= 48)
  const prevOnTime = prevCompleted.filter(entry => hoursBetween(entry.envioHRCA, entry.envioLaudo) <= 48)

  const pendingSla = withLeadTime.filter(entry => !entry.envioLaudo && hoursBetween(entry.envioHRCA, now) > 48)
  const prevPendingSla = prevWithLeadTime.filter(
    entry => !entry.envioLaudo && hoursBetween(entry.envioHRCA, now) > 48,
  )

  const avgLead = completed.length
    ? completed.reduce((acc, entry) => acc + hoursBetween(entry.envioHRCA, entry.envioLaudo), 0) /
      completed.length
    : 0
  const prevAvgLead = prevCompleted.length
    ? prevCompleted.reduce(
        (acc, entry) => acc + hoursBetween(entry.envioHRCA, entry.envioLaudo),
        0,
      ) /
      prevCompleted.length
    : 0

  const reworkCount = scope.filter(entry => /retrabalho|revis|corre/i.test(entry.status ?? '')).length
  const prevReworkCount = previousScope.filter(entry => /retrabalho|revis|corre/i.test(entry.status ?? '')).length

  const procedenciaCount = scope.filter(entry => /proced/i.test(entry.status ?? '')).length
  const prevProcedenciaCount = previousScope.filter(entry => /proced/i.test(entry.status ?? '')).length

  const totalConsidered = scope.length || 1
  const prevTotal = previousScope.length || 1

  return [
    {
      id: 'onTimeDelivery',
      label: 'Entrega no prazo',
      value: toPercentage((onTime.length / (completed.length || 1)) * 100),
      description: 'Laudos concluídos dentro de 48h na última semana.',
      trend: formatTrend(
        (onTime.length / (completed.length || 1)) * 100 -
          (prevOnTime.length / (prevCompleted.length || 1)) * 100,
        'pp',
      ),
    },
    {
      id: 'sla48',
      label: 'SLA 48h',
      value: `${pendingSla.length} pendência(s)`,
      description: 'Registros acima de 48h aguardando conclusão.',
      trend: formatTrend(pendingSla.length - prevPendingSla.length),
    },
    {
      id: 'avgLead',
      label: 'Prazo médio',
      value: `${toNumber(avgLead)} h`,
      description: 'Tempo médio entre envio e laudo.',
      trend: formatTrend(avgLead - prevAvgLead, 'h'),
    },
    {
      id: 'rework',
      label: 'Retrabalho',
      value: toPercentage((reworkCount / totalConsidered) * 100),
      description: 'Entradas com reabertura ou correção.',
      trend: formatTrend(
        (reworkCount / totalConsidered) * 100 -
          (prevReworkCount / prevTotal) * 100,
        'pp',
      ),
    },
    {
      id: 'procedencia',
      label: 'Procedência',
      value: toPercentage((procedenciaCount / totalConsidered) * 100),
      description: 'Casos sinalizados como procedentes.',
      trend: formatTrend(
        (procedenciaCount / totalConsidered) * 100 -
          (prevProcedenciaCount / prevTotal) * 100,
        'pp',
      ),
    },
  ]
}

function buildSlaTable(entries, now) {
  return entries
    .filter(entry => entry.envioHRCA)
    .map(entry => {
      const hoursOpen = entry.envioLaudo
        ? hoursBetween(entry.envioHRCA, entry.envioLaudo)
        : hoursBetween(entry.envioHRCA, now)
      let tone = 'green'
      let label = 'Dentro do prazo'
      if (hoursOpen > 48) {
        tone = 'red'
        label = 'Crítico'
      } else if (hoursOpen > 36) {
        tone = 'amber'
        label = 'Atenção'
      }
      return {
        paciente: entry.paciente,
        medico: entry.medico,
        horas: hoursOpen,
        status: entry.status,
        badge: { label, tone },
      }
    })
    .filter(item => !Number.isNaN(item.horas))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 12)
}

function buildQueue(entries, now) {
  return entries
    .filter(entry => entry.envioHRCA && entry.envioHRCA.getHours() >= 18 && !entry.envioLaudo)
    .sort((a, b) => b.envioHRCA - a.envioHRCA)
    .map(entry => ({
      paciente: entry.paciente,
      medico: entry.medico,
      entrada: entry.envioHRCA,
      horas: hoursBetween(entry.envioHRCA, now),
      status: entry.status,
    }))
    .slice(0, 10)
}

function buildSignatures(entries) {
  const doctors = new Map()
  entries.forEach(entry => {
    const key = entry.medico?.trim() || 'Sem médico'
    if (!doctors.has(key)) {
      doctors.set(key, { assinados: 0, pendentes: 0 })
    }
    const data = doctors.get(key)
    if (entry.envioLaudo) {
      data.assinados += 1
    } else {
      data.pendentes += 1
    }
  })
  return [...doctors.entries()]
    .map(([medico, data]) => {
      const total = data.assinados + data.pendentes
      const atingimento = total ? (data.assinados / total) * 100 : 0
      return {
        medico,
        assinados: data.assinados,
        pendentes: data.pendentes,
        atingimento,
      }
    })
    .sort((a, b) => b.assinados - a.assinados)
}

function buildProtocols(entries) {
  const groups = new Map()
  entries.forEach(entry => {
    const baseDate = entry.envioLaudo ?? entry.envioHRCA
    const key = isoWeek(baseDate)
    if (!key) return
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(entry)
  })

  const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

  return [...groups.entries()]
    .map(([weekKey, groupEntries]) => {
      const [year, week] = weekKey.split('-W')
      const sampleDate = groupEntries[0].envioLaudo ?? groupEntries[0].envioHRCA
      const start = new Date(sampleDate)
      const dayOfWeek = start.getDay()
      const monday = new Date(start)
      monday.setDate(start.getDate() - ((dayOfWeek + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(groupEntries.map(entry => entry.paciente).sort()))
        .digest('hex')
        .slice(0, 10)
      return {
        semana: `${week}/${year}`,
        periodo: `${formatter.format(monday)} – ${formatter.format(sunday)}`,
        total: groupEntries.length,
        hash,
      }
    })
    .sort((a, b) => (a.semana < b.semana ? 1 : -1))
}

function toRoleViews({
  totals,
  slaPendencies,
  queue18h,
  signatures,
  protocols,
  kpis,
  actions,
}) {
  const actionMap = new Map(actions.map(action => [action.id, action.label]))
  const slaCriticos = slaPendencies.filter(item => item.badge.tone === 'red').length
  const filaSize = queue18h.length
  const pendentes = signatures.reduce((acc, row) => acc + row.pendentes, 0)
  const assinados = signatures.reduce((acc, row) => acc + row.assinados, 0)

  return [
    {
      id: 'admin',
      label: 'Admin',
      summary:
        'Monitoramento geral da operação, garantindo aderência ao SLA e visibilidade das pendências críticas.',
      highlights: [
        `Pendências críticas: ${slaCriticos}`,
        `Cobertura de dados: ${totals.sheetEntries}/${totals.drivePatients} pacientes sincronizados`,
      ],
      metrics: [kpis[0], kpis[1]].filter(Boolean),
      focus: ['Revisar alertas críticos', 'Garantir dados consistentes nas integrações'],
      actions: ['notify', 'redistribute', 'exportCsv'].filter(id => actionMap.has(id)),
    },
    {
      id: 'operations',
      label: 'Operações',
      summary:
        'Controle de fluxo diário e redistribuição da carga de trabalho entre a equipe para evitar gargalos.',
      highlights: [`Fila 18:00: ${filaSize} registros`, `Pendências em aberto: ${totals.openPendencies}`],
      metrics: [kpis[1], kpis[2]].filter(Boolean),
      focus: ['Balancear equipe médica', 'Acompanhar fila crítica ao final do dia'],
      actions: ['redistribute', 'exportCsv'].filter(id => actionMap.has(id)),
    },
    {
      id: 'reviewer',
      label: 'Revisor',
      summary:
        'Priorização das solicitações com maior risco de estouro de SLA e acompanhamento de retrabalho.',
      highlights: [`Retrabalho: ${kpis[3]?.value ?? '--'}`, `Casos críticos: ${slaCriticos}`],
      metrics: [kpis[3], kpis[0]].filter(Boolean),
      focus: ['Tratar pendências > 48h', 'Validar correções pendentes'],
      actions: ['notify', 'generateProtocol'].filter(id => actionMap.has(id)),
    },
    {
      id: 'doctor',
      label: 'Médico',
      summary:
        'Visão orientada ao desempenho individual e ao volume de assinaturas concluídas no período.',
      highlights: [`Assinaturas concluídas: ${assinados}`, `Pendências pessoais: ${pendentes}`],
      metrics: [kpis[2], kpis[4]].filter(Boolean),
      focus: ['Finalizar casos próximos ao limite', 'Registrar procedência com justificativa'],
      actions: ['notify', 'exportCsv'].filter(id => actionMap.has(id)),
    },
    {
      id: 'hrca',
      label: 'HRCA',
      summary:
        'Acompanhamento executivo para reporte semanal e geração do protocolo consolidado.',
      highlights: [
        protocols.length > 0
          ? `Protocolo vigente: ${protocols[0].hash}`
          : 'Sem protocolo gerado na semana',
        `Procedência média: ${kpis[4]?.value ?? '--'}`,
      ],
      metrics: [kpis[4], kpis[0]].filter(Boolean),
      focus: ['Gerar protocolo semanal', 'Compartilhar indicadores estratégicos'],
      actions: ['generateProtocol', 'exportCsv'].filter(id => actionMap.has(id)),
    },
  ]
}

export async function getDashboardSummary({ sheetTitle = 'Pagina1' } = {}) {
  const now = new Date()
  const [folders, sheetMap] = await Promise.all([
    driveService.listPatientFolders(),
    sheetsService.getPatientMap(sheetTitle),
  ])

  const totals = {
    drivePatients: folders.length,
    sheetEntries: sheetMap.size,
  }

  const entries = [...sheetMap.values()].map(entry => ({
    paciente: entry.paciente,
    medico: entry.medico,
    status: entry.status,
    envioHRCA: safeDate(entry.dataEnvioHRCA),
    envioLaudo: safeDate(entry.dataEnvioLaudo),
  }))

  const pendingFolders = folders.filter(
    folder => folder.patient && !sheetMap.has(folder.patient.toLowerCase()),
  )

  const openPendencies = entries.filter(entry => entry.envioHRCA && !entry.envioLaudo)
  const slaPendencies = buildSlaTable(entries, now)
  const queue18h = buildQueue(entries, now)
  const signatures = buildSignatures(entries)
  const protocols = buildProtocols(entries)

  const recentThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const previousThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const recentEntries = entries.filter(entry => {
    const reference = entry.envioLaudo ?? entry.envioHRCA
    return reference && reference >= recentThreshold
  })

  const previousEntries = entries.filter(entry => {
    const reference = entry.envioLaudo ?? entry.envioHRCA
    return reference && reference < recentThreshold && reference >= previousThreshold
  })

  const kpis = buildKpis({ scope: recentEntries, previousScope: previousEntries, now })

  const actions = [
    {
      id: 'notify',
      label: 'Notificar',
      description: 'Enviar alerta aos responsáveis sobre pendências críticas do SLA.',
    },
    {
      id: 'redistribute',
      label: 'Redistribuir',
      description: 'Sugerir realocação da fila entre os médicos com menor carga.',
    },
    {
      id: 'exportCsv',
      label: 'Exportar CSV',
      description: 'Baixar uma visão consolidada das principais filas.',
    },
    {
      id: 'generateProtocol',
      label: 'Gerar Protocolo',
      description: 'Emitir o hash semanal para envio ao HRCA.',
    },
  ]

  const roleViews = toRoleViews({
    totals: {
      ...totals,
      openPendencies: openPendencies.length,
    },
    slaPendencies,
    queue18h,
    signatures,
    protocols,
    kpis,
    actions,
  })

  const recommendations = {
    notifications: slaPendencies.slice(0, 3).map(item => ({
      paciente: item.paciente,
      medico: item.medico,
      horas: toNumber(item.horas),
      severidade: item.badge.label,
    })),
    redistribution: signatures
      .map(row => ({
        medico: row.medico,
        pendentes: row.pendentes,
        assinados: row.assinados,
      }))
      .sort((a, b) => b.pendentes - a.pendentes),
    protocol: protocols[0] ?? null,
  }

  const tables = {
    slaPendencies: {
      id: 'slaPendencies',
      title: 'Pendências SLA',
      subtitle: 'Semáforo verde/âmbar/vermelho',
      columns: [
        { key: 'paciente', label: 'Paciente' },
        { key: 'medico', label: 'Médico responsável' },
        { key: 'horas', label: 'Horas em aberto' },
        { key: 'status', label: 'Status' },
        { key: 'badge', label: 'SLA' },
      ],
      rows: slaPendencies.map(item => ({
        paciente: item.paciente,
        medico: item.medico ?? '—',
        horas: `${toNumber(item.horas)} h`,
        status: item.status ?? 'Sem status',
        badge: { type: 'badge', label: item.badge.label, tone: item.badge.tone },
      })),
    },
    queue18h: {
      id: 'queue18h',
      title: 'Fila 18:00',
      subtitle: 'Registros abertos após as 18h aguardando assinatura',
      columns: [
        { key: 'paciente', label: 'Paciente' },
        { key: 'medico', label: 'Médico' },
        { key: 'entrada', label: 'Entrada' },
        { key: 'horas', label: 'Horas em espera' },
        { key: 'status', label: 'Status' },
      ],
      rows: queue18h.map(item => ({
        paciente: item.paciente,
        medico: item.medico ?? '—',
        entrada: item.entrada
          ? new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(item.entrada)
          : '—',
        horas: `${toNumber(item.horas)} h`,
        status: item.status ?? 'Aguardando',
      })),
    },
    doctorSignatures: {
      id: 'doctorSignatures',
      title: 'Assinaturas por médico',
      subtitle: 'Volume concluído vs. pendente por profissional',
      columns: [
        { key: 'medico', label: 'Médico' },
        { key: 'assinados', label: 'Assinados' },
        { key: 'pendentes', label: 'Pendentes' },
        { key: 'atingimento', label: 'Atingimento' },
      ],
      rows: signatures.map(item => ({
        medico: item.medico,
        assinados: item.assinados,
        pendentes: item.pendentes,
        atingimento: { type: 'progress', percent: toNumber(item.atingimento) },
      })),
    },
    weeklyProtocol: {
      id: 'weeklyProtocol',
      title: 'Protocolo semanal (hash)',
      subtitle: 'Consolidado para envio ao HRCA',
      columns: [
        { key: 'semana', label: 'Semana' },
        { key: 'periodo', label: 'Período' },
        { key: 'total', label: 'Total' },
        { key: 'hash', label: 'Hash' },
      ],
      rows: protocols.map(item => ({
        semana: item.semana,
        periodo: item.periodo,
        total: item.total,
        hash: { type: 'code', value: item.hash },
      })),
    },
  }

  return {
    totals: {
      ...totals,
      openPendencies: openPendencies.length,
      slaCritical: slaPendencies.filter(item => item.badge.tone === 'red').length,
      pendingDriveOnly: pendingFolders.length,
    },
    kpis,
    roleViews,
    tables,
    actions,
    recommendations,
    lastSync: now.toISOString(),
    sheetTitle,
  }
}
