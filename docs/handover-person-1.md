
# BizPilot AI — Person 1 Frontend Handover

## 1. Responsibility

Person 1 owns the React/TypeScript frontend, administrative pages,
Copilot interaction UI, task progress presentation, approval interface,
safe navigation, and dynamic report renderer.

The frontend currently operates using mock retail data and a simulated
agent. Real operational APIs, LangGraph orchestration, and backend
report validation belong to Persons 2, 3, and 4 respectively.

## 2. Technology

- React and TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts
- TanStack Query
- Axios
- Lucide React
- Playwright

## 3. Start the frontend

From the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open the URL displayed by Vite, normally:

http://localhost:5173/admin

Production build:

```powershell
npm run build
```

Run frontend tests:

```powershell
npx playwright install chromium
npx playwright test
```

## 4. Frontend routes

| Route | Purpose |
|---|---|
| /admin | Executive Dashboard |
| /admin/products | Product management |
| /admin/inventory | Inventory management |
| /admin/sales | Sales analytics |
| /admin/suppliers | Supplier management |
| /admin/purchase-orders | Purchase orders |
| /admin/replenishment | Replenishment |
| /admin/reports | Dynamic reports |

Generated reports use:

/admin/reports?view=<generated-view-id>

## 5. Main source modules

- src/app — Application shell and routing
- src/pages — Eight administrative pages
- src/copilot/CopilotPanel.tsx — Agent interaction UI
- src/types/agent.ts — Agent request/task/result contracts
- src/api/agent.ts — Agent API adapter, currently mocked
- src/mocks/mockAgent.ts — Simulated agent workflow
- src/mocks/generatedReports.ts — Demo report generation
- src/types/dynamicView.ts — Dynamic report schema and validator
- src/dynamic-ui/DynamicViewRenderer.tsx — Approved-widget renderer
- src/types/apiContracts.ts — Proposed operational API contracts
- src/api/endpoints.ts — Proposed endpoint definitions

## 6. Copilot interface

The Copilot supports:

- Natural-language request submission
- Conversation messages
- Task status and plan-step timeline
- Tool execution information when supplied
- Approval and cancellation UI
- Result summaries, findings, and evidence
- Error and partial-failure display
- Validated navigation instructions
- Demo generated-dashboard navigation

The current agent implementation is simulated.

IMPORTANT: Demo approval does not perform real deletion or modify
authoritative backend data.

## 7. Backend integration

Person 2:
Connect product, inventory, sales, supplier, purchase-order, and
replenishment endpoints. Replace mock data sources with backend API
calls. Use stable IDs, real loading/error states, and refetch after
verified writes.

Person 3:
Replace the mock agent adapter in src/api/agent.ts with real agent
request, task-status, and approval endpoints. Preserve the established
TypeScript contracts, and coordinate any schema changes.

Person 4:
Connect validated dynamic report specifications, report preview,
save, and load endpoints. Keep schema validation and the approved
React widget allowlist.

Proposed API contracts must be reviewed against the actual backend
OpenAPI/Pydantic schemas before integration.

## 8. Security boundaries

- The frontend does not authorize operations.
- Real confirmation must be validated server-side.
- Only registered routes should be navigated programmatically.
- Dynamic reports are rendered through an approved widget registry.
- Arbitrary generated JavaScript or HTML must not be executed.
- Real business mutations must be verified by backend responses.
- Never store LLM provider secrets in frontend environment variables.

## 9. Automated test results

Latest confirmed Playwright result: 27/27 passed.

Coverage includes:

- Admin navigation
- Copilot navigation
- Generated dashboard creation and reopening
- Demo approval and cancellation
- Products catalogue and SKU search
- Unsupported-route navigation safety
- Dynamic report schema validation
- Tablet-viewport route smoke tests

A previous production build completed successfully.

These tests do not establish full backend integration, all error-state
rendering, or complete mobile responsiveness.

## 10. Known limitations

- Most frontend business data currently comes from mock fixtures.
- Some product operations are stored only in browser-local state.
- Business modules are not yet synchronized through one database.
- Agent progress is simulated rather than streamed/polled from backend.
- Approval is demo-only, with no destructive backend action.
- Report generation is mock-based.
- Tool execution cards are implemented but not yet exercised against
  real backend execution events.
- Responsive tests currently cover a tablet viewport, not all phones.
- Final backend contracts and authentication remain pending.

## 11. Next three integration actions

1. Agree on final Pydantic/TypeScript schemas and connect operational
   read APIs with Person 2.
2. Connect real agent task progress and server-side approval endpoints
   with Person 3.
3. Connect registered report validation/save/load with Person 4,
   then run an end-to-end replenishment flow.

## 12. Current handover status

Frontend mock-mode prototype: implemented and operational.

Automated Playwright tests: 27 passed, 0 failed.

Backend-connected acceptance criteria: pending integration.

The frontend should remain runnable in mock mode during integration.
