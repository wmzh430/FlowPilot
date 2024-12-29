type WorkflowDefinition = { name: string; trigger: string; integrations: string[]; active: boolean }
type WorkflowRun = { workflow: string }

type WorkflowLibraryProps = {
  workflows: WorkflowDefinition[]
  runs: WorkflowRun[]
  onCreate: () => void
  onOpenRun: (workflow: string) => void
}

function WorkflowLibrary({ workflows, runs, onCreate, onOpenRun }: WorkflowLibraryProps) {
  return <section className="secondary-view workflow-library-view">
    <div className="page-heading">
      <div><p className="eyebrow">FLOWPILOT / WORKFLOWS</p><h1>Automation workflows<span className="period">.</span></h1><p className="subheading">Build, monitor, and improve every business process.</p></div>
      <button className="primary-button" onClick={onCreate}>+ New workflow</button>
    </div>
    <div className="workflow-library-grid">
      {workflows.map((workflow) => {
        const runCount = runs.filter((run) => run.workflow === workflow.name).length
        return <article className="workflow-definition-card" key={workflow.name}>
          <button className="workflow-definition-main" onClick={() => onOpenRun(workflow.name)}>
            <span className="secondary-card-icon">◎</span>
            <span><strong>{workflow.name}</strong><small>{workflow.trigger}</small><small>{workflow.integrations.join(' · ') || 'No integrations configured'}</small></span>
            <span className="secondary-arrow">›</span>
          </button>
          <div className="workflow-definition-meta"><span>{runCount} recorded runs</span><span className={workflow.active ? 'workflow-active' : 'workflow-paused'}>{workflow.active ? 'Active' : 'Paused'}</span></div>
        </article>
      })}
      {workflows.length === 0 && <div className="empty-state"><strong>No workflows yet</strong><p>Create your first automation to start routing work.</p><button className="outline-button" onClick={onCreate}>Create workflow</button></div>}
    </div>
  </section>
}

export default WorkflowLibrary
