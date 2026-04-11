---
name: pre-call-coaching
description: "Coaches pre-call preparation for any customer meeting. Pulls opportunity context from Zoho CRM, assesses Situational Matrix position, identifies relevant RSS units, generates a coaching brief with specific skill recommendations, and suggests opening approach and questioning strategy."
---

# Pre-Call Coaching

The pre-call coaching skill prepares a salesperson for an upcoming customer meeting using the RSS Relationship Selling Skills methodology. It grounds every coaching brief in the customer's current Situational Matrix position and selects specific RSS units and techniques for the session. It integrates Zoho CRM data for context and personalises coaching based on the salesperson's skill development history.

Load `shared/rss-methodology-reference.md` for the RSS methodology reference.

---

## Quick Reference

| Element | Requirement |
|---------|-------------|
| Situational Matrix position | Must be assessed with evidence before any coaching recommendation is made |
| Primary RSS unit(s) | Selected based on matrix position and meeting objective -- must name specific techniques |
| Opening approach | Always addressed via Unit 1 Positioning (GBS tailored to customer context) regardless of primary unit |
| Questioning strategy | Mapped to the primary unit -- open questions for Discovering, critical questions for Building |
| Action Commitment | Every brief must define what commitment the salesperson will request at the end of the meeting |
| Success criteria | Defined as observable customer behaviour or stated position change on the matrix |
| Customer context | Must reference specific industry, role, known challenges -- generic briefs are prohibited |
| Prior coaching history | Must be reviewed and any documented skill gaps addressed in the brief |

---

## When to Use

- Before any scheduled customer meeting (first meeting, follow-up, or presentation)
- When a salesperson requests preparation guidance for an upcoming call
- When a manager wants to coach a salesperson on call planning before a joint visit
- When an opportunity is advancing and the next meeting needs a clear objective tied to matrix movement
- When a salesperson is returning to a stalled opportunity and needs a re-engagement approach
- When a new contact is being engaged within an existing account

---

## Inputs to Gather

| Input | Required For | Required? |
|-------|-------------|-----------|
| Account name and deal reference | Pulling opportunity context from Zoho CRM (account, contact, deal stage) | Yes |
| Contact name and role | Tailoring the Positioning approach and identifying relevant challenges for the contact's function | Yes |
| Meeting objective (what the salesperson hopes to achieve) | Aligning RSS unit selection and defining the Action Commitment to request | Yes |
| Current Situational Matrix position (if known) | Selecting primary and supporting RSS units; if unknown, default to Discovering | No |
| Prior meeting history and coaching observations | Identifying skill gaps to address and building on previous coaching feedback | No |
| Customer industry and known challenges | Contextualising the GBS, questioning strategy, and value proposition emphasis | No |
| Meeting type (first meeting, follow-up, presentation, negotiation) | Adjusting unit emphasis and the balance between Positioning, Discovering, and Presenting | No |

---

## Workflow

### Step 1: Pull Opportunity Context from Zoho CRM

Retrieve the account record, contact details, deal stage, meeting history, and any prior coaching observations (SF_Notes) linked to this contact and deal. Review the salesperson's recent debrief notes for this opportunity to understand what happened in previous interactions and what commitments were made. If no CRM data is available, gather the equivalent information directly from the salesperson before proceeding.

### Step 2: Assess the Customer's Current Situational Matrix Position

Determine which quadrant the customer occupies based on their perception of need (low to high) and perception of value (low to high). Use evidence from prior meeting notes, customer statements, and observable behaviours to justify the assessment. If no prior matrix position has been established (new relationship or no previous coaching data), default the position to Low Need / Low Value (Q3: Entry) and recommend a Discovering-led approach to establish a baseline understanding.

Ask two diagnostic questions:
1. What has the customer said or done that indicates their perception of need?
2. What has the customer said or done that indicates their perception of value in working with us?

### Step 3: Identify the Primary RSS Unit(s) for This Meeting

Based on the matrix position and meeting objective, select the primary RSS unit(s) using the Unit-to-Matrix Mapping:

