import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { api } from './api'
import WorkflowLibrary from './WorkflowLibrary'

type RunStatus = 'Completed' | 'Review' | 'Running'
type View = 'Overview' | 'Workflows' | 'Connections' | 'Insights' | 'Settings'
type Connection = { name: string; kind: string; logo: string; tone: string; connected: boolean }
type WorkflowRun = { id: string; workflow: string; source: string; status: RunStatus; duration: string; time: string; confidence: string }
type Insight = { title: string; body: string; time: string }
type Settings = { autoApprove: boolean; dailyDigest: boolean; reviewThreshold: number }
type WorkflowDefinition = { name: string; trigger: string; integrations: string[]; active: boolean }
type SupportTicket = { id: string; subject: string; customer: string; channel: string; priority: 'High' | 'Medium' | 'Low'; status: 'Needs review' | 'Assigned' | 'Resolved'; owner: string }

const defaultRuns: WorkflowRun[] = [
  { id: 'RUN-2481', workflow: 'Inbound lead triage', source: 'Web form', status: 'Completed', duration: '38s', time: '2 min ago', confidence: '98%' },
  { id: 'RUN-2480', workflow: 'Inbound lead triage', source: 'LinkedIn', status: 'Review', duration: '1m 12s', time: '8 min ago', confidence: '76%' },
  { id: 'RUN-2479', workflow: 'Customer renewal risk', source: 'Salesforce', status: 'Completed', duration: '24s', time: '14 min ago', confidence: '94%' },
  { id: 'RUN-2478', workflow: 'Inbound lead triage', source: 'Web form', status: 'Completed', duration: '42s', time: '21 min ago', confidence: '96%' },
  { id: 'RUN-2477', workflow: 'Support escalation', source: 'Intercom', status: 'Running', duration: '-', time: '26 min ago', confidence: '-'},
]
const defaultConnections: Connection[] = [
  { name: 'HubSpot', kind: 'CRM', logo: 'H', tone: 'hubspot', connected: true },
  { name: 'Slack', kind: 'Messaging', logo: '✣', tone: 'slack', connected: true },
  { name: 'Salesforce', kind: 'CRM', logo: '☁', tone: 'salesforce', connected: true },
  { name: 'Webflow', kind: 'Lead capture', logo: 'W', tone: 'webflow', connected: true },
]
const defaultInsights: Insight[] = [
  { title: 'Lead quality is up 22% this week', body: 'Marketing-qualified leads from the new webinar campaign are converting faster than average.', time: 'Today, 9:42 AM' },
  { title: 'Renewal risk is concentrated in Enterprise', body: 'Three accounts need an owner review before the next renewal window.', time: 'Yesterday, 4:18 PM' },
]
const workflowRequirements: Record<string, string[]> = {
  'Inbound lead triage': ['Webflow', 'HubSpot', 'Slack'],
  'Customer renewal risk': ['Salesforce'],
  'Support escalation': ['Slack'],
}
const defaultSettings: Settings = { autoApprove: true, dailyDigest: true, reviewThreshold: 80 }
const defaultSupportTickets: SupportTicket[] = [
  { id: 'SUP-1042', subject: 'Unable to export monthly report', customer: 'Atlas Health', channel: 'Intercom', priority: 'High', status: 'Needs review', owner: 'Unassigned' },
  { id: 'SUP-1041', subject: 'Question about SSO setup', customer: 'Northstar Labs', channel: 'Email', priority: 'Medium', status: 'Assigned', owner: 'Maya Chen' },
  { id: 'SUP-1040', subject: 'Add a teammate to workspace', customer: 'Brightwell', channel: 'Chat', priority: 'Low', status: 'Resolved', owner: 'Sam Rivera' },
]
const defaultWorkflows: WorkflowDefinition[] = [
  { name: 'Inbound lead triage', trigger: 'Webflow form submission', integrations: ['Webflow', 'HubSpot', 'Slack'], active: true },
  { name: 'Customer renewal risk', trigger: 'Daily at 08:00', integrations: ['Salesforce'], active: true },
  { name: 'Support escalation', trigger: 'Intercom priority change', integrations: ['Slack'], active: true },
]
const steps = [
  ['Capture lead', 'Webhook received from Webflow', '0.4s'],
  ['Enrich company', 'Clearbit company profile matched', '3.8s'],
  ['Classify intent', 'Claude structured output returned', '8.2s'],
  ['Route to sales', 'HubSpot owner and priority assigned', '1.6s'],
  ['Notify team', 'Slack #sales-alerts message sent', '0.8s'],
]

