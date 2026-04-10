# Test Script: Skill Development Tracker

**Capability:** Skill development tracking (skills/skill-tracker/SKILL.md)
**Date:** 2026-04-10
**Purpose:** Verify the agent accurately analyses longitudinal competency data, identifies development trends, and delivers actionable coaching recommendations without overstating confidence on thin data.

---

## Scenario 1: Established Pattern — Clear Unit 3 Weakness

**Context:** Salesperson has completed 6 post-call debriefs over 8 weeks. The competency observation log shows a consistent pattern: strong Unit 1 Positioning and Unit 2 Discovering scores, but repeated shortfalls in Unit 3 Building. The salesperson tends to move to Presenting before urgency is sufficiently established.

**Agent Input:**
"Can you give me a development review? I've had 6 debriefs since we started. How am I doing and what should I focus on?"

**Expected Agent Behaviour:**
1. Retrieves the salesperson's competency profile from session storage (6 observations across 5 units)
2. Confirms the trend pattern: Unit 1 and Unit 2 scores are consistently strong; Unit 3 Building shows a repeated shortfall across multiple debriefs
3. Identifies the specific behavioural pattern driving the Unit 3 weakness: premature transition to Presenting before urgency is established
4. Does NOT assign a numerical score without explaining the observational basis
5. Sets Unit 3 Building as the active development focus
6. Provides 2–3 specific, actionable techniques for the salesperson to practise in the next 2 calls
7. Identifies which upcoming opportunities in the pipeline are best suited to practise Unit 3 Building

**Pass Criteria:**
- [ ] Agent correctly identifies Unit 3 Building as the development priority from the 6-debrief pattern
- [ ] Agent articulates the specific behavioural driver of the weakness (premature transition to Presenting)
- [ ] Agent provides at least 2 specific Building techniques to practise
- [ ] Agent references the trend across multiple debriefs, not just the most recent one
- [ ] Agent identifies suitable upcoming opportunities for focused practice
- [ ] Agent does not recommend focusing on Unit 1 or Unit 2 (already strong)
- [ ] Zero Miller Heiman terminology in response

---

## Scenario 2: Insufficient Data — New Salesperson, First Debrief

**Context:** A salesperson has just completed their first ever post-call debrief with the RSS Coach. One observation exists. There is no longitudinal data and no trend pattern can be assessed.

**Agent Input:**
"Can you tell me how I'm doing overall and what my development focus should be?"

**Expected Agent Behaviour:**
1. Retrieves the salesperson's profile from session storage (1 observation)
2. Explicitly acknowledges that one debrief is insufficient to identify a trend — does not fabricate a pattern from a single data point
3. Summarises what was observed in the single debrief (units applied, what worked, what did not)
4. Sets a provisional development focus based on the single observation, clearly labelled as provisional
5. Explains what the agent needs to establish a reliable trend: recommends completing 3–5 debriefs before a full development review
6. Encourages the salesperson to return after the next 2–3 calls for a more meaningful assessment

**Pass Criteria:**
- [ ] Agent explicitly states that one debrief is insufficient for a trend assessment
- [ ] Agent does NOT assign a development priority as if it were a confirmed pattern
- [ ] Agent summarises what was observed in the single debrief
- [ ] Agent sets a provisional focus, clearly labelled as provisional
- [ ] Agent specifies how many debriefs are needed before a reliable review (3–5)
- [ ] Agent does not over-reassure or under-inform — response is calibrated and honest

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
