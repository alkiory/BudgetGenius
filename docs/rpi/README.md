# RPI: Research → Plan → Implement

A concise, repeatable flow for moving an idea from a fuzzy problem space to
something shipped and measured. The three phases keep research, planning and
implementation cleanly separated while leaving room for tight feedback loops.

| Phase | Purpose | You leave with |
|---|---|---|
| [Research](Research.md) | Build context and insight | Problem framing, users, constraints, option set |
| [Plan](Plan.md) | Decide what to do and how | Chosen solution, scope, sequencing, success metrics |
| [Implement](Implement.md) | Ship and learn | Working increments, telemetry, learnings, deltas |

## Why this exists

It reduces churn, hidden assumptions and premature solutioning. Each phase has a
defined exit state, and you should not half-enter the next one. The process is
lightweight by default; deepen it only where risk, ambiguity or impact justify
the cost.

## Phases at a glance

### 1. Research

Turn uncertainty into a structured understanding of the problem, the users, the
constraints and the viable approaches. You leave Research with a stated problem,
a definition of success, the trade-offs of each option and a recommended
direction — not a build plan.

### 2. Plan

Turn the chosen direction into an executable path: slice the scope, define the
approach, surface the risks, set the metrics and the checkpoints. You leave Plan
with bounded scope, a milestone map, resource assumptions, a risk register and
measurable success criteria.

### 3. Implement

Deliver the smallest meaningful slices to production (or a realistic
environment), measure, adapt. You leave Implement when the agreed scope ships or
when data justifies a pivot or a kill.

```text
        Ambiguity
            ↓
        [Research]
            ↓  problem framed, option chosen
          [Plan]
            ↓  scope and path locked
     [Implement] ↺  iterate with data
            ↓
      Outcome / next bet
```

## Gating checklists

Use these to confirm a phase is genuinely finished.

### Research → Plan

**Required artifacts**

- Problem statement (50–200 words), scored on the **FAR scale** — Factual,
  Actionable, Relevant — with a mean of at least 4.00 out of 5.
- Three to five user stories with specific acceptance criteria.
- Technical constraints: performance, security, integration requirements.
- Resource estimate: time, people, external dependencies.
- Option set with explicit trade-offs, including "do nothing".

**Validation checkpoints**

- [ ] Problem statement reviewed by two people outside the core team.
- [ ] User stories map to measurable business value.
- [ ] Technical feasibility confirmed by whoever will implement it.
- [ ] FAR scoring: Factual ≥ 4, Actionable ≥ 3, Relevant ≥ 3, mean ≥ 4.00.
- [ ] Critical unknowns identified, each with an investigation plan.

**Failure triggers**

- FAR mean below 4.0 after two revision attempts.
- No measurable acceptance criteria can be written for the user stories.
- Resource requirements exceed project constraints by more than 50%.
- Technical constraints form a circular dependency.

### Plan → Implement

**Required artifacts**

- Task breakdown where every task is atomic (one command, one file edit).
- Dependency graph with the critical path marked.
- Interface definitions for every external integration.
- Testing strategy with coverage targets (above 80% on critical paths).
- Risk register with a mitigation for each high-probability impact.

**Validation checkpoints**

- [ ] Every task has a testable definition of done.
- [ ] The critical path is identified and the timeline validated by the
      implementer.
- [ ] Risk mitigations have an owner and a date.
- [ ] **FACTS scale** — Feasibility, Atomicity, Clarity, Testability, Size — mean
      ≥ 3.00 out of 5.
- [ ] Architecture decisions are recorded with their rationale.

**Failure triggers**

- A task cannot be made atomic: the problem needs decomposing in Research.
- FACTS mean below 3.0 after two revision attempts.
- The task graph has a cycle.
- The critical path exceeds 150% of the original estimate.

### Implement → Close / Next

**Required artifacts**

- Agreed scope delivered, or a scope change approved by the stakeholders.
- Metrics dashboard with baseline and actual values.
- Post-implementation review: what worked, what missed, what was learned.
- Backlog triage with items categorised Now / Next / Later / Drop and owned.
- Handoff documentation if the result needs ongoing operations.

**Validation checkpoints**

- [ ] Deliverables pass the acceptance criteria from Plan.
- [ ] Metric targets met, or the variance explained and accepted.
- [ ] Performance meets the constraints defined in Research.
- [ ] Security and integration requirements validated in production.
- [ ] Knowledge transferred to whoever operates or maintains it.

**Failure triggers**