function readStore<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}

function App() {
  const [activeView, setActiveView] = useState<View>('Overview')
  const [runs, setRuns] = useState(() => readStore('flowpilot-runs', defaultRuns))
  const [connections, setConnections] = useState(() => readStore('flowpilot-connections', defaultConnections))
  const [insights, setInsights] = useState(() => readStore('flowpilot-insights', defaultInsights))
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(() => readStore('flowpilot-workflows', defaultWorkflows))
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => readStore('flowpilot-support-tickets', defaultSupportTickets))
  const [selectedRun, setSelectedRun] = useState<WorkflowRun>(runs[0] || defaultRuns[0])
  const [isRunning, setIsRunning] = useState(false)
  const [filter, setFilter] = useState<'All' | RunStatus>('All')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [bottomProfileOpen, setBottomProfileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [supportDemoOpen, setSupportDemoOpen] = useState(false)
  const [workflowBuilderOpen, setWorkflowBuilderOpen] = useState(false)
  const [draftWorkflow, setDraftWorkflow] = useState<WorkflowDefinition>({ name: '', trigger: 'Webflow form submission', integrations: ['Webflow'], active: true })
  const [toast, setToast] = useState('')
  const [isHydrating, setIsHydrating] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(() => readStore('flowpilot-settings', defaultSettings))
  const accountAnchorRef = useRef<HTMLDivElement>(null)
  const topActionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem('flowpilot-runs', JSON.stringify(runs)) }, [runs])
  useEffect(() => { localStorage.setItem('flowpilot-connections', JSON.stringify(connections)) }, [connections])
  useEffect(() => { localStorage.setItem('flowpilot-insights', JSON.stringify(insights)) }, [insights])
  useEffect(() => { localStorage.setItem('flowpilot-workflows', JSON.stringify(workflows)) }, [workflows])
  useEffect(() => { localStorage.setItem('flowpilot-support-tickets', JSON.stringify(supportTickets)) }, [supportTickets])
  useEffect(() => {
    void api.bootstrap().then((data) => {
      setRuns(data.runs)
      setConnections(data.connections)
      setInsights(data.insights)
      setSupportTickets(data.supportTickets)
      setSettings(data.settings)
      setWorkflows(data.workflows)
      setSelectedRun(data.runs[0] || defaultRuns[0])
    }).catch(() => setToast('API unavailable. Running in local demo mode.')).finally(() => setIsHydrating(false))
  }, [])
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer) } }, [toast])
  useEffect(() => {
    const closeDialogs = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setWorkflowBuilderOpen(false); setSupportDemoOpen(false); setProfileOpen(false); setBottomProfileOpen(false); setNotificationsOpen(false) }
    }
    document.addEventListener('keydown', closeDialogs)
    return () => document.removeEventListener('keydown', closeDialogs)
  }, [])
  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Node
      if (!accountAnchorRef.current?.contains(target)) setBottomProfileOpen(false)
      if (!topActionsRef.current?.contains(target)) { setProfileOpen(false); setNotificationsOpen(false) }
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [])

  const filteredRuns = useMemo(() => filter === 'All' ? runs : runs.filter((run) => run.status === filter), [filter, runs])
  const healthyConnections = connections.filter((connection) => connection.connected).length
  const allSystemsHealthy = healthyConnections === connections.length
  const notify = (message: string) => setToast(message)
  const runWorkflow = () => {
    if (isRunning || isHydrating || pendingAction) return
    const missingConnections = workflowRequirements['Inbound lead triage'].filter((required) => !connections.find((connection) => connection.name === required && connection.connected))
    if (missingConnections.length > 0) {
      setActiveView('Connections')
      notify(`Connect ${missingConnections.join(', ')} before running lead triage.`)
      return
    }
    const id = `RUN-${2482 + runs.length}`
    const newRun: WorkflowRun = { id, workflow: 'Inbound lead triage', source: 'Manual test', status: 'Running', duration: '-', time: 'Just now', confidence: '-' }
    setRuns((current) => [newRun, ...current])
    void api.createRun().catch(() => notify('Run created locally, but the API could not be reached.'))
    setSelectedRun(newRun)
    setIsRunning(true)
    notify('Workflow started. Watching each step in real time.')
    window.setTimeout(() => {
      const confidence = 97
      const shouldAutoApprove = settings.autoApprove && confidence >= settings.reviewThreshold
      const completed = { ...newRun, status: shouldAutoApprove ? 'Completed' as RunStatus : 'Review' as RunStatus, duration: '31s', confidence: `${confidence}%` }
      setRuns((current) => current.map((run) => run.id === id ? completed : run))
      setSelectedRun(completed)
      setIsRunning(false)
      notify(shouldAutoApprove ? `${id} completed successfully.` : `${id} completed and is waiting for review.`)
    }, 1600)
  }
  const createWorkflow = () => { setDraftWorkflow({ name: '', trigger: 'Webflow form submission', integrations: ['Webflow'], active: true }); setWorkflowBuilderOpen(true) }
  const saveWorkflow = () => {
    const name = draftWorkflow.name.trim()
    if (!name) { notify('Add a workflow name before saving.'); return }
    if (workflows.some((workflow) => workflow.name.toLowerCase() === name.toLowerCase())) { notify('A workflow with that name already exists.'); return }
    setWorkflows((current) => [...current, { ...draftWorkflow, name }])
    void api.createWorkflow({ name, trigger: draftWorkflow.trigger, integrations: draftWorkflow.integrations }).catch(() => notify('Workflow saved locally, but API sync failed.'))
    setWorkflowBuilderOpen(false)
    setActiveView('Workflows')
    notify(`${name} was added to the workflow library.`)
  }
  const addConnection = () => {
    if (connections.some((connection) => connection.name === 'OpenAI')) { notify('All suggested connections are already added.'); return }
    const connection = { name: 'OpenAI', kind: 'AI provider', logo: 'O', tone: 'openai', connected: true }
    setConnections((current) => [...current, connection])
    notify('OpenAI connection added locally. Connect the provider in production to authorize it.')
  }
  const generateInsight = () => {
    const completedRuns = runs.filter((run) => run.status === 'Completed').length
    const reviewRuns = runs.filter((run) => run.status === 'Review').length
    const newInsight = { title: `${completedRuns} runs completed without intervention`, body: `${reviewRuns} runs are waiting for review. Lower the review threshold in Settings to automate more high-confidence decisions.`, time: 'Just now' }
    setInsights((current) => [newInsight, ...current])
    void api.createInsight().catch(() => notify('Insight generated locally, but API sync failed.'))
    notify('New AI insight generated from recent runs.')
  }
  const toggleConnection = (name: string) => {
    const previous = connections
    setConnections((current) => current.map((connection) => connection.name === name ? { ...connection, connected: !connection.connected } : connection))
    void api.toggleConnection(name).then((updated) => { setConnections((current) => current.map((connection) => connection.name === name ? updated : connection)); notify(`${name} ${updated.connected ? 'connected' : 'disconnected'}.`) }).catch(() => { setConnections(previous); notify(`${name} could not be updated. The previous state was restored.`) })
  }
  const classifyTicket = (ticketId: string) => {
    void api.updateTicket(ticketId, { status: 'Assigned', owner: 'Maya Chen' }).then((updated) => { setSupportTickets((current) => current.map((ticket) => ticket.id === ticketId ? updated : ticket)); notify(`${ticketId} classified and assigned to Maya Chen.`) }).catch(() => notify(`${ticketId} could not be assigned.`))
  }
  const resolveTicket = (ticketId: string) => {
    void api.updateTicket(ticketId, { status: 'Resolved' }).then((updated) => { setSupportTickets((current) => current.map((ticket) => ticket.id === ticketId ? updated : ticket)); notify(`${ticketId} marked as resolved.`) }).catch(() => notify(`${ticketId} could not be resolved.`))
  }
  const saveSettings = () => { if (pendingAction) return; setPendingAction('settings'); localStorage.setItem('flowpilot-settings', JSON.stringify(settings)); void api.saveSettings(settings).then(() => notify('Workspace settings saved.')).catch(() => notify('Settings saved locally, but API sync failed.')).finally(() => setPendingAction(null)) }

  const nav = (view: View) => <button className={activeView === view ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(view)}><span className="nav-glyph">{view === 'Overview' ? '◈' : view === 'Workflows' ? '◎' : view === 'Connections' ? '↗' : view === 'Insights' ? '◌' : '⚙'}</span>{view}{view === 'Workflows' && <span className="nav-count">{workflows.length}</span>}</button>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">//</span><span>flowpilot</span></div>
      <div className="workspace-control"><div className="workspace-switcher"><span className="workspace-dot" /> Acme automation workspace <span className="chevron">•</span></div></div>
      <nav className="main-nav" aria-label="Main navigation">{nav('Overview')}{nav('Workflows')}{nav('Connections')}{nav('Insights')}<button className="nav-item project-nav" onClick={() => setSupportDemoOpen(true)}><span className="nav-glyph">!</span>Support triage<span className="nav-count">{supportTickets.filter((ticket) => ticket.status === 'Needs review').length}</span></button></nav>
      <div className="side-section-label">SYSTEM</div>
      <nav className="main-nav">{nav('Settings')}<button className="nav-item" onClick={() => setHelpOpen((open) => !open)}><span className="nav-glyph">?</span>Help center</button></nav>
      {helpOpen && <div className="help-popover"><strong>Need a hand?</strong><p>Review a workflow run or open Settings to tune review thresholds.</p><button onClick={() => { setHelpOpen(false); setActiveView('Settings') }}>Open settings <span>→</span></button></div>}
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-top"><span>PRO PLAN</span><span className="live-dot" /></div><strong>{Math.min(100, Math.round((runs.length / 20) * 100))}% of monthly runs</strong><div className="progress"><span style={{ width: `${Math.min(100, (runs.length / 20) * 100)}%` }} /></div><small>{runs.length} / 20 runs in demo</small></div><div className="account-anchor" ref={accountAnchorRef}><button className="user-row" onClick={() => setBottomProfileOpen((open) => !open)}><div className="avatar">JM</div><div><strong>Jordan Miller</strong><small>Admin</small></div><span className="more">•••</span></button>{bottomProfileOpen && <div className="bottom-profile-popover"><strong>Jordan Miller</strong><small>Admin account</small><button onClick={() => { setBottomProfileOpen(false); setActiveView('Settings') }}>Account settings <span className="menu-chevron" aria-hidden="true">›</span></button><button onClick={() => { setBottomProfileOpen(false); notify('You are still signed in to this demo workspace.') }}>Sign out <span className="menu-chevron" aria-hidden="true">›</span></button></div>}</div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{activeView}</strong></div><div className="top-actions"><span className="status-pill"><span className="live-dot" /> {allSystemsHealthy ? 'All systems operational' : `${connections.length - healthyConnections} connection needs attention`}</span><button className="icon-button" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>♧<i />{notificationsOpen && <span className="notification-popover">{runs.some((run) => run.status === 'Review') ? '1 run needs review' : 'No new alerts'}</span>}</button><button className="avatar mini" onClick={() => setProfileOpen((open) => !open)}>JM</button>{profileOpen && <div className="profile-popover"><strong>Jordan Miller</strong><small>Admin account</small><button onClick={() => { setProfileOpen(false); setActiveView('Settings') }}>Account settings</button><button onClick={() => { setProfileOpen(false); notify('You are still signed in to this demo workspace.') }}>Sign out</button></div>}</div></header>
      {activeView === 'Workflows' && <WorkflowLibrary workflows={workflows} runs={runs} onCreate={createWorkflow} onOpenRun={(workflow) => { setSelectedRun(runs.find((run) => run.workflow === workflow) || runs[0]); setActiveView('Overview') }} />}
      <div className={activeView === 'Workflows' ? 'content-wrap workflows-hidden' : 'content-wrap'}>
        {activeView === 'Overview' ? <>
          <div className="page-heading"><div><p className="eyebrow">FRIDAY, OCTOBER 18, 2024 <span className="heading-line" /></p><h1>Good morning, Jordan<span className="period">.</span></h1><p className="subheading">Here is what your automations have been up to.</p></div><button className={isRunning ? 'primary-button running' : 'primary-button'} onClick={runWorkflow}>{isRunning ? 'Running...' : '+ Run workflow'}</button></div>
          <section className="metric-grid" aria-label="Automation metrics"><div className="metric-card"><div className="metric-label">AUTOMATION RUNS <span className="metric-icon">↗</span></div><div className="metric-value">{runs.length + 1243} <span className="trend up">+18.4%</span></div><div className="sparkline"><span style={{ height: '26%' }} /><span style={{ height: '40%' }} /><span style={{ height: '32%' }} /><span style={{ height: '54%' }} /><span style={{ height: '48%' }} /><span style={{ height: '72%' }} /><span style={{ height: '64%' }} /><span style={{ height: '90%' }} /></div><div className="metric-foot">{runs.length} live demo runs</div></div><div className="metric-card"><div className="metric-label">TIME SAVED <span className="metric-icon">◷</span></div><div className="metric-value">186.5 <small>hrs</small> <span className="trend up">+12.8%</span></div><div className="metric-progress"><span style={{ width: '74%' }} /></div><div className="metric-foot">74% of monthly target</div></div><div className="metric-card"><div className="metric-label">SUCCESS RATE <span className="metric-icon">✓</span></div><div className="metric-value">98.2<span className="value-unit">%</span> <span className="trend up">+2.1%</span></div><div className="ring-wrap"><div className="ring"><span>98%</span></div><div><small>Last 30 days</small><strong>Excellent</strong></div></div></div><div className="metric-card accent-card"><div className="metric-label">AI DECISIONS <span className="metric-icon">✦</span></div><div className="metric-value">4,692 <span className="trend purple">+31.6%</span></div><div className="decision-row"><span className="decision-dot" /> 4,609 auto-approved</div><div className="decision-row"><span className="decision-dot muted" /> {runs.filter((run) => run.status === 'Review').length + 82} sent to review</div></div></section>
          <section className="section-block"><div className="section-header"><div><h2>Workflow activity</h2><p>Monitor your automations in real time.</p></div><div className="section-actions"><select className="filter-button" value={filter} onChange={(event) => setFilter(event.target.value as 'All' | RunStatus)}><option>All</option><option>Completed</option><option>Review</option><option>Running</option></select><button className="outline-button" onClick={() => setActiveView('Workflows')}>View all <span>→</span></button></div></div><div className="activity-layout"><div className="run-table"><div className="table-head"><span>WORKFLOW</span><span>STATUS</span><span>RUNTIME</span><span>STARTED</span></div>{filteredRuns.map((run) => <button key={run.id} className={selectedRun.id === run.id ? 'run-row selected' : 'run-row'} onClick={() => setSelectedRun(run)}><div className="workflow-name"><span className="workflow-icon">✦</span><div><strong>{run.workflow}</strong><small>{run.id} <i /> {run.source}</small></div></div><span className={`status status-${run.status.toLowerCase()}`}><span />{run.status}</span><span className="runtime">{run.duration}</span><span className="started">{run.time}<b>›</b></span></button>)}</div><div className="run-detail"><div className="detail-kicker"><span className="detail-icon">✦</span><span>SELECTED RUN</span><span className={`status status-${selectedRun.status.toLowerCase()}`}><span />{selectedRun.status}</span></div><h3>{selectedRun.workflow}</h3><p className="detail-id">{selectedRun.id} <span>·</span> {selectedRun.time}</p><div className="detail-stats"><div><small>CONFIDENCE</small><strong>{selectedRun.confidence}</strong></div><div><small>DURATION</small><strong>{selectedRun.duration}</strong></div></div><div className="steps">{steps.map(([label, detail, time], index) => <div className="step" key={label}><div className="step-marker"><span>{selectedRun.status === 'Running' && index === 2 ? '•' : '✓'}</span>{index !== steps.length - 1 && <i />}</div><div className="step-copy"><strong>{label}</strong><small>{detail}</small></div><time>{time}</time></div>)}</div><button className="detail-link" onClick={() => notify(`${selectedRun.id} audit log opened.`)}>Open run details <span>→</span></button></div></div></section>
          <section className="bottom-grid"><div className="section-block compact"><div className="section-header"><div><h2>Connected systems</h2><p>{healthyConnections} of {connections.length} integrations are healthy.</p></div><button className="plain-link" onClick={() => setActiveView('Connections')}>Manage <span>→</span></button></div><div className="connection-list">{connections.slice(0, 3).map((connection) => <div key={connection.name}><span className={`system-logo ${connection.tone}`}>{connection.logo}</span><strong>{connection.name}</strong><small>{connection.kind} · {connection.connected ? 'Connected' : 'Disconnected'}</small><span className={connection.connected ? 'connection-ok' : 'connection-warning'}>●</span></div>)}</div></div><div className="section-block compact insight-card"><div className="insight-top"><span className="insight-spark">✦</span><span>AI INSIGHT</span><span className="insight-date">{insights[0]?.time}</span></div><h2>{insights[0]?.title}</h2><p>{insights[0]?.body}</p><button className="plain-link" onClick={() => setActiveView('Insights')}>Explore insight <span>→</span></button></div></section>
        </> : activeView === 'Workflows' ? <section className="secondary-view"><div className="page-heading"><div><p className="eyebrow">FLOWPILOT / WORKFLOWS</p><h1>Automation workflows<span className="period">.</span></h1><p className="subheading">Build, monitor, and improve every business process.</p></div><button className="primary-button" onClick={createWorkflow}>+ New workflow</button></div><div className="secondary-grid">{['Inbound lead triage', 'Customer renewal risk', 'Support escalation'].map((name, index) => <button className="secondary-card" key={name} onClick={() => { setSelectedRun(runs.find((run) => run.workflow === name) || runs[0]); setActiveView('Overview') }}><span className="secondary-card-icon">◎</span><span><strong>{name}</strong><small>{index + 24} runs this week · 98% success</small></span><span className="secondary-arrow">→</span></button>)}</div></section> : activeView === 'Connections' ? <section className="secondary-view"><div className="page-heading"><div><p className="eyebrow">FLOWPILOT / CONNECTIONS</p><h1>Connected systems<span className="period">.</span></h1><p className="subheading">Manage the services FlowPilot can securely orchestrate.</p></div><button className="primary-button" onClick={addConnection}>+ Add connection</button></div><div className="secondary-grid">{connections.map((connection) => <button className="secondary-card" key={connection.name} onClick={() => toggleConnection(connection.name)}><span className={`system-logo ${connection.tone}`}>{connection.logo}</span><span><strong>{connection.name}</strong><small>{connection.kind} · {connection.connected ? 'Connected and healthy' : 'Disconnected'}</small></span><span className="secondary-arrow">{connection.connected ? '●' : '○'}</span></button>)}</div></section> : activeView === 'Insights' ? <section className="secondary-view"><div className="page-heading"><div><p className="eyebrow">FLOWPILOT / INSIGHTS</p><h1>AI insights<span className="period">.</span></h1><p className="subheading">Turn operational activity into decisions your team can act on.</p></div><button className="primary-button" onClick={generateInsight}>Generate insight</button></div><div className="insight-list">{insights.map((insight) => <article className="insight-row" key={insight.title}><span className="secondary-card-icon">✦</span><div><h2>{insight.title}</h2><p>{insight.body}</p><small>{insight.time}</small></div></article>)}</div></section> : <section className="secondary-view"><div className="page-heading"><div><p className="eyebrow">FLOWPILOT / SETTINGS</p><h1>Workspace settings<span className="period">.</span></h1><p className="subheading">Configure permissions, alerts, and automation defaults.</p></div><button className="primary-button" onClick={saveSettings}>Save changes</button></div><div className="settings-panel"><label><span><strong>Auto-approve high confidence runs</strong><small>Complete workflows automatically when confidence is above the threshold.</small></span><input type="checkbox" checked={settings.autoApprove} onChange={(event) => setSettings({ ...settings, autoApprove: event.target.checked })} /></label><label><span><strong>Daily operations digest</strong><small>Send a daily summary of runs, reviews, and failures.</small></span><input type="checkbox" checked={settings.dailyDigest} onChange={(event) => setSettings({ ...settings, dailyDigest: event.target.checked })} /></label><label className="threshold"><span><strong>Human review threshold</strong><small>Runs below this confidence score pause for approval.</small></span><output>{settings.reviewThreshold}%</output><input type="range" min="50" max="100" value={settings.reviewThreshold} onChange={(event) => setSettings({ ...settings, reviewThreshold: Number(event.target.value) })} /></label></div></section>}
      </div>
    </main>
    {workflowBuilderOpen && <div className="modal-backdrop" role="presentation" onClick={() => setWorkflowBuilderOpen(false)}><section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">WORKFLOW BUILDER</p><h2 id="workflow-modal-title">Create workflow</h2></div><button className="modal-close" aria-label="Close workflow builder" onClick={() => setWorkflowBuilderOpen(false)}>×</button></div><label className="modal-field">Workflow name<input autoFocus value={draftWorkflow.name} onChange={(event) => setDraftWorkflow({ ...draftWorkflow, name: event.target.value })} placeholder="e.g. Partner lead routing" onKeyDown={(event) => { if (event.key === 'Enter') saveWorkflow() }} /></label><label className="modal-field">Trigger<select value={draftWorkflow.trigger} onChange={(event) => setDraftWorkflow({ ...draftWorkflow, trigger: event.target.value })}><option>Webflow form submission</option><option>Daily at 08:00</option><option>Intercom priority change</option><option>Manual trigger</option></select></label><div className="builder-note"><span>◎</span><p><strong>Connected systems</strong><small>{draftWorkflow.integrations.join(', ')} will be used when this workflow runs.</small></p></div><div className="modal-actions"><button className="outline-button" onClick={() => setWorkflowBuilderOpen(false)}>Cancel</button><button className="primary-button" onClick={saveWorkflow}>Create workflow</button></div></section></div>}
    {supportDemoOpen && <div className="modal-backdrop" role="presentation" onClick={() => setSupportDemoOpen(false)}><section className="workflow-modal support-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">RELATED PROJECT / SUPPORT AUTOMATION</p><h2 id="support-modal-title">AI support triage</h2><p className="modal-subtitle">Classify incoming tickets, route ownership, and close the loop.</p></div><button className="modal-close" aria-label="Close support triage" onClick={() => setSupportDemoOpen(false)}>×</button></div><div className="support-summary"><div><strong>{supportTickets.filter((ticket) => ticket.status === 'Needs review').length}</strong><small>Needs review</small></div><div><strong>{supportTickets.filter((ticket) => ticket.status === 'Assigned').length}</strong><small>Assigned</small></div><div><strong>{supportTickets.filter((ticket) => ticket.status === 'Resolved').length}</strong><small>Resolved</small></div></div><div className="ticket-list">{supportTickets.map((ticket) => <article className="ticket-row" key={ticket.id}><div className="ticket-priority"><span className={`priority-dot priority-${ticket.priority.toLowerCase()}`} /><strong>{ticket.priority}</strong></div><div className="ticket-copy"><strong>{ticket.subject}</strong><small>{ticket.id} · {ticket.customer} · {ticket.channel}</small></div><span className={`ticket-status ticket-${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span><div className="ticket-actions">{ticket.status === 'Needs review' && <button onClick={() => classifyTicket(ticket.id)}>Classify & assign</button>}{ticket.status === 'Assigned' && <button onClick={() => resolveTicket(ticket.id)}>Resolve ticket</button>}{ticket.status === 'Resolved' && <span>Complete</span>}</div></article>)}</div></section></div>}
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
  </div>
}

export default App
