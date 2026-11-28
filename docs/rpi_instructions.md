# Delegating an RPI task to an AI agent

Prompts to hand a ticket to an AI coding agent (Copilot, Claude Code, Cursor…)
under the RPI framework, one phase at a time.

**Framework reference:** [`docs/rpi/README.md`](rpi/README.md) — checklists,
failure classification, artifacts and anti-patterns.

RPI exists to reduce friction, hidden assumptions and premature solutioning.
The rule that matters when prompting an agent: **never ask it to "solve the
problem" in one go.** Walk it through the three phases and validate its output
at each control point.

## Before you start

1. Keep the framework documents where the agent can read them: `docs/rpi/`
   holds `README.md`, `Research.md`, `Plan.md` and `Implement.md`.
2. Create one subfolder per effort, for example `rpi/initiative-x/`. The agent
   writes its artifacts there.

---

## Phase 1 — Research

**Goal:** turn uncertainty into a structured understanding of the problem, the
users and the constraints. The agent maps the code; it does not propose the
final solution yet.

### Step 1: set the context

Paste this prompt, replacing the bracketed values:

> I need to work on a new requirement: [DESCRIBE_PROBLEM_OR_PASTE_TICKET_HERE].
>
> We use the RPI (Research, Plan, Implement) framework. Read
> `docs/rpi/README.md` and `docs/rpi/Research.md` to understand the process.
>
> Your first task is **only** the Research phase. Analyse the codebase to
> clarify the scope and map the affected surfaces. Write the artifact to
> `rpi/[TICKET-ID]/research.md` following the template, and include the FAR
> scale output at the end. Do not write production code yet.

### Step 2: human validation

Review the generated `research.md`:

- Is the FAR score (Factual, Actionable, Relevant) at least **4.00** on average?
- Below 4.00 after two attempts is a failure trigger: redefine the problem
  before continuing.

If it holds, move to Phase 2.

---

## Phase 2 — Plan

**Goal:** turn the research into an executable path — bounded scope, defined
approach, atomic tasks.

### Step 3: request the plan

> The Research phase is approved. Read `docs/rpi/Plan.md`.
>
> Based on `rpi/[TICKET-ID]/research.md`, write the implementation plan to
> `rpi/[TICKET-ID]/plan.md`. Break the solution into atomic,
> single-responsibility tasks using checkboxes (`- [ ]`), state the
> dependencies explicitly and include the FACTS scale output. Do not start
> executing yet.

### Step 4: human validation

Review the generated `plan.md`:

- Is every task atomic (one command, one file edit) with a clear definition of
  done?
- Is the FACTS score (Feasibility, Atomicity, Clarity, Testability, Size) at
  least **3.00** on average?
- Are there circular dependencies?

If the plan holds, move to Phase 3.

---

## Phase 3 — Implement

**Goal:** deliver meaningful slices, measure, adapt. The agent executes the plan
mechanically.

### Step 5: start the execution

> The Plan phase is approved (FACTS mean ≥ 3.00). Read `docs/rpi/Implement.md`
> for the execution rules.
>
> Execute the tasks in `rpi/[TICKET-ID]/plan.md` in order. For each task:
>
> 1. Write the code.
> 2. Run the quality gates: build → lint → test.
> 3. Only if every gate passes, mark the task complete (`- [x]`) in the plan.
>
> Stop for my review after the first phase of the plan, or immediately if a
> gate fails.

### Step 6: failures and postmortems

If the agent gets stuck or tests fail repeatedly (three or more consecutive
failures), stop the iteration and apply the
[failure handling framework](rpi/README.md#failure-handling).

> We have hit consecutive failures during implementation. Stop coding.
>
> Following the failure handling framework, write a postmortem to
> `rpi/[TICKET-ID]/implement-postmortem.md` covering the failed task, the state
> of the system, the root cause and the recommended next steps.
