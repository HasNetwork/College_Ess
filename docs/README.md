# College Ess documentation

> **For:** anyone looking for the right doc.
> **Update it when** a doc is added, removed or renamed, or its audience changes (RULES R22).

These docs are for **developers and operators**. Students read Compass, the in-app guide,
whose pages live in `packages/db/seed/docs/`.

| Doc | What it holds | For |
|---|---|---|
| [`../README.md`](../README.md) | what College Ess is, the modules, the roadmap | anyone meeting the project |
| [`../README-dev.md`](../README-dev.md) | status, stack, repository layout, scripts, conventions | developers, first |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | the runbook from nothing to a running app, and redeploying | whoever deploys |
| [`ENV.md`](ENV.md) | every environment variable: who reads it, examples, what breaks without it | developers and operators |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | the six primitives, tenancy, permissions, sync, reminders, uploads | developers changing the core |
| [`APP-DETAILS.md`](APP-DETAILS.md) | every module: what it does, its phase, built or planned, its primitives and settings | developers, operators, planners |
| [`THEME.md`](THEME.md) | the project's purpose and principles, and the design system (tokens, glass, type, contrast tests) | everyone; anyone building a screen |
| [`SAGE-API.md`](SAGE-API.md) | the planned personal Sage API (**Phase 6, not built**: a design spec) | whoever plans Phase 6 |
| [`TESTING.md`](TESTING.md) | the test layers, the HTTP harness, E2E, mutation checks, CI | developers writing tests |

## Ground rules for these docs (RULES R22)

- **One home per fact.** `DEPLOYMENT.md` owns the deploy steps, `ENV.md` the variable
  reference, `APP-DETAILS.md` the module status; others link to them.
- **Say what is not built.** A planned feature is marked planned; a deploy step never run
  for real is marked **not yet run**.
- **Third-party steps cite the provider's docs** and the date they were checked.
- **They change with the code.** Each doc's header says when it must be updated; that update
  goes in the same commit as the change.
- The plan, rules and history behind them are in `.agents/`, which is local to the
  maintainer and not in the repository.
