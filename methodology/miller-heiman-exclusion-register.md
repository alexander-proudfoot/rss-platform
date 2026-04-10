# Miller Heiman IP Exclusion Register

**Last updated:** 2026-04-10
**Maintained by:** PPM Function
**Validation:** David Warren, Methodology Lab

---

## Purpose

This document serves two functions:

1. **Build governance record** — documents every Miller Heiman intellectual property concept that has been identified and excluded from the RSS Platform repository. This ensures no MH IP leaks into Proudfoot's proprietary RSS encoding.

2. **Methodology Lab validation checklist** — enables David Warren to confirm that appropriate Proudfoot-native replacements have been identified and validated for each excluded concept.

---

## Verification Command

Run before every PR. Must return zero results:

```bash
grep -rni "economic buyer\|user buyer\|technical buyer\|buying influence\|win-results\|red flag\|sponsorship gap\|concept.*mode.*rating\|perspective.*strateg" --include="*.md" --include="*.yaml" --include="*.json" . \
  | grep -v "miller-heiman-exclusion-register" \
  | grep -v "MUST NEVER\|EXCLUDED\|Exclusion\|never.*use"
```

Any match outside this file and the system instructions exclusion enforcement section is a PR blocker.

---

## Excluded Concepts

### 1. Buying Influence Framework

**Miller Heiman concept:** A stakeholder mapping model defining four roles in any sales opportunity:
- Economic Buyer (EBI) — the person with budget authority and final buy/no-buy authority
- User Buyer — those who use the solution and judge it on personal impact
- Technical Buyer — those who evaluate technical fit and can block but not approve
- Coach — an internal advocate who guides the seller through the organisation

**Why it must be excluded:** This framework is a core component of Miller Heiman's Strategic Selling® methodology, which is proprietary intellectual property. Proudfoot has used MH's framework in some prior sales tools, but the RSS Platform must encode only Proudfoot-native methodology.

**Proudfoot-native replacement:** Use the RSS Situational Matrix to guide relationship positioning and progression through customer conversations. The matrix's two-dimensional model (customer perception of need vs. customer perception of value) provides the lens for assessing where a customer is and what skill to apply next.

**Replacement status:** PLACEHOLDER — awaiting David Warren's validation and confirmation of the specific RSS-based stakeholder positioning approach.

---

### 2. Concept / Mode / Rating Assessment Model

**Miller Heiman concept:** For each Buying Influence, the seller assesses:
- Concept — what the person is trying to accomplish, fix, or avoid
- Mode — their current receptivity state: Growth (opportunity perceived), Trouble (crisis), Even Keel (complacent), Overconfident (resistant to change)
- Rating — the seller's standing with this person, from -5 (hostile) to +5 (strong advocate)

**Why it must be excluded:** The Concept/Mode/Rating model is a core analytical framework within Strategic Selling®. It cannot be reproduced or adapted without licence.

**Proudfoot-native replacement:** Use the RSS Situational Matrix to assess the customer's current position (perception of need vs. perception of value). This provides equivalent positioning intelligence without relying on MH's framework. Specific techniques from the RSS 5-Unit Model are then mapped to the customer's matrix position.

**Replacement status:** PLACEHOLDER — awaiting Lab validation.

---

### 3. Win-Results Framework

**Miller Heiman concept:** For each Buying Influence, the seller identifies:
- Business Result — the tangible outcome they need for the organisation
- Personal Win — what the person personally gains from the decision (recognition, security, advancement, etc.)

Satisfying both Business Result and Personal Win is the MH definition of achieving a "Win-Result" with that stakeholder.

**Why it must be excluded:** Win-Results is a trademark concept within Strategic Selling®. Its definition and application are proprietary to Miller Heiman.

**Proudfoot-native replacement:** Use the RSS Discovering and Building units to identify customer motivations — both operational imperatives (what needs to change) and personal drivers (why this matters to the individual). The RSS Situational Matrix positions the customer's perception of value, which captures equivalent insight.

**Replacement status:** PLACEHOLDER — awaiting Lab validation.

---

### 4. Red Flag (Strategic Selling Definition)

**Miller Heiman concept:** "Red Flags" in Strategic Selling® are specific warning indicators signalling risk to the opportunity. Key examples:
- Sponsorship Gap — no identified Coach to guide the seller through the organisation
- Uncovered bases — Buying Influences not yet contacted
- Missing information — critical unknowns about a Buying Influence's Concept, Mode, or Rating

**Why it must be excluded:** "Red Flag" as a sales methodology term is defined specifically within Strategic Selling® in a way that maps to the Buying Influence framework. The term cannot be used in its MH-defined sense.

**Proudfoot-native replacement:** Use RSS concern indicators: Situational Matrix position regression (customer moving backwards on need or value perception), stalled Building progress (quantification not advancing), or unresolved concerns (Resolving Concerns unit not achieving movement). These are Proudfoot-native indicators of deal risk.

**Replacement status:** PLACEHOLDER — awaiting Lab validation.

Note: The word "concern" and similar common terms are not excluded — only the term "Red Flag" as defined in Strategic Selling® and the specific MH-defined subtypes (Sponsorship Gap, etc.).

---

### 5. Perspective Strategies

**Miller Heiman concept:** Four strategic approaches the seller chooses based on the overall Buying Influence map and Red Flag analysis. These strategies are a core component of the Strategic Selling® framework and are named proprietary concepts.

**Why it must be excluded:** The "Perspective" strategies are a proprietary MH construct that are inseparable from the Buying Influence/Red Flag framework they respond to.

**Proudfoot-native replacement:** Use RSS unit selection based on the Situational Matrix position. The appropriate RSS skill (Positioning, Discovering, Building, Presenting, or Resolving Concerns) is selected based on where the customer sits on the matrix and what movement is needed. This provides equivalent strategic guidance.

**Replacement status:** PLACEHOLDER — awaiting Lab validation.

---

## Summary Table

| Excluded Concept | MH Source | Proudfoot Replacement | Status |
|-----------------|-----------|----------------------|--------|
| Buying Influence Framework (EBI/User/Technical/Coach) | Strategic Selling® | RSS Situational Matrix for relationship positioning | PLACEHOLDER |
| Concept / Mode / Rating | Strategic Selling® | RSS Situational Matrix position assessment | PLACEHOLDER |
| Win-Results | Strategic Selling® | RSS Discovering/Building unit insights + Situational Matrix value dimension | PLACEHOLDER |
| Red Flag (incl. Sponsorship Gap) | Strategic Selling® | RSS concern indicators (matrix regression, stalled Building, unresolved concerns) | PLACEHOLDER |
| Perspective Strategies | Strategic Selling® | RSS unit selection via Situational Matrix position | PLACEHOLDER |

---

## Validation Required

All PLACEHOLDER replacements above require David Warren's review and confirmation via the Methodology Lab before production deployment. See Issue #5: D098: Miller Heiman Replacement Framework -- Lab Validation.

---

(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