- **Q3 (Low Need, Low Value):** Primary -- Unit 1 Positioning and Unit 2 Discovering. Earn the right to continue; begin jointly defining needs.
- **Q4 (Low Need, High Value):** Primary -- Unit 2 Discovering and Unit 3 Building. Help the customer recognise latent needs and create urgency.
- **Q2 (High Need, Low Value):** Primary -- Unit 4 Presenting and Unit 5 Resolving. Educate on value and differentiate; address concerns.
- **Q1 (High Need, High Value):** Primary -- Securing. Move to commitment and define next actions.
- **Centre (partial awareness):** Primary -- Unit 3 Building. Deepen impact awareness and bridge toward value.

Also identify supporting units. Unit 1 Positioning is always a supporting unit regardless of primary selection -- every meeting begins with re-establishing purpose.

### Step 4: Generate the Coaching Brief

Produce a structured coaching brief containing:

**Opening approach (Unit 1 Positioning):** A tailored General Benefit Statement (GBS) that mentions a relevant need specific to this customer's industry and known challenges, describes how the salesperson's company has helped similar organisations, and requests permission to proceed. The GBS must reference the customer's specific context -- never a generic template.

**Questioning strategy:** Mapped to the primary unit:
- For Discovering: a general-to-specific question sequence moving from Assumptions to Situation to Problems to Needs, using open questions tailored to what is already known about the customer.
- For Building: critical questions designed to help the customer think about the impact and consequences of identified problems, including projecting and calculating techniques where appropriate.
- For Presenting: transition positioning statements and an options structure (general to specific) that involves the customer in evaluating solutions.
- For Resolving: preparation for anticipated concerns (doubt, misinformation, or legitimate) with planned responses following the Understand-Confirm-Acknowledge-Answer-Check framework.

**Unit-specific techniques:** Name the specific RSS techniques the salesperson should use (e.g., "Use a reamplification paraphrase after the customer describes their current process" or "Prepare two critical questions that help the customer calculate the weekly cost of their current approach"). Never recommend vague actions like "ask good questions" or "build rapport."

**Action Commitment:** Define the specific commitment the salesperson will request at the end of the meeting (e.g., agreement to a technical evaluation, introduction to another stakeholder, agreement to review a proposal). The commitment must advance the opportunity on the matrix.

**Skill gap focus:** If prior coaching observations identify a documented skill gap for this salesperson, include one specific practice objective for this meeting (e.g., "Focus on letting the customer finish speaking before responding -- your last debrief noted a pattern of jumping to solutions before fully discovering needs").

### Step 5: Set Success Criteria

Define what observable customer behaviour or stated position change would indicate a successful meeting. Success criteria must reference movement on the Situational Matrix -- not salesperson activity.

Examples of well-formed success criteria:
- "The customer articulates at least two specific problems in their own words" (movement from Low Need toward High Need)
- "The customer quantifies the cost of their current approach and expresses urgency to address it" (Building success -- movement along the Needs axis)
- "The customer says 'our plan' or 'what we should do' when discussing the proposed solution" (Presenting success -- customer ownership indicates High Value)
- "The customer agrees to schedule a follow-up meeting with their operations lead" (Action Commitment secured)

Examples of poorly formed success criteria (prohibited):
- "The salesperson delivers the presentation" (salesperson activity, not customer response)
- "The meeting goes well" (unobservable)
- "We cover all agenda items" (process completion, not perception change)

---

## Operational Rules

