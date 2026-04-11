---
name: skill-tracker
description: "Tracks salesperson skill development across all 5 RSS units over time. Aggregates observations from post-call debriefs, generates competency profiles per unit, identifies development trends (improving/plateauing/declining), and produces targeted development recommendations for the weakest unit."
---

# Skill Development Tracker

The skill tracker aggregates coaching observations from multiple post-call debriefs to build a longitudinal view of a salesperson's RSS skill development. It maintains per-unit competency profiles, tracks trends over time, and surfaces targeted development recommendations. It ensures coaching effort is focused on the unit where improvement will have the greatest impact on the salesperson's Situational Matrix effectiveness.

Load `skills/shared/rss-methodology-reference.md` for the RSS methodology reference.

---

## Quick Reference

| Element | Requirement |
|---------|-------------|
| Per-unit competency scores | 1--6 scale for each of the 5 RSS units, derived from post-call debrief observations |
| Trend assessment | Improving / plateauing / declining per unit -- requires minimum 3 observations before any trend is assigned |
| Development focus | A single RSS unit designated as the active development priority at any given time |
| Observation source | All scores must originate from post-call debrief observations anchored to customer responses -- never from self-assessment |
| Recommendation specificity | Every development recommendation must reference a specific RSS technique from the priority unit |
| Coaching frequency | Less than 1 observation per 2 weeks must be flagged as a coaching frequency gap |

---

## Data Model

The skill tracker maintains a per-salesperson development profile containing five components:

### Unit Competency Scores

A 1--6 numerical score for each of the 5 RSS units, recorded per observation. Each score reflects the salesperson's effectiveness in applying that unit's techniques during a specific customer interaction, as assessed during the post-call debrief. The scale aligns with the RSS coaching framework (1 = Needs significant development, 6 = Excellent, consistently effective).

| Unit | Techniques Assessed |
|------|--------------------|
| Unit 1: Positioning | GBS delivery, purpose-setting, style management, re-positioning |
| Unit 2: Discovering | Open questions, general-to-specific strategy, joint need definition, support and paraphrase |
| Unit 3: Building | Critical questions, projecting, calculating, examples and analogies, position-build |
| Unit 4: Presenting | Transition positioning, options presentation, customer involvement, treating the whole problem |
| Unit 5: Resolving Concerns | Concern identification, Understand-Confirm-Acknowledge-Answer-Check framework application |

### Observation Log

Each entry in the log records a single observation from a post-call debrief:

| Field | Description |
|-------|-------------|
| Date | Date of the customer interaction that was debriefed |
| Meeting type | First meeting, follow-up, presentation, discovery walkthrough |
| Unit assessed | Which RSS unit this observation pertains to |
| Score | 1--6 numerical rating |
| Specific behaviour noted | The concrete behaviour observed and the customer's response -- e.g., "Used a critical question about operational cost; customer quantified impact at 12 hours per week" |

A single debrief may produce observations for multiple units. Each unit observation is a separate log entry.

### Trend Assessment Per Unit

For each RSS unit, a trend classification is maintained:

- **Improving:** scores are rising across the most recent observations (weighted toward recency)
- **Plateauing:** scores are stable with no meaningful movement up or down
- **Declining:** scores are falling across recent observations

A trend requires a minimum of 3 observations for that unit. With fewer than 3 observations, the trend is reported as "insufficient data for trend" and no classification is assigned.

### Current Focus Unit

The single RSS unit designated as the active development priority. Only one unit is in focus at any time. The focus unit is selected based on the trend assessment and current competency level -- typically the weakest or most declined unit. The focus unit persists until meaningful improvement is demonstrated (trend shifts to improving and score increases by at least 1 point on the 1--6 scale), at which point the next priority unit is assessed.

### Coaching History

A record of previous coaching conversations related to skill development:

| Field | Description |
|-------|-------------|
| Date | Date of the coaching conversation |
| Focus unit | Which RSS unit was the coaching focus |
| Recommendation given | The specific development recommendation provided |
| Outcome | Whether the recommendation was applied in subsequent interactions and the observed result |

---

## When to Use

- After a series of post-call debriefs have been completed and sufficient observations have accumulated to assess development patterns
- When a manager wants to review a salesperson's skill trajectory before a formal performance review
- When selecting which RSS unit to prioritise in an upcoming coaching conversation
- When assessing whether a salesperson's current development focus should continue or shift to a different unit
- When evaluating coaching frequency and identifying gaps in the observation cadence
- When preparing a development plan that requires longitudinal evidence of skill application

---

## Inputs to Gather

