# Test Script: Pre-Call Coaching

**Capability:** Pre-call coaching (skills/pre-call-coaching/SKILL.md)
**Date:** 2026-04-10
**Purpose:** Verify the agent delivers accurate, methodology-grounded coaching briefs across different opportunity contexts.

---

## Scenario 1: New Prospect — No CRM History

**Context:** Salesperson is preparing for a first meeting with a new prospect. No prior CRM data. No matrix position established.

**Agent Input:**
"I have a first meeting tomorrow with Sarah Chen, VP Operations at Meridian Manufacturing ($450M revenue, automotive parts, 2,000 employees). I don't know much about her yet. Can you help me prepare?"

**Expected Agent Behaviour:**
1. Attempts to pull Zoho CRM data (finds nothing — new prospect)
2. Defaults to Unit 2 Discovering as primary unit (per operational rule 5)
3. Addresses Unit 1 Positioning — how to establish credibility as a valued advisor from the first interaction
4. Recommends specific discovery questions appropriate for an operations VP in manufacturing
5. Establishes baseline Situational Matrix position as "unknown" and explains how to assess it during the meeting
6. Sets success criteria: what observable customer behaviours would indicate need perception has been established

**Pass Criteria:**
- [ ] Agent acknowledges no prior CRM data
- [ ] Agent recommends Unit 2 Discovering as primary
- [ ] Agent provides specific Positioning approach (Unit 1)
- [ ] Agent recommends at least 3 specific discovery questions
- [ ] Agent defines success criteria in terms of customer response, not salesperson activity
- [ ] Zero Miller Heiman terminology in response

---

## Scenario 2: Existing Customer — Situational Matrix Position Established

**Context:** Follow-up meeting with an existing customer who has been through 2 prior discovery meetings. Matrix position is established as High Need / Low Value (customer recognises the problem but hasn't connected to Proudfoot's solution value).

**Agent Input:**
"I'm meeting with James Wright, Plant Manager at Caldwell Steel, next Thursday. He's been engaged for 3 months. We've had 2 good discovery meetings. He clearly sees the problem — productivity is down 23% — but he's not convinced Proudfoot is the right solution. What should I focus on?"

**Expected Agent Behaviour:**
1. Pulls Zoho context for James Wright / Caldwell Steel
2. Assesses matrix position as High Need / Low Value (explicitly stated in input)
3. Identifies Unit 4 Presenting and Unit 5 Resolving as primary units for this position
4. Advises on Presenting approach: solution framing connected to the specific operational challenges surfaced in discovery, quantifying the value of the 23% productivity improvement
5. Identifies likely concerns (why Proudfoot over alternatives, implementation risk, ROI evidence) and prepares Resolving approach for each
6. Does NOT recommend Building (need is already established — customer sees the problem clearly)

**Pass Criteria:**
- [ ] Agent correctly identifies High Need / Low Value matrix position
- [ ] Agent recommends Presenting (Unit 4) and Resolving (Unit 5) as primary
- [ ] Agent does NOT recommend Building (need is already established)
- [ ] Agent does NOT recommend further Discovering (need is established)
- [ ] Agent's presenting advice quantifies value in terms of the customer's specific 23% productivity gap
- [ ] Agent surfaces likely concerns (Proudfoot differentiation, ROI, implementation) and prepares a Resolving approach

---

## Scenario 3: Stalled Deal — Repositioning Required

**Context:** A deal that was progressing has stalled. The customer had been at High Need / High Value but has gone quiet after a proposal was submitted 6 weeks ago. Salesperson suspects the customer has lost urgency.

**Agent Input:**
"I'm trying to re-engage with Marco Ferreira, CEO of Ferrex Industries. We had great momentum 2 months ago — he was excited about our proposal. Now he's not returning calls. I have a meeting set next week that he almost cancelled. I think he's lost urgency. What's my approach?"

**Expected Agent Behaviour:**
1. Pulls Zoho context for Marco Ferreira / Ferrex Industries
2. Assesses likely matrix regression: customer may have moved from High Need to Low Need (urgency lost)
3. Recommends Unit 1 Positioning reset followed by Unit 3 Building to re-establish need urgency
4. Advises against jumping straight to proposal follow-up (Unit 4 presenting without rebuilding need)
5. Recommends specific re-establishing approach: credibility reset, discovery of what has changed, critical questioning to resurface the original problem
6. Flags the matrix regression as a development observation for the salesperson's skill profile

**Pass Criteria:**
- [ ] Agent diagnoses likely matrix regression (High Need → Low Need)
- [ ] Agent recommends Positioning reset (Unit 1)
- [ ] Agent recommends Building to re-establish urgency (Unit 3)
- [ ] Agent does NOT recommend leading with proposal follow-up
- [ ] Agent recommends specific techniques for re-engagement, not generic "re-engage" advice

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