1. Every coaching brief must include a specific Situational Matrix position assessment with evidence from CRM data, prior meeting notes, or salesperson input. Coaching without a matrix position is directionally blind and must not proceed.
2. Coaching must name specific RSS techniques from the selected unit(s), not generic advice. "Build rapport" is not a coaching recommendation; "Deliver a GBS referencing the customer's recent expansion into the Northern region to establish credibility" is.
3. The opening approach (Unit 1 Positioning) must always be addressed regardless of which other units are primary. Every meeting begins with re-establishing purpose, even with established relationships.
4. Success criteria must reference observable customer behaviour or stated position, not salesperson activity. "The customer confirms they want to explore solutions" is valid; "The salesperson presents three options" is not.
5. If no prior matrix position is established, default to Unit 2 Discovering and recommend the salesperson establish a baseline understanding of the customer's perception of need and value before advancing.
6. Coaching must reference the customer's specific context -- industry, role, known challenges, prior interactions. A coaching brief that could apply to any customer is a failed brief and must be reworked.
7. If the salesperson has documented skill gaps from prior coaching observations, the brief must include at least one targeted practice objective addressing that gap.
8. The coaching brief must always include an Action Commitment -- the specific next step the salesperson will request from the customer. A meeting without a planned commitment request wastes both parties' time.

---

## Anti-Patterns -- NEVER Do These

1. Never recommend "build rapport" without a specific RSS Positioning technique -- instead, craft a GBS referencing the customer's known challenges, industry context, or a relevant example of how the salesperson's company has helped similar organisations.
2. Never skip the Situational Matrix assessment. Coaching without knowing the customer's position on the matrix produces generic advice that may actively harm the opportunity by applying the wrong unit's techniques.
3. Never recommend a Presenting (Unit 4) approach before the customer's needs have been Discovered (Unit 2) and Built (Unit 3). Premature presentation is the most common cause of "they liked us but went with someone else."
4. Never issue a generic coaching brief that could apply to any customer. Every brief must reference the specific customer's industry, role, known challenges, and prior interaction history. If the customer's name could be swapped out without changing the brief, the brief has failed.
5. Never treat meeting preparation as complete without addressing what Action Commitment (closing request) the salesperson will make. A meeting without a planned commitment request produces motion without progress.
6. Never ignore prior coaching observations. If the salesperson has a documented skill gap (e.g., premature presenting, weak questioning, insufficient Building), the coaching brief must address it with a specific practice objective for this meeting.
7. Never recommend techniques from a unit that does not match the customer's matrix position. Resolving (Unit 5) techniques are wrong when the customer is in Q3 (Low Need, Low Value); Discovering (Unit 2) techniques are wrong when the customer is in Q1 (High Need, High Value) and ready to commit.
8. Never allow the salesperson to proceed without re-establishing purpose at the start of the meeting. Even the twentieth meeting with a long-standing customer requires a positioning statement to set context for this specific interaction.

---

## Contextual Parameters

| Parameter | How It Affects Coaching |
|-----------|------------------------|
| Customer industry | Determines which aspects of the salesperson's value proposition to emphasise in the GBS and which analogies or examples will resonate. A manufacturing customer responds to operational efficiency and downtime cost; a professional services customer responds to talent retention and client satisfaction. |
| Deal stage and matrix position history | Determines which RSS units are primary vs supporting. A new opportunity in Q3 requires Positioning and Discovering; a mid-stage opportunity in the centre requires Building; a late-stage opportunity in Q2 requires Presenting and Resolving. Position history shows whether the customer has regressed and needs earlier units revisited. |
| Relationship history | Affects whether Positioning emphasis is heavy (new relationship -- full GBS, style management, credibility establishment) or light (established relationship -- brief re-positioning to set meeting purpose). Also determines whether the questioning strategy can start deeper in the general-to-specific sequence or must begin from assumptions. |
| Prior coaching observations | Determines which skill gaps to address in the brief. If the salesperson consistently presents too early, the brief emphasises Building techniques and includes a specific instruction to resist presenting until the customer articulates urgency. If questioning is weak, the brief provides scripted open questions as scaffolding. |
| Meeting type | First meeting emphasises Positioning and Discovering (earn the right to continue, establish baseline needs). Follow-up meetings emphasise Building and Presenting (deepen need awareness, introduce solutions). Presentation meetings emphasise Presenting and Resolving (demonstrate value, address concerns). Each type shifts the unit balance and the nature of the Action Commitment. |

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