| Input | Required For | Required? |
|-------|-------------|-----------|
| Salesperson identifier | Retrieving the correct development profile and observation log | Yes |
| Post-call debrief observations | The raw observation data -- unit assessed, score, specific behaviour noted, date, and meeting type | Yes |
| Current development focus unit (if already set) | Determining whether to continue the existing focus or reassess based on new data | No |
| Time period for analysis | Defining the window of observations to include in trend calculation (default: all available, with recency weighting) | No |
| Coaching history | Prior coaching conversations, recommendations given, and outcomes observed | No |

---

## Workflow

### Step 1: Aggregate Observations

Retrieve all logged observations from post-call debriefs for the salesperson. Organise observations by RSS unit and sort chronologically. For each unit, compile the full sequence of scores and associated behaviours noted.

If the observation log is sparse -- fewer than 1 observation per 2 weeks over the analysis period -- flag this as a coaching frequency gap before proceeding. Sparse data limits the reliability of trend assessment and must be surfaced to the manager.

Verify that all observations originate from post-call debriefs with customer-response evidence. Discard or flag any entries that lack specific behaviour anchored to customer responses.

### Step 2: Calculate Competency Profile

For each of the 5 RSS units, compute the competency profile:

- **Current score:** the most recent observation score for that unit
- **Average score:** the mean of all observation scores for that unit within the analysis period
- **Score range:** the lowest and highest scores observed, indicating consistency
- **Observation count:** the number of observations available for that unit

Present the profile as a summary across all 5 units, highlighting which units have sufficient data for trending (3 or more observations) and which do not.

### Step 3: Assess Trends

For each unit with 3 or more observations, classify the trend:

- **Improving:** the trajectory of scores across recent observations is upward. Recent observations (weighted more heavily than older ones) show higher scores than earlier observations.
- **Plateauing:** scores are stable across recent observations with no meaningful upward or downward movement. Variation of 0.5 or less on the 1--6 scale across the last 3 observations indicates a plateau.
- **Declining:** the trajectory of scores across recent observations is downward. Recent observations show lower scores than earlier observations.

For units with fewer than 3 observations, report "insufficient data for trend" and do not assign a classification. The absence of a trend is itself informative -- it indicates that the unit has not been observed frequently enough to assess development.

Recency weighting: observations from the most recent 30 days carry more weight than older observations. A salesperson who scored 2, 2, 4, 5 over four observations is improving, even though the average (3.25) is moderate. Trend direction matters more than historical average.

### Step 4: Identify Development Priority

Select the single unit that should be the active development focus. The selection criteria, applied in order:

1. **Declining unit:** if any unit shows a declining trend, it takes priority regardless of absolute score. A declining trend indicates active skill erosion that must be addressed.
2. **Weakest unit:** if no unit is declining, the unit with the lowest current score (or lowest average if current scores are tied) becomes the priority.
3. **Plateauing unit with low score:** if multiple units are plateauing, the one with the lowest score takes priority -- a plateau at score 2 is more urgent than a plateau at score 4.
4. **Insufficient data unit:** if a unit has fewer than 3 observations and all other units are stable or improving, flag the under-observed unit as needing more data collection before it can be deprioritised.

If the salesperson already has a current focus unit set, assess whether to continue or reassess:
- **Continue** if the focus unit has not yet shifted to improving trend or has not gained at least 1 point on the 1--6 scale.
- **Reassess** if the focus unit is now improving and another unit has become the weakest or is declining.

### Step 5: Generate Development Recommendation

Produce a specific, actionable development recommendation for the priority unit. The recommendation must:

1. **Name the priority unit and its trend:** e.g., "Unit 3: Building -- declining trend (scores: 4, 3, 2 over last three observations)"
2. **Identify the specific skill gap:** based on the behaviour notes in recent observations, identify the specific technique within the unit that is weakest -- e.g., "Critical questions are surface-level and do not help the customer quantify impact"
3. **Prescribe a specific RSS technique or exercise:** reference a concrete technique from the priority unit's methodology -- e.g., "Practice the calculating technique: prepare two questions for your next meeting that help the customer quantify the weekly cost of their current manual process in hours and dollars"
4. **Define observable success criteria:** what the salesperson should aim for in their next interaction -- e.g., "In your next debrief, the observation should note that the customer articulated the cost of inaction in their own words"
5. **Set a review timeline:** when the recommendation will be reassessed -- typically after the next 2--3 debriefs that include observations for the priority unit

The recommendation must never be generic. "Improve your Building skills" is prohibited. "In your next discovery meeting, use the projecting technique to ask the customer how resolving the delayed invoicing problem would affect their month-end close timeline -- your last three debriefs show you are identifying problems but not helping the customer articulate urgency" is the required level of specificity.

---

## Operational Rules

