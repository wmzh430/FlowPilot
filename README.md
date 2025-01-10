# FlowPilot

FlowPilot is a portfolio project for an AI Automation & Integrations Engineer role. It presents a realistic operations dashboard for monitoring AI-powered workflows across marketing, sales, and support.

## What this demonstrates

- AI workflow monitoring with confidence scores, step-level run history, and human review routing
- Integrations with CRM, messaging, enrichment, and web form systems
- KPI reporting for automation volume, time saved, success rate, and AI decisions
- A product-minded frontend built with React, TypeScript, and Vite
- Working local orchestration: run a workflow, watch it complete, inspect its steps, filter runs, and persist the run history across refreshes
- Working connection management, AI insight generation, workspace settings, notifications, and action feedback
- A related AI Support Triage project for classifying, assigning, and resolving customer tickets

## Run locally

```bash
npm install
npm run dev
```

Start the local automation API in a second terminal:

```bash
npm run api
```

The API runs on `http://127.0.0.1:8787` and the Vite development server proxies `/api` requests to it. The server persists data in `server/data.json`, so runs, workflows, connections, support tickets, insights, and settings survive browser refreshes and can be inspected independently from the UI.

## Demo flows

1. Open **Overview** and select a run to inspect its step-by-step execution.
2. Click **Run workflow** to create a live run. It completes after the simulated orchestration delay and is saved in browser storage.
3. Use the status filter or **View all** to inspect workflow history.
4. Open **Connections** to add the OpenAI demo connection or toggle a provider on and off.
5. Open **Insights** to generate a new operational insight.
6. Open **Settings** to change the confidence threshold and notification preferences, then save.
7. Open **Support triage** in the sidebar to demonstrate a second automation workflow: classify a high-priority ticket, assign an owner, and resolve it.

## Portfolio talking points

The primary example is an inbound lead triage workflow: a webhook captures a lead, a company enrichment service adds context, an LLM returns a structured intent classification, the CRM assigns an owner and priority, and Slack receives an alert. The related Support Triage project shows the same orchestration pattern applied to customer operations: classify, route, and resolve. This repository implements both interaction loops locally with persisted browser state so they can be demonstrated without credentials. In production, the local store would be replaced by a job queue, API/webhook layer, audit log, and provider adapters with secrets managed outside the application.

## Engineering architecture

- `server/index.mjs`: dependency-free HTTP API with route-level validation and JSON persistence
- `src/api.ts`: typed frontend API client and request boundary
- `src/App.tsx`: dashboard state and local fallback behavior
- `vite.config.ts`: development proxy from the React client to the automation API

The API is intentionally dependency-free for a portable portfolio demo. The same boundaries can be moved to Express/Fastify, Postgres, a queue worker, and provider adapters when deployed.
