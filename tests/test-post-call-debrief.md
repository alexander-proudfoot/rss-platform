# Test Script: Post-Call Debrief

**Capability:** Post-call debrief (skills/post-call-debrief/SKILL.md)
**Date:** 2026-04-10
**Purpose:** Verify the agent conducts accurate, methodology-grounded debriefs and correctly assesses matrix movement, unit application, and development observations.

---

## Scenario 1: Successful Call — Customer Moved on Matrix

**Context:** Salesperson has just completed a Presenting session with an existing customer. The customer was previously at High Need / Low Value. By the end of the call, the customer expressed strong interest in proceeding and asked about next steps — indicating a shift to High Need / High Value.

**Agent Input:**
"Just finished a call with James Wright at Caldwell Steel. Before the meeting he understood the problem but wasn't sold on us as the solution. I used the productivity gap data we'd quantified — the 23% figure — and walked him through two comparable client cases. By the end he asked me to send a proposal. I think he's moved. How did I do?"

**Expected Agent Behaviour:**
1. Pulls Zoho context for James Wright / Caldwell Steel and reviews prior matrix position (High Need / Low Value)
2. Confirms matrix movement to High Need / High Value based on customer behaviour described (asked for proposal)
3. Acknowledges correct unit application: Presenting (quantifying the value of the 23% gap, comparable client cases as social proof)
4. Identifies what specifically worked: connecting the 23% figure to demonstrable outcomes, use of social proof
5. Sets next-step coaching focus: Unit 5 Resolving Concerns (proposal follow-up stage will likely surface objections)
6. Logs structured debrief note to SF_Notes in Zoho: units applied, customer response, matrix position update, next action

**Pass Criteria:**
- [ ] Agent confirms matrix movement from High Need / Low Value to High Need / High Value
- [ ] Agent correctly identifies Presenting as the primary unit applied (customer was at Q2 High Need / Low Value — Building not applicable)
- [ ] Agent articulates specifically what worked (not generic praise)
- [ ] Agent recommends Unit 5 Resolving Concerns as the next-step coaching action (proposal follow-up stage will surface objections)
- [ ] Agent confirms it has logged the debrief note to Zoho SF_Notes
- [ ] Zero Miller Heiman terminology in response

---

## Scenario 2: Unsuccessful Call — Concerns Not Resolved

**Context:** Salesperson has just completed a meeting where the customer raised two significant objections to the proposal. The salesperson attempted to respond but the customer ended the meeting without committing to a next step. The deal is at risk.

**Agent Input:**
"Bad call with Elena Vasquez, CFO at Nortech Group. She raised two objections — she said our fees were too high for the projected ROI, and she wasn't sure her board would approve the timeline. I tried to address both but I don't think I landed it. She said she'd think about it. I'm worried the deal is stalling."

**Expected Agent Behaviour:**
1. Pulls Zoho context for Elena Vasquez / Nortech Group
2. Identifies this as a Unit 5 Resolving Concerns failure scenario — concerns were raised but not resolved
3. Diagnoses which specific Resolving Concerns techniques were absent or misapplied (e.g., concern was acknowledged but not isolated, or response addressed the symptom not the root concern)
4. Does NOT recommend immediately re-pitching the proposal
5. Recommends a specific recovery approach: acknowledge the concern fully, probe for the underlying issue behind each objection, quantify the ROI gap if possible
6. Assesses matrix risk: customer may be regressing from High Need / High Value toward Low Value
7. Logs the debrief to Zoho SF_Notes and updates the deal record to reflect the at-risk status

**Pass Criteria:**
- [ ] Agent correctly identifies Unit 5 Resolving Concerns as the primary unit failure
- [ ] Agent diagnoses what specifically went wrong (not just "concerns weren't resolved")
- [ ] Agent does NOT recommend re-pitching the proposal as the recovery move
- [ ] Agent provides a specific recovery approach for each of the two objections
- [ ] Agent flags matrix regression risk
- [ ] Agent confirms Zoho logging and deal status update

---

## Scenario 3: First Discovery Call — New Information Surfaced

**Context:** Salesperson has just completed a first discovery meeting with a new prospect. No prior CRM data existed. The meeting surfaced significant operational challenges and the prospect appeared engaged throughout.

**Agent Input:**
"Good first meeting with Priya Nair, Head of Supply Chain at Apex Logistics. She was really open. She told me they're struggling with inventory accuracy — apparently they have a 12% error rate — and that their last three quarters have all missed fulfilment targets. She asked how other logistics companies have tackled this. No commitment yet but she seemed interested. What do we have?"

**Expected Agent Behaviour:**
1. Acknowledges this was a Unit 2 Discovering session on a new prospect
2. Assesses the quality of discovery: two concrete problems surfaced (12% inventory error rate, missed fulfilment targets), prospect engaged and asked a referencing question
3. Assesses initial Situational Matrix position: Low Need / Low Value → moving toward High Need based on the problems surfaced
4. Notes that the prospect's question ("how have others tackled this?") is a positive engagement signal — but does not yet confirm High Value
5. Recommends next meeting focus: Unit 3 Building — deepen urgency around the inventory and fulfilment problems, introduce comparable client outcomes
6. Logs the new contact and initial discovery notes to Zoho: creates Contact and Account records, logs SF_Notes with the problems surfaced and the initial matrix assessment

**Pass Criteria:**
- [ ] Agent correctly identifies Unit 2 Discovering as the primary unit applied
- [ ] Agent assesses discovery quality (specific problems surfaced, engagement signals)
- [ ] Agent establishes initial matrix position assessment (not just "unknown")
- [ ] Agent recommends Unit 3 Building as the next session focus
- [ ] Agent confirms Zoho CRM records created/updated for the new prospect
- [ ] Agent does not treat the prospect's interest as a commitment

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