- Three or more consecutive implementation attempts fail validation.
- The critical path is blocked for more than two days with no resolution plan.
- A security or data-integrity issue is found in production.
- Metrics degrade more than 25% from baseline with no mitigation.

## Core artifacts by phase

| Phase | Artifacts |
|---|---|
| Research | Problem brief, option matrix, user and stakeholder insights, assumptions log |
| Plan | Execution plan, architecture sketch, risk register, measurement design |
| Implement | Increment changelog, metrics snapshots, decision log, post-implementation review |

## Cadence

- **Daily (Implement):** progress, blockers, metric anomalies.
- **Weekly (Research, Plan):** alignment sync or a decision checkpoint; skip it
  when there is nothing to decide.
- **Phase transition:** a focused 30–45 minute review of the gating checklist.

## Roles

Flexible hats, not a fixed team:

- **Driver** — keeps momentum and keeps the artifacts honest.
- **Domain / tech lead** — feasibility calls and architecture input.
- **Product / customer voice** — validates the problem framing and the value.
- **Metrics steward** — makes sure the measurement is real, not aspirational.

## Adapting the depth

| Context | Research | Plan | Implement |
|---|---|---|---|
| High risk, high impact | Deep | Deep | Tight iteration with telemetry |
| Low risk, routine | Lean capture | Milestones only | Standard sprint rhythm |
| Exploratory spike | Lightweight framing | May be skipped | Prototype and evaluate |

## Using this folder

1. Start an effort with a subfolder (for example `initiative-x/`) containing
   `research.md`, `plan.md` and, when needed, `implement.md`.
2. Fill only what adds clarity. Performative documents are worse than none.
3. Keep the artifacts in source control so decisions stay traceable.
4. Link PRs and issues directly from the phase documents.

## Writing a problem statement

```text
Problem
- Who is impacted?
- What friction or gap exists?
- Why now (trigger, urgency)?

Evidence
- Qualitative: quotes, observations
- Quantitative: metrics, trends

Success (initial hypothesis)
- Leading metric(s)
- Lagging outcome metric(s)
```

## Logging decisions

Record meaningful direction changes as short, immutable entries:

```text
YYYY-MM-DD | Decision | Context | Alternatives | Rationale | Owner
```

## Failure handling

Each phase has explicit criteria, an escalation path and a recovery procedure.

### Classification

**Minor** — fixed within the iteration, local guidance is enough.

- Research: FAR mean 3.5–3.9.
- Plan: FACTS mean 2.8–2.9.
- Implement: a single task fails its quality gate.

**Major** — the phase restarts, the stakeholders are consulted.

- Research: FAR mean 2.0–3.4, critical context missing.
- Plan: FACTS mean 2.0–2.7, the breakdown is insufficient.
- Implement: two or more consecutive task failures, or a blocked critical path
  with no clear resolution.

**Critical** — leadership escalation, project viability goes back to the table.

- Research: FAR mean below 2.0, the problem is misunderstood.
- Plan: FACTS mean below 2.0, the dependencies are circular.
- Implement: three or more consecutive failures, a security or integrity issue,
  or more than two days blocked.

### Escalation

| Level | Response time | Action | Decision authority |
|---|---|---|---|
| Minor | Same session | Revise locally | Team lead |
| Major | Same day | Restart the phase with more context | Technical lead |
| Critical | Immediate | Escalate, pause the project | Engineering manager |

### Recovery

- **Plan → Research** when planning exposes insufficient understanding of the
  problem.
- **Implement → Research** when implementation exposes a scope problem.
- **Implement → Plan** when the breakdown cannot carry the implementation.

Always keep the validated artifacts from earlier phases, pass the failure
context into the restart, and record the lesson.

### Postmortems

Critical failures produce one of: `research-postmortem.md` (understanding gaps),
`plan-postmortem.md` (breakdown and architecture concerns) or
`implement-postmortem.md` (blockers and technical constraints). An example lives
at [`rpi/delete-account-cleanup/postmortem.md`](../../rpi/delete-account-cleanup/postmortem.md).

## Anti-patterns

- Skipping Research because "the solution is obvious". The rework proves it was
  not.
- Over-specifying Plan (false certainty) where the unknowns dominate.
- One giant Implement batch with no intermediate validation.
- Adding metrics after shipping, when the baseline is already gone.
- Proceeding past a failed validation to "make progress".
- Treating every failure the same: minor issues get escalated, critical ones get
  shrugged off.

## Fast start

Frame the problem (Research) → decide and slice (Plan) → ship small, measure,
learn (Implement). Do not promote a phase until its exit checklist is genuinely
met.
