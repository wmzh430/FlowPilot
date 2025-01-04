import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = dirname(fileURLToPath(import.meta.url))
const dataFile = join(root, 'data.json')
const port = Number(process.env.PORT || 8787)

const seed = {
  runs: [
    { id: 'RUN-2481', workflow: 'Inbound lead triage', source: 'Web form', status: 'Completed', duration: '38s', time: '2 min ago', confidence: '98%' },
    { id: 'RUN-2480', workflow: 'Inbound lead triage', source: 'LinkedIn', status: 'Review', duration: '1m 12s', time: '8 min ago', confidence: '76%' },
    { id: 'RUN-2479', workflow: 'Customer renewal risk', source: 'Salesforce', status: 'Completed', duration: '24s', time: '14 min ago', confidence: '94%' },
  ],
  workflows: [
    { name: 'Inbound lead triage', trigger: 'Webflow form submission', integrations: ['Webflow', 'HubSpot', 'Slack'], active: true },
    { name: 'Customer renewal risk', trigger: 'Daily at 08:00', integrations: ['Salesforce'], active: true },
  ],
  connections: [
    { name: 'HubSpot', kind: 'CRM', logo: 'H', tone: 'hubspot', connected: true },
    { name: 'Slack', kind: 'Messaging', logo: 'S', tone: 'slack', connected: true },
    { name: 'Salesforce', kind: 'CRM', logo: 'C', tone: 'salesforce', connected: true },
    { name: 'Webflow', kind: 'Lead capture', logo: 'W', tone: 'webflow', connected: true },
  ],
  insights: [{ title: 'Lead quality is up 22% this week', body: 'Marketing-qualified leads from the new webinar campaign are converting faster than average.', time: 'Today, 9:42 AM' }],
  supportTickets: [{ id: 'SUP-1042', subject: 'Unable to export monthly report', customer: 'Atlas Health', channel: 'Intercom', priority: 'High', status: 'Needs review', owner: 'Unassigned' }],
  settings: { autoApprove: true, dailyDigest: true, reviewThreshold: 80 },
}

async function load() {
  try { return JSON.parse(await readFile(dataFile, 'utf8')) } catch { await mkdir(root, { recursive: true }); await save(seed); return structuredClone(seed) }
}
let writeQueue = Promise.resolve()
async function save(data) {
  const snapshot = JSON.stringify(data, null, 2)
  writeQueue = writeQueue.then(() => writeFile(dataFile, snapshot))
  return writeQueue
}
function send(response, status, payload) { response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); response.end(JSON.stringify(payload)) }
async function body(request) { let value = ''; for await (const chunk of request) value += chunk; return value ? JSON.parse(value) : {} }

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,OPTIONS', 'access-control-allow-headers': 'content-type' }); return response.end() }
  const url = new URL(request.url || '/', `http://${request.headers.host}`)
  if (url.pathname === '/api/health') return send(response, 200, { status: 'ok', service: 'flowpilot-automation-api' })
  if (!url.pathname.startsWith('/api/')) return send(response, 404, { error: 'Not found' })
  const data = await load()
  try {
    if (request.method === 'GET' && url.pathname === '/api/bootstrap') return send(response, 200, data)
    if (request.method === 'POST' && url.pathname === '/api/runs') {
      const run = { id: `RUN-${randomUUID().slice(0, 8)}`, workflow: 'Inbound lead triage', source: 'Manual test', status: 'Running', duration: '-', time: 'Just now', confidence: '-' }
      data.runs.unshift(run); await save(data); setTimeout(async () => { const latest = await load(); const target = latest.runs.find((item) => item.id === run.id); if (target) { target.status = latest.settings.autoApprove && 97 >= latest.settings.reviewThreshold ? 'Completed' : 'Review'; target.duration = '31s'; target.confidence = '97%'; await save(latest) } }, 1600); return send(response, 201, run)
    }
    if (request.method === 'POST' && url.pathname === '/api/workflows') { const value = await body(request); const name = typeof value.name === 'string' ? value.name.trim() : ''; const trigger = typeof value.trigger === 'string' ? value.trigger.trim() : 'Manual trigger'; const integrations = Array.isArray(value.integrations) && value.integrations.every((item) => typeof item === 'string') ? value.integrations : []; if (!name) return send(response, 400, { error: 'Workflow name is required' }); if (name.length > 80) return send(response, 400, { error: 'Workflow name must be 80 characters or fewer' }); if (data.workflows.some((item) => item.name.toLowerCase() === name.toLowerCase())) return send(response, 409, { error: 'Workflow already exists' }); const workflow = { name, trigger, integrations, active: true }; data.workflows.push(workflow); await save(data); return send(response, 201, workflow) }
    if (request.method === 'PATCH' && url.pathname.startsWith('/api/connections/')) { const name = decodeURIComponent(url.pathname.split('/').pop()); const connection = data.connections.find((item) => item.name === name); if (!connection) return send(response, 404, { error: 'Connection not found' }); connection.connected = !connection.connected; await save(data); return send(response, 200, connection) }
    if (request.method === 'POST' && url.pathname === '/api/insights') { const completed = data.runs.filter((item) => item.status === 'Completed').length; const review = data.runs.filter((item) => item.status === 'Review').length; const insight = { title: `${completed} runs completed without intervention`, body: `${review} runs are waiting for review.`, time: 'Just now' }; data.insights.unshift(insight); await save(data); return send(response, 201, insight) }
    if (request.method === 'PATCH' && url.pathname.startsWith('/api/support/tickets/')) { const id = decodeURIComponent(url.pathname.split('/').pop()); const ticket = data.supportTickets.find((item) => item.id === id); if (!ticket) return send(response, 404, { error: 'Ticket not found' }); const value = await body(request); if (value.status && !['Needs review', 'Assigned', 'Resolved'].includes(value.status)) return send(response, 400, { error: 'Invalid ticket status' }); if (value.owner && typeof value.owner !== 'string') return send(response, 400, { error: 'Invalid ticket owner' }); if (value.status) ticket.status = value.status; if (value.owner) ticket.owner = value.owner; await save(data); return send(response, 200, ticket) }
    if (request.method === 'PUT' && url.pathname === '/api/settings') { const value = await body(request); if (typeof value.autoApprove !== 'boolean' || typeof value.dailyDigest !== 'boolean' || !Number.isInteger(value.reviewThreshold) || value.reviewThreshold < 50 || value.reviewThreshold > 100) return send(response, 400, { error: 'Invalid settings payload' }); data.settings = { autoApprove: value.autoApprove, dailyDigest: value.dailyDigest, reviewThreshold: value.reviewThreshold }; await save(data); return send(response, 200, data.settings) }
    return send(response, 404, { error: 'Route not found' })
  } catch (error) { return send(response, 500, { error: error instanceof Error ? error.message : 'Internal server error' }) }
})

server.listen(port, () => console.log(`FlowPilot API listening on http://127.0.0.1:${port}`))
