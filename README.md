# RSS Platform

**Directive:** D098
**Phase:** 1 (Internal Proof of Concept)
**Status:** In Development

Proudfoot's RSS Platform is an AI sales coaching agent that encodes the Relationship Selling Skills (RSS) methodology. It provides Proudfoot's internal sales team with pre-call coaching, post-call debriefs, and longitudinal skill development tracking.

---

## What It Does

| Capability | Description |
|-----------|-------------|
| **Pre-Call Coaching** | Before any customer meeting, the agent reviews the opportunity context from Zoho CRM, assesses the customer's Situational Matrix position, and delivers a coaching brief with specific RSS unit recommendations and questioning strategy. |
| **Post-Call Debrief** | After a customer interaction, the agent conducts a structured debrief: which RSS units were applied, how the customer responded, whether the Situational Matrix position shifted, and what the salesperson should do differently next time. |
| **Skill Development Tracking** | Across multiple debriefs, the agent builds a longitudinal competency profile per salesperson, tracking trends across all 5 RSS units and identifying the development priority. |

---

## Methodology

The RSS Platform encodes Proudfoot's Relationship Selling Skills (RSS) methodology — developed in the mid-1980s and deployed to 30+ clients globally. Key frameworks:

- **Situational Matrix** — customer position assessed on two dimensions: perception of need and perception of value
- **5-Unit Model** — Positioning, Discovering, Building, Presenting, Resolving Concerns
- **Coaching Framework** — four-step Observe-Think-Decide-Act cycle from the RSS Coaching Manual

All methodology content is digitised from SharePoint RSS source documents and subject to David Warren's validation via the Methodology Lab before production deployment.

---

## Directory Structure

```
rss-platform/
├── CLAUDE.md                          # Claude Code context (v4.3 adapted for Managed Agents)
├── REVIEW.md                          # Code review checklist
├── README.md                          # This file
├── .claude/settings.json              # 14-plugin standard set
├── .github/workflows/
│   └── auto-add-to-project.yml        # Auto-add issues to Product Board
├── methodology/                       # RSS methodology source files
│   ├── rss-situational-matrix.md      # Foundational matrix framework
│   ├── rss-5-unit-model.md            # All 5 RSS units with techniques
│   ├── rss-coaching-methodology.md    # RSS coaching: Observe-Think-Decide-Act cycle
│   ├── rss-sales-mos.md               # Sales Management Operating System
│   └── miller-heiman-exclusion-register.md  # IP exclusion governance
├── skills/                            # SKILL.md files (agent capabilities)
│   ├── pre-call-coaching/SKILL.md     # Pre-call coaching skill
│   ├── post-call-debrief/SKILL.md     # Post-call debrief skill
│   ├── skill-tracker/SKILL.md         # Skill development tracking
│   └── shared/
│       └── rss-methodology-reference.md  # Context-optimised shared reference
├── agent/                             # Agent configuration
│   ├── system-instructions.md         # Managed agent system prompt
│   ├── tool-definitions.md            # Tool/MCP connection documentation
│   └── managed-agent-config.yaml      # Managed Agents API configuration
├── tests/                             # Test scripts
│   ├── test-pre-call-coaching.md      # 3 test scenarios
│   ├── test-post-call-debrief.md      # 3 test scenarios
│   └── test-skill-tracker.md          # 2 test scenarios
├── docs/
│   └── architecture.md                # Phase 1 architecture + Mermaid diagram
└── Audit/
    ├── build-plans/D098-plan.md        # D098 build plan
    └── logs/                           # Script execution logs
```

---

## Phase 1 Scope

Phase 1 is an internal PoC for Proudfoot's sales team only. There is no web frontend, no client-facing deployment, and no multi-agent coordination in Phase 1.

See [docs/architecture.md](docs/architecture.md) for full architecture details.

---

## Methodology Validation

All RSS methodology encoding requires validation by David Warren via the Methodology Lab before production deployment. See [Issue #2](https://github.com/alexander-proudfoot/rss-platform/issues/2).

Miller Heiman IP exclusion register: [methodology/miller-heiman-exclusion-register.md](methodology/miller-heiman-exclusion-register.md)

---

## Directive

D098 — RSS Platform Phase 1 (2026-04-10)

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.

---

## Phase 2: SWA + Managed Agent Backend (D099)

Phase 2 adds a web-based coaching platform (Azure Static Web App) that connects to the RSS Managed Agent.

### Architecture

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4
- **Backend:** Azure Functions v4 (Node 20)
- **Database:** Azure SQL
- **AI:** Claude Managed Agent (Anthropic)
- **Auth:** Azure AD via SWA built-in auth

### Screens

| Screen | Path | Purpose |
|--------|------|---------|
| Coaching | `/coaching` | Chat panel with pre-call, post-call, and dev review modes |
| Matrix | `/matrix` | Situational Matrix 4-quadrant visualization |
| Dashboard | `/dashboard` | Development profile with per-unit scores and trends |
| History | `/history` | Browse past coaching sessions |

### Local Development

```bash
# Install dependencies
npm ci && cd api && npm ci && cd ..

# Copy environment variables
cp .env.example api/local.settings.json  # Adapt format for Azure Functions

# Start frontend dev server
npm run dev

# Start API (requires Azure Functions Core Tools)
cd api && func start
```

### Environment Variables

See `.env.example` for required configuration. All secrets should be stored in Azure Key Vault for production.
