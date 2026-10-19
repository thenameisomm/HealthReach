# HealthReach AI — Documentation Index

This directory contains the complete technical documentation for HealthReach AI, organized by domain. Each document is written to be useful on its own while cross-linking to related topics.

## Quick Navigation

| Category | Documents |
|---|---|
| **Product** | [Product Brief](product/PRODUCT_BRIEF.md) · [Problem & Users](product/PROBLEM_AND_USERS.md) · [Scope & Non-Goals](product/SCOPE_AND_NON_GOALS.md) · [User Flows](product/USER_FLOWS.md) · [Product Requirements](product/PRODUCT_REQUIREMENTS.md) · [Roadmap](product/ROADMAP.md) |
| **Architecture** | [System Overview](architecture/SYSTEM_OVERVIEW.md) · [Architecture Decisions](architecture/ARCHITECTURE_DECISIONS.md) · [Data Flow](architecture/DATA_FLOW.md) · [Agent Orchestration](architecture/AGENT_ORCHESTRATION.md) · [Error Handling](architecture/ERROR_HANDLING.md) · [Security & Privacy](architecture/SECURITY_AND_PRIVACY.md) |
| **Integrations** | [Qloo Integration](integrations/QLOO_INTEGRATION.md) · [Qloo Agent Chain](integrations/QLOO_AGENT_CHAIN.md) · [LLM Contract](integrations/LLM_CONTRACT.md) · [OSM Integration](integrations/OSM_INTEGRATION.md) · [Geocoding & Location](integrations/GEOCODING_AND_LOCATION.md) · [External Services](integrations/EXTERNAL_SERVICES.md) |
| **Data** | [Data Model](data/DATA_MODEL.md) · [MongoDB Collections](data/MONGODB_COLLECTIONS.md) · [Provenance Model](data/PROVENANCE_MODEL.md) · [Estimates & Metrics](data/ESTIMATES_AND_METRICS.md) |
| **API** | [API Overview](api/API_OVERVIEW.md) · [API Contracts](api/API_CONTRACTS.md) · [Error Responses](api/ERROR_RESPONSES.md) · [API Change Policy](api/API_CHANGE_POLICY.md) |
| **Frontend** | [Frontend Architecture](frontend/FRONTEND_ARCHITECTURE.md) · [Routes & Workspace](frontend/ROUTES_AND_WORKSPACE.md) · [Design System](frontend/DESIGN_SYSTEM.md) · [Accessibility](frontend/ACCESSIBILITY.md) · [Visualization Guidelines](frontend/VISUALIZATION_GUIDELINES.md) |
| **Quality** | [Acceptance Criteria](quality/ACCEPTANCE_CRITERIA.md) · [Test Strategy](quality/TEST_STRATEGY.md) · [Manual QA](quality/MANUAL_QA.md) · [Release Checklist](quality/RELEASE_CHECKLIST.md) |
| **Operations** | [Getting Started](operations/GETTING_STARTED.md) · [Configuration](operations/CONFIGURATION.md) · [Development Workflow](operations/DEVELOPMENT_WORKFLOW.md) · [Runbook](operations/RUNBOOK.md) · [Troubleshooting](operations/TROUBLESHOOTING.md) |
| **Project** | [Decisions Log](project/DECISIONS_LOG.md) · [Risks & Mitigations](project/RISKS_AND_MITIGATIONS.md) · [Progress](project/PROGRESS.md) · [TODO](project/TODO.md) · [Changelog](project/CHANGELOG.md) |

## How to Use This Documentation

- **New contributors**: Start with [Product Brief](product/PRODUCT_BRIEF.md) and [Getting Started](operations/GETTING_STARTED.md).
- **Implementing a feature**: Read the relevant [Product Requirements](product/PRODUCT_REQUIREMENTS.md), [Acceptance Criteria](quality/ACCEPTANCE_CRITERIA.md), and [API Contracts](api/API_CONTRACTS.md).
- **Debugging**: Check [Troubleshooting](operations/TROUBLESHOOTING.md) and [Error Responses](api/ERROR_RESPONSES.md).
- **Architecture review**: Read [System Overview](architecture/SYSTEM_OVERVIEW.md) and [Architecture Decisions](architecture/ARCHITECTURE_DECISIONS.md).

## Documentation Standards

- Every document has a clear scope stated at the top.
- Cross-references use relative links (e.g., `../architecture/SYSTEM_OVERVIEW.md`).
- Implementation status is marked: **Implemented**, **Partially Implemented**, **Specified Only**, **Blocked**, **Needs Verification**.
- Diagrams use Mermaid syntax for version-controlled rendering.
- API contracts reference the actual FastAPI route definitions and Pydantic models as the source of truth.

## Maintaining Documentation

- Update documentation in the same commit as the behavior change.
- Keep the [Decisions Log](project/DECISIONS_LOG.md) current with rationale.
- Update [Progress](project/PROGRESS.md) and [TODO](project/TODO.md) after each milestone.
- Run link validation before merging: `pnpm exec markdown-link-check docs/**/*.md` (when available).

---

*Last updated: 2026-10-20*