---
name: post-call-debrief
description: "Conducts a structured post-call debrief after any customer interaction. Captures what RSS techniques were used and how the customer responded, updates the customer's Situational Matrix position, assesses skill application effectiveness, logs observations to the salesperson's development profile, and generates action items for the next interaction."
---

# Post-Call Debrief

The post-call debrief skill structures the analysis of a completed customer interaction using the RSS Relationship Selling Skills methodology. It uses a structured questioning approach to surface what actually happened (not what the salesperson hoped happened), maps the interaction against the RSS 5-Unit Model, reassesses the customer's Situational Matrix position based on observed evidence, and generates development insights and next-step actions.

Load `skills/shared/rss-methodology-reference.md` for the RSS methodology reference.

---

## Quick Reference

| Element | Requirement |
|---------|-------------|
| Situational Matrix position | Must be reassessed with evidence after every interaction -- even if unchanged, the assessment must be stated with supporting evidence |
| RSS unit mapping | Every unit attempted during the interaction must be identified and assessed for effectiveness |
| Customer evidence | At least one specific customer statement or observable behaviour must anchor the matrix position assessment |
| Skill effectiveness | Each unit applied must be rated (effective / ineffective / not applicable) with customer response evidence |
| Development observations | Logged to the salesperson's development profile as distinct from immediate action items |
| Next-step actions | Specific to the next interaction with this customer -- never generic development advice |
| Pre-call brief adherence | If a pre-call coaching brief was issued, assess adherence; if not, note the gap |

---

## When to Use

- After any completed customer meeting (first meeting, follow-up, presentation, or discovery walkthrough)
- When a salesperson returns from a customer call and needs to extract structured learnings
- When a manager has observed a joint call and wants to conduct a coaching debrief using the RSS model
- When an opportunity has stalled and a retrospective debrief of the last interaction is needed to diagnose why
- When a salesperson wants to self-assess their skill application before their next interaction
- When a series of debriefs needs to be logged to build a development pattern over time

---

## Inputs to Gather

| Input | Required For | Required? |
|-------|-------------|-----------|
| Account name and deal reference | Linking the debrief to the correct opportunity in Zoho CRM and retrieving prior matrix position | Yes |
| Contact name and role | Contextualising the customer's responses and assessing whether the right person was engaged | Yes |
| Meeting type (first meeting, follow-up, presentation, discovery walkthrough) | Determining which RSS units were in scope for this interaction | Yes |
| Customer's prior Situational Matrix position | Required baseline for assessing whether the customer's perception of need or value has shifted | Yes |
| Salesperson's account of the meeting | What was said, what the customer did and said, what the salesperson attempted -- the raw material for debrief analysis | Yes |
| Pre-call coaching brief (if issued) | Assessing adherence to the planned approach and whether the coaching recommendations were applied | No |
| Salesperson's current skill development focus | Determining which skill dimensions to probe most deeply during the debrief | No |
| Deal stage | Affecting how to weight matrix movement in next-step recommendations | No |

---

## Workflow

### Step 1: Structured Debrief Intake

Gather the salesperson's account of the meeting through structured questioning. Do not accept summary statements -- probe for specifics:

1. What was the stated purpose of the meeting and was it communicated to the customer at the outset?
2. What did the salesperson say and do during the meeting? What techniques did they consciously apply?
3. What did the customer say and do? What specific statements did the customer make about their situation, needs, or perception of the salesperson's solution?
4. What commitment was requested at the end of the meeting? What was the customer's response?
5. What surprised the salesperson? What went differently than expected?

If the salesperson offers only "it went well" or "it was a good meeting," redirect with: "What specifically did the customer say or do that tells you it went well?" Every outcome must be anchored to observable customer behaviour.

### Step 2: Map the Interaction to RSS Units

Based on the salesperson's account, identify which RSS units were applied during the interaction and which were skipped or missed:

- **Unit 1 Positioning:** Did the salesperson re-establish purpose at the start? Was a GBS delivered or was the meeting opened without context-setting?
- **Unit 2 Discovering:** Were open questions used to explore the customer's situation? Was a joint definition of needs pursued, or did the salesperson assume needs?
- **Unit 3 Building:** Were critical questions used to deepen the customer's perception of need? Did the salesperson help the customer articulate the impact and consequences of identified problems?
- **Unit 4 Presenting:** Were solutions presented after needs were discovered and built? Were options provided with customer involvement, or was a single solution prescribed?
- **Unit 5 Resolving:** Were customer concerns identified and addressed using the Understand-Confirm-Acknowledge-Answer-Check framework? Were concerns treated as interest signals or as objections to overcome?

For each unit, record whether it was: **Applied**, **Skipped** (was in scope but not used), or **Not in scope** (not expected given the meeting type and matrix position). Skipped units must be assessed for the impact of their omission.

### Step 3: Update the Situational Matrix Position

Reassess the customer's Situational Matrix position based on their actual responses during this interaction. Compare against the prior position to determine whether movement occurred:

1. **Perception of need:** What did the customer say or do that indicates their current perception of need? Has it increased, decreased, or remained static compared to the prior assessment?
2. **Perception of value:** What did the customer say or do that indicates their current perception of value in working with the salesperson's organisation? Has it shifted?

The reassessment must be supported by at least one specific customer statement or observable behaviour. Salesperson interpretation alone is insufficient -- the evidence must be something the customer said or did, not what the salesperson believes the customer was thinking.

If the matrix position has not changed, state this explicitly with evidence for why the assessment remains the same. A static position is still a data point that must be recorded.

If the matrix position has regressed (e.g., the customer moved from partial need awareness back to low need), identify the specific interaction moment that caused the regression and which unit should be revisited in the next meeting.

### Step 4: Assess Skill Effectiveness

For each RSS unit that was applied during the interaction, assess whether it achieved its intended effect:

- **Unit 1 Positioning -- Effective if:** the customer understood the purpose of the meeting, granted permission to proceed, and began sharing information openly.
- **Unit 2 Discovering -- Effective if:** both parties arrived at a shared, specific definition of needs; problems were converted to jointly confirmed needs.
- **Unit 3 Building -- Effective if:** the customer articulated the impact of their problems in their own words, demonstrated urgency, or quantified the cost of inaction.
- **Unit 4 Presenting -- Effective if:** the customer articulated how the solution addresses their needs, demonstrated ownership of the proposed approach, or engaged in joint development of the solution.
- **Unit 5 Resolving -- Effective if:** concerns were identified, addressed with the appropriate tactic (evidence for doubt, correction for misinformation, weighing for legitimate concern), and the customer confirmed resolution.

A unit must not be logged as "applied" if the customer's response shows it did not achieve its intended effect. If Unit 3 Building was attempted but the customer's perception of need did not increase, record it as "applied but ineffective" with the specific customer response that indicates the gap.

### Step 5: Log Observations and Generate Next-Step Actions

Produce two distinct outputs:

**Development observations (logged to the salesperson's profile):**
Record skill-level observations that inform longer-term development patterns. These are not tied to the next specific interaction but to the salesperson's overall skill trajectory. Examples:
- "Consistently strong at Positioning -- GBS delivery is natural and well-tailored to customer context"
- "Pattern of moving to Presenting before Building is complete -- customer perception of need was not fully developed before solutions were introduced in three of the last four interactions"
- "Discovering questions tend to be closed rather than open -- needs practice with general-to-specific questioning strategy"

**Next-step action items (specific to the next interaction with this customer):**
Generate actions that are specific to the next meeting with this customer, grounded in the matrix position reassessment and the unit effectiveness analysis. Each action must name the RSS unit, the specific technique to use, and the customer-specific context. Examples:
- "Next meeting: re-open Building (Unit 3) with a critical question about the operational cost of the manual reconciliation process the customer mentioned -- they acknowledged the problem but did not articulate urgency"
- "Next meeting: deliver a revised GBS (Unit 1) that references the customer's Q2 expansion timeline, which they mentioned for the first time in this meeting"
- "Next meeting: prepare for a Doubt concern (Unit 5) on implementation timeline -- the customer expressed scepticism about the 8-week rollout claim and will need evidence from a comparable deployment"

If a pre-call coaching brief was issued for this meeting, assess adherence: did the salesperson follow the planned approach? Where did they deviate, and was the deviation justified by the customer's responses? Log adherence observations to the development profile.

---

## Operational Rules

1. Every debrief must update the Situational Matrix position -- even if unchanged, the assessment must be stated with evidence. A debrief that does not reassess the matrix position is incomplete and must not be finalised.
2. Matrix position changes must be supported by specific customer behaviour or statement evidence, not salesperson assessment alone. "I think they're more interested now" is not evidence; "The customer asked how quickly we could start implementation" is evidence.
3. The debrief must capture at least one specific customer statement or observable behaviour that anchors the matrix position assessment. If the salesperson cannot recall any specific customer statement, this itself is a coaching observation to log.
4. Every unit that was attempted must be assessed as effective, ineffective, or not applicable -- no unit left unassessed. Partial debriefs that skip unit assessment produce incomplete development data.
5. Action items must be specific to the next interaction with this customer, not generic development advice. "Improve your questioning" is prohibited; "In the next meeting, use a critical question to help the customer calculate the weekly cost of their manual invoicing process" is required.
6. Skill observations logged to the development profile must be distinct from the immediate action items. Development observations inform longer-term patterns; action items address the next specific interaction. Conflating the two dilutes both.
7. If a pre-call coaching brief was issued for this meeting, the debrief must assess adherence to the planned approach. The pre-call and post-call skills form a feedback loop -- skipping adherence assessment breaks the loop.
8. Units that were skipped (in scope but not applied) must be assessed for the impact of their omission on the customer's matrix movement. A skipped unit is not automatically a problem, but the impact must be consciously evaluated.

---

## Anti-Patterns -- NEVER Do These

1. Never accept "it went well" as a debrief -- every outcome must be evidenced by specific customer behaviour or stated position. If the salesperson cannot provide specifics, that inability is itself a coaching observation.
2. Never skip the Situational Matrix position reassessment -- every completed interaction is a data point on the customer's position. Skipping it means losing the ability to track perception movement over time.
3. Never allow the salesperson to evaluate their own skill effectiveness without anchoring to specific customer response evidence. Self-assessment that is not grounded in observable customer behaviour produces inflated ratings and missed development opportunities.
4. Never generate action items that are not specific to the next interaction with this customer. "Work on your questioning skills" is not an action item; "In the next meeting with this customer, use an open question to explore the impact of the delayed procurement process they mentioned" is an action item.
5. Never log a skill as "applied" if the customer's response shows the unit did not achieve its intended effect. Unit 3 Building "applied" but customer perception of need did not increase means the unit was attempted but ineffective -- the distinction matters for development tracking.
6. Never treat a missed unit as unimportant without assessing the impact of the omission on the customer's matrix movement. A skipped unit may have been the reason the customer's perception did not shift -- always evaluate.
7. Never conduct a debrief without referencing the customer's specific context -- account, industry, role, prior interactions. A debrief that could apply to any customer interaction is a failed debrief.
8. Never conflate development observations with next-step actions. Development observations track patterns across multiple interactions; action items address one specific upcoming meeting. Mixing them produces advice that is neither actionable nor developmental.

---

## Contextual Parameters

| Parameter | How It Affects the Debrief |
|-----------|---------------------------|
| Meeting type (first meeting, follow-up, presentation, discovery walkthrough) | Determines which RSS units were in scope for the interaction. A first meeting puts Unit 1 Positioning and Unit 2 Discovering in scope; a presentation meeting puts Unit 4 Presenting and Unit 5 Resolving in scope. Units outside the expected scope for the meeting type are assessed differently -- applying them may indicate flexibility or premature advancement. |
| Customer's prior Situational Matrix position | Required baseline for assessing whether perception of need or value has shifted. Without a prior position, movement cannot be measured -- only the current position can be established. If no prior position exists, this debrief establishes the baseline and logs it as the first matrix data point. |
| Salesperson's current skill development focus | Determines which skill dimensions to probe most deeply during the debrief. If the salesperson is working on Building (Unit 3), the debrief spends more time assessing how critical questions were used and whether the customer articulated impact. The development focus sharpens the debrief rather than spreading attention evenly across all units. |
| Deal stage | Affects how to weight matrix movement in next-step recommendations. Early-stage deals prioritise need and value perception development; late-stage deals prioritise concern resolution and commitment securing. A matrix regression in a late-stage deal is more urgent than in an early-stage exploration. |
| Whether a pre-call coaching brief was issued | If yes, the debrief assesses adherence to the planned approach -- was the GBS delivered as coached? Were the recommended questions used? Was the planned Action Commitment requested? If no brief was issued, note this as a coaching gap: the salesperson entered the meeting without a structured plan, and the debrief should assess whether preparation gaps affected the outcome. |

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
