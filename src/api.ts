type WorkflowRun = { id: string; workflow: string; source: string; status: 'Completed' | 'Review' | 'Running'; duration: string; time: string; confidence: string }
type WorkflowDefinition = { name: string; trigger: string; integrations: string[]; active: boolean }
type Connection = { name: string; kind: string; logo: string; tone: string; connected: boolean }
type Insight = { title: string; body: string; time: string }
type SupportTicket = { id: string; subject: string; customer: string; channel: string; priority: 'High' | 'Medium' | 'Low'; status: 'Needs review' | 'Assigned' | 'Resolved'; owner: string }
type Settings = { autoApprove: boolean; dailyDigest: boolean; reviewThreshold: number }
export type Bootstrap = { runs: WorkflowRun[]; workflows: WorkflowDefinition[]; connections: Connection[]; insights: Insight[]; supportTickets: SupportTicket[]; settings: Settings }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    try {
        const response = await fetch(path, { headers: { 'content-type': 'application/json' }, signal: controller.signal, ...options })
        const text = await response.text()
        let payload: { error?: string } & T
        try { payload = JSON.parse(text) as { error?: string } & T } catch { throw new Error(`Invalid server response (${response.status})`) }
        if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`)
        return payload as T
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Request timed out')
        throw error
    } finally { window.clearTimeout(timeout) }
}

export const api = {
    bootstrap: () => request<Bootstrap>('/api/bootstrap'),
    createRun: () => request<WorkflowRun>('/api/runs', { method: 'POST' }),
    createWorkflow: (workflow: Pick<WorkflowDefinition, 'name' | 'trigger' | 'integrations'>) => request<WorkflowDefinition>('/api/workflows', { method: 'POST', body: JSON.stringify(workflow) }),
    toggleConnection: (name: string) => request<Connection>(`/api/connections/${encodeURIComponent(name)}`, { method: 'PATCH' }),
    createInsight: () => request<Insight>('/api/insights', { method: 'POST' }),
    updateTicket: (id: string, update: Partial<SupportTicket>) => request<SupportTicket>(`/api/support/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(update) }),
    saveSettings: (settings: Settings) => request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
}