1. Competency scores require a minimum of 3 observations before a trend can be assessed. With fewer than 3 observations, report "insufficient data for trend" rather than guessing. Premature trend assignment creates false confidence in development direction.
2. Development recommendations must prioritise a single RSS unit at a time. Spreading focus across multiple units simultaneously dilutes development effort and produces marginal improvement across many areas rather than meaningful improvement in one. One unit, one recommendation, one review cycle.
3. All competency scores must derive from observed customer responses and specific behaviours captured during post-call debriefs, not from self-assessment. Self-reported skill levels are unreliable and produce inflated profiles that mask genuine development needs.
4. Trend labels (improving / plateauing / declining) must not be applied until the minimum observation threshold of 3 is met. Assigning a trend from 1--2 data points is statistically meaningless and risks misdirecting coaching effort.
5. The development recommendation must reference specific RSS techniques from the priority unit, not generic advice. "Work on your questioning" is not a recommendation; "Use the general-to-specific questioning strategy starting from assumptions about the customer's procurement process" is a recommendation.
6. Coaching frequency must be monitored. If the observation log shows fewer than 1 observation per 2 weeks, this gap must be surfaced as a coaching frequency concern. Infrequent observation means the tracker cannot reliably assess development, and the manager must increase coaching cadence.
7. Trend direction overrides historical average. A salesperson with a high average score but a declining recent trend must be flagged for intervention. Past competency does not protect against current skill erosion.

---

## Anti-Patterns -- NEVER Do These

1. Never assign a trend (improving / plateauing / declining) with fewer than 3 observations for that unit. Report "insufficient data for trend" instead. Premature trending produces false signals that misdirect coaching effort.
2. Never recommend developing multiple units simultaneously. The skill tracker designates one focus unit at a time. Multi-unit development plans sound comprehensive but produce diluted effort and negligible improvement. One unit until meaningful progress is demonstrated, then reassess.
3. Never treat a high average score as evidence of competency if recent observations show decline. Trend direction overrides historical average. A salesperson who averaged 5 but whose last three scores are 5, 4, 3 is declining and needs intervention, regardless of their historical performance.
4. Never generate a development recommendation that does not reference a specific RSS technique or exercise from the priority unit. "Improve your Building skills" is not actionable. "Use the calculating technique to help the customer quantify the cost of their current manual reconciliation process" is actionable. Every recommendation must name the technique.
5. Never omit flagging when a salesperson's observation log is sparse. Fewer than 1 observation per 2 weeks is a coaching frequency gap that must be surfaced. Silent acceptance of sparse data means the tracker is operating on insufficient evidence and its assessments cannot be trusted.
6. Never allow scores derived from self-assessment to enter the competency profile. All scores must originate from post-call debrief observations anchored to specific customer responses. Self-assessment inflates ratings and obscures genuine development needs.
7. Never continue a development focus on a unit that has shifted to an improving trend while another unit is declining. The priority must shift to the most urgent need. Persisting with an improving unit while another declines wastes the coaching window.
8. Never present trend data without the underlying observation count. A "plateauing" label based on 3 observations carries different weight than one based on 15 observations. The observation count must always accompany the trend classification.

---

## Contextual Parameters

| Parameter | How It Affects Tracking |
|-----------|------------------------|
| Observation history depth (number of debriefs on record) | Determines whether trending is possible for each unit. With fewer than 3 observations per unit, only current scores and averages can be reported -- no trend classification is valid. Deeper history enables more reliable trend assessment and reduces the influence of single-observation anomalies. |
| Current development focus unit (if already set) | Determines whether the tracker continues the existing focus or reassesses. If the current focus unit is still declining or has not demonstrated meaningful improvement, the focus persists. If the focus unit has shifted to improving, the tracker reassesses and may designate a new priority unit. |
| Time period for trend analysis | Recent observations are weighted more heavily than older ones. A 30-day recency window is the default for weighting, but all available observations contribute to the profile. Adjusting the analysis period affects which observations dominate the trend calculation -- a shorter window is more responsive to recent change; a longer window is more stable but slower to detect shifts. |
| Meeting type distribution in observations | A mix of meeting types (first meetings, follow-ups, presentations, discovery sessions) improves assessment validity. If all observations come from one meeting type, the competency profile may not reflect the salesperson's ability to apply techniques in varied contexts. The tracker should flag when the observation mix is skewed toward a single meeting type and recommend diversifying observation contexts. |
| Coaching history and prior recommendations | If prior recommendations were given and the salesperson has had subsequent debriefs, the tracker assesses whether the recommendation was applied and whether it produced improvement. Unapplied recommendations are flagged for follow-up. Applied recommendations that did not produce improvement indicate the recommendation itself may need revision. |

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
