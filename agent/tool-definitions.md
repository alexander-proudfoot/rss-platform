# RSS Platform — Tool Definitions

**Version:** 1.0
**Date:** 2026-04-10

This document describes the tools available to the RSS Coaching Agent.

---

## Zoho CRM (Read)

**Connection:** Zoho CRM MCP connector (D068)
**Purpose:** Pull customer and opportunity context before pre-call coaching

### Modules Used for Reading

| Module | API Name | Contents |
|--------|----------|----------|
| Accounts | Accounts | Client companies, account classification, relationship history |
| Contacts | Contacts | Active pipeline contacts, salesperson's contact list |
| Deals | Deals | Sales opportunities: stage, value, owner, deal history |
| Meetings | Events | Meeting history: type, status, attendees, outcomes |

### Usage
- Before every pre-call coaching session: pull the relevant account, contact, deal, and recent meeting history
- Person search: search Contacts module first; check Accounts for company context
- Company search: search Accounts and Deals for current relationship and pipeline status

---

## Zoho CRM (Write)

**Connection:** Zoho CRM MCP connector (D068)
**Purpose:** Log coaching observations and post-call debrief notes

### Modules Used for Writing

| Module | API Name | What Is Written |
|--------|----------|----------------|
| Meeting Notes | SF_Notes | Post-call debrief structured notes: RSS units applied, customer responses, Situational Matrix position update, next-step actions |
| Deals | Deals | Coaching notes field only — the agent does not modify deal stages, values, or dates |

### Usage
- After every post-call debrief: log structured notes to SF_Notes module
- Format: RSS unit applied → customer response → matrix position assessment → next action
- Same-day logging is non-negotiable

---

## Session Persistence

**Mechanism:** Claude Managed Agent session persistence
**Purpose:** Maintain coaching continuity across multiple sessions per salesperson

### Data Persisted
- Salesperson development profiles (per-unit competency scores, observation log, trend assessment)
- Situational Matrix position history per customer opportunity
- Active development focus unit
- Prior coaching conversation context

### Continuity
The agent maintains context across sessions for each salesperson. A salesperson who completes a debrief on Monday receives development recommendations on Wednesday that are informed by Monday's observation.

---

## Anthropic SDK (Agent Runtime)

**SDK:** `@anthropic-ai/sdk`
**Model:** `claude-sonnet-4-6` (default coaching), `claude-opus-4-6` (deep analysis mode)
**Deployment:** Claude Managed Agents API

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
