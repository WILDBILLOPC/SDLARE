# SDLARE — Test Strategy & Coverage Plan

> **Status as of 2026-06-15:** The repository currently contains only `README.md`.
> There is no application code, no test suite, and no CI. Measured coverage is
> therefore **0% of 0 lines** — there is nothing to analyze yet.
>
> This document proposes the testing foundation and the areas to prioritize as
> code lands, so coverage can be measured and enforced from the first PR.

---

## 1. Why this matters for SDLARE

SDLARE is an **operations platform for lending and real estate**. That domain
is dominated by money movement, regulatory compliance, and sensitive personal
data. Bugs are not cosmetic — they cause incorrect payoffs, compliance
violations, and PII exposure. Tests should be weighted toward correctness and
safety, not just code reach.

## 2. Recommended testing layers

| Layer | Purpose | Target |
|-------|---------|--------|
| **Unit** | Pure business logic in isolation (calculations, rules, validators) | Fast, exhaustive, the bulk of the suite |
| **Integration** | API endpoints + database/persistence behavior | Every endpoint and query path |
| **End-to-end** | Critical user/operational journeys | A small, high-value set of flows |
| **Contract** | Stability of external integrations (credit bureaus, payment rails, document services) | Each third-party boundary |

A practical pyramid: many unit tests, fewer integration tests, a handful of E2E.

## 3. Highest-priority areas to test (proposed)

These are the domains where a missing test is most expensive. Build coverage
here first.

### 3.1 Money math (critical)
- Interest accrual and amortization schedules
- Principal/interest/escrow splits
- Fee calculation, proration, and rounding rules (define rounding behavior and
  test boundary cases explicitly)
- Payoff quotes and per-diem interest
- Currency precision — never test money with floating point; assert exact values

### 3.2 Underwriting & eligibility rules
- Decision logic (approve / deny / refer) against rule tables
- DTI, LTV, and credit-threshold boundary conditions
- Loan state machine transitions (e.g. application → underwriting → approved →
  funded → serviced → paid-off) and **illegal transitions**

### 3.3 Compliance & validation
- Required disclosures and timing (e.g. RESPA/TILA-style requirements)
- Field-level validation for applications and property records
- Audit-trail completeness — every state change is recorded and immutable

### 3.4 Authorization & data privacy
- Role-based access: who can view/modify which loans, borrowers, properties
- PII exposure boundaries in API responses and logs
- Tenant/branch isolation if the platform is multi-office

### 3.5 Date & time handling
- Business-day calculations, due dates, late-fee grace periods
- Time-zone correctness for San Diego operations and any cross-region data

## 4. Coverage tooling & gates (when code exists)

1. Wire a coverage tool into the test runner for the chosen stack.
2. Run tests + coverage on **every pull request** via CI.
3. Start with a realistic baseline threshold and **ratchet it up** over time
   rather than blocking on an unreachable number on day one.
4. Track coverage on **changed lines** in a PR, not just the global percentage —
   this prevents new code from eroding quality even if the total looks healthy.
5. Treat coverage as a floor, not a goal: prioritize the domains in §3 over
   chasing a percentage.

## 5. Suggested next steps

- [ ] Confirm the technology stack (backend language/framework, frontend, DB).
- [ ] Add a test framework and a single example test to prove the harness runs.
- [ ] Add a CI workflow that runs tests + coverage on PRs.
- [ ] Implement the §3.1 money-math tests alongside the first financial code.
- [ ] Establish the loan state machine and its transition tests early.

---

*This is a living document. Update it as the architecture and stack are decided.*
