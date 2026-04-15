# Code Review: Phase 3 - Dashboard Widget

**Review Date**: 2026-04-15
**Reviewer**: sr skill (orchestrated)
**Review Mode**: task
**Task**: Phase 3 - Sport Summary Dashboard Widget

---

## Review Context
<!-- SECTION:review-context -->
| Field | Value |
|-------|-------|
| `has_task_doc` | true |
| `has_spec` | true (tech decomposition with must-haves, test plan, implementation steps) |
| `has_committed_snapshot` | true (`218d213`) |
| `can_run_verification` | true (vitest + svelte-check both passing) |
| `review_scope` | full (8 source files, 473 lines, new widget module) |
| `review_mode` | task |
| `base_ref` | `c5498fa` (Phase 2 merge) |
| `head_ref` | `218d213` (Phase 3 wip commit) |
<!-- /SECTION:review-context -->

---

## Summary
<!-- SECTION:summary -->
Phase 3 adds a `SPORT_SUMMARY` dashboard widget following established patterns faithfully — enum registration, definition class, dual RENDERERS maps, settings editor, and a reusable `SportQuickLog` dropdown. The widget reuses `SportStatsService.computeWeekStats()` to guarantee stat consistency with the Sport page. Security is clean (no `{@html}`, no injection vectors).

Cross-AI validation (Codex + Cursor) elevated the review from APPROVED WITH NOTES to **NEEDS FIXES** by surfacing three major functional issues: (1) unguarded async `$effect` causes stale data on rapid week navigation, (2) quick-log does not refresh the widget after logging a new entry — stats stay stale until remount, (3) streak uses `new Date()` instead of `dashboardDate`, producing incorrect values for historical weeks. Note that issue #1 is inherited from `SportView.svelte` (same pattern), but the widget introduces #2 as a new bug specific to the dashboard context. 150/150 tests pass but don't cover these runtime behaviors.
<!-- /SECTION:summary -->

---

## Verdict
<!-- SECTION:verdict -->
## NEEDS FIXES

Committed snapshot `218d213`, 0 critical, 3 major (race condition, no post-quick-log refresh, streak semantics), multiple minor. Verification passes (150/150 tests, 0 svelte-check errors) but cross-AI validation surfaced functional correctness issues that tests don't cover.

**Cross-AI validation**: Codex (GPT-5.4) and Cursor (Composer 2) both independently confirmed the race condition. Codex uniquely identified the missing post-quick-log refresh. Cursor uniquely identified the streak/`new Date()` inconsistency.
<!-- /SECTION:verdict -->

---

## Key Findings
<!-- SECTION:key-findings -->
### Major (3)

1. **Race condition in async `$effect` data loading** — `DashboardSportSummaryWidget.svelte:67-71` calls `loadData()` on week range changes but does not guard against stale responses. Rapid week navigation can cause an older response to overwrite a newer one. Additionally, `loaded` is never reset to `false` on week change, so stale stats remain visible during the fetch with the wrong week's entries applied to new week bounds. Fix: add a generation counter and reset `loaded` on reload. _(Performance — confirmed by all 3 AIs)_

2. **Quick-log does not refresh widget after logging** — `SportQuickLog` opens `FormModal` which writes via `journal.logEntry()`, but the widget's `$effect` only depends on week dates, not journal state. After quick-logging an entry, stats stay stale until remount or week navigation. Since this widget bypasses the Variable system, it needs its own invalidation path (e.g., subscribe to journal changes or receive an after-save callback from FormModal). _(Codex-exclusive finding)_

3. **Streak uses `new Date()` for historical weeks** — `computeWeekStats(..., new Date())` at line 85 uses today's date for streak calculation regardless of `dashboardDate`. For a historical week, `calculateStreak` walks backward from today using only that week's entries, producing incorrect or misleading streak values. Should use `dashboardDate` or document that streak is always "current streak as of today." _(Cursor-exclusive finding)_

### Minor (8 — deduplicated across agents)

4. **`updateDependencies` is dead code** — `sportSummary.ts:41-43` implements a method that is commented out in the `DashboardWidgetDefinition` interface (`dashboard.ts:118-119`). Remove it rather than propagating dead code from older widgets. _(Architecture + Code Quality + Test Coverage)_

5. **No error state UI** — `loadData()` catch block sets `loaded = true` and logs, but shows zeros indistinguishable from "no activity." The Sport page has a `loadError` state; the widget should match. _(Cursor + Code Quality)_

6. **Duplicate `formatDuration` instance method** — `stats.ts:95-100` has an instance method identical to the standalone `formatDurationMs` at line 39. The instance method is dead code. _(Code Quality)_

7. **`$effect` implicit dependency tracking needs a comment** — Dummy `_start`/`_end` variable reads look like mistakes without a comment explaining the Svelte 5 reactive subscription pattern. _(Code Quality + Architecture)_

8. **Stat card markup repeated 3 times** — Sessions/Duration/Streak cards share identical 8-line structure. Could use `{#each}` over a descriptor array. _(Code Quality)_

9. **Terse destructuring in `loadData`** — `let [st, f, rd]` is unclear; use `[loadedTrackables, loadedForms, loadedRestDays]`. _(Code Quality)_

10. **Fragile import ordering in tests** — `widget.test.ts:2-4` depends on `dashboard.ts` being imported before `sportSummary.ts` to avoid circular dependency errors. Only protected by a single-line comment. _(Test Coverage)_

11. **Zero-duration edge case untested** — Entries with `pNumber(0)` duration are not covered at the widget test level. _(Test Coverage)_

### Dismissed

- **Spec compliance "3x1 default dimensions"** — DISMISSED. The spec references `createDefaultWidget()` which does not exist in the codebase. The framework uses `getMinWidth()`/`getMinHeight()` for initial sizing. This is a spec documentation error, not a code deficiency.

### Cross-AI Validation Summary

| AI | Model | Findings |
|----|-------|----------|
| **Claude** (6 agents) | Opus 4.6 | Race condition, dead code, code quality items, test gaps |
| **Codex** | GPT-5.4 | Race condition (confirmed), **quick-log no-refresh** (unique), error handling |
| **Cursor** | Composer 2 (Kimi K2.5) | Race condition (confirmed), **streak/new Date()** (unique), loaded-stays-true transient mismatch |

**Consensus**: All 3 AIs independently identified the `$effect` race condition as the top issue. Codex and Cursor each found one additional major issue the others missed.
<!-- /SECTION:key-findings -->

---

## Spec Compliance
<!-- SECTION:spec-compliance -->
### Spec Compliance

**Agent**: `spec-compliance-reviewer` | **Status**: NON_COMPLIANT

#### Requirements Verification

| # | Acceptance Criterion | Status | Evidence | Notes |
|---|---------------------|--------|----------|-------|
| 1 | `SPORT_SUMMARY` widget type registered in `DashboardWidgetType` enum | IMPLEMENTED | `client/src/model/dashboard/dashboard.ts:75` | Enum value `SPORT_SUMMARY = "SPORT_SUMMARY"` present. Also added to `DashboardWidgetSettings` union at line 98 and to `definitions` map at line 139. |
| 2 | Widget definition exists with correct default dimensions (3x1) and minimum dimensions (2x1) | PARTIAL | `client/src/model/dashboard/widgets/sportSummary.ts:22-28` | Min dimensions (2x1) are correctly implemented via `getMinWidth()=2` and `getMinHeight()=1`. However, the spec states default dimensions are 3x1 set in a `createDefaultWidget()` method -- no such method exists in `DashboardSportSummaryWidgetDefinition` or anywhere in the codebase. The default width=3 is never set. The test at `widget.test.ts:66` claims to test "default dimensions are 3x1" but only asserts min dimensions (2x1), never verifying width=3. |
| 3 | Widget displays weekly stats (sessions, duration, streak) matching Sport page values | IMPLEMENTED | `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:78-86,106-131` | Widget calls `statsService.computeWeekStats()` (same service as Sport page) and renders `weekStats.sessions`, `formatDurationMs(weekStats.totalDurationMs)`, and `weekStats.streak`. Uses `$dashboardDate` for week range derivation. |
| 4 | Quick-log [+] dropdown lists sport trackables by icon + name | IMPLEMENTED | `client/src/components/sport/SportQuickLog.svelte:35-41` | Dropdown iterates `trackables`, rendering `trackable.icon` and `trackable.name` for each. [+] button uses `faPlus` icon at line 24-28. |
| 5 | Tapping a trackable in quick-log opens FormModal for that trackable | IMPLEMENTED | `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:88-90` and `SportQuickLog.svelte:17-19` | `select()` calls `onSelect(trackable)` which maps to `onQuickLog` in the widget, which calls `openFormModal(trackable.formId)`. |
| 6 | Widget settings editor allows editing widget name (default: "Sport This Week") | IMPLEMENTED | `client/src/components/dashboard/sidebar/edit/types/sportSummary/EditSportSummaryWidgetSidebar.svelte:12-15,21` and `client/src/model/dashboard/widgets/sportSummary.ts:31-33` | Input field bound to `settings.name`, calls `onChange` on input. Default settings return `name: "Sport This Week"`. |
| 7 | Widget registered in BOTH RENDERERS maps (display + edit sidebar) | IMPLEMENTED | `client/src/components/dashboard/DashboardWidgetRenderer.svelte:53` and `client/src/components/dashboard/sidebar/edit/EditWidgetSidebar.svelte:52` | Both maps contain `[DashboardWidgetType.SPORT_SUMMARY]: ...` entries pointing to the correct components. |
| 8 | `createDependencies()` returns `new Map()` (stats bypass Variable system) | IMPLEMENTED | `client/src/model/dashboard/widgets/sportSummary.ts:37-39` | Method returns `new Map()` with comment explaining sport stats bypass the Variable system. |
| 9 | All existing tests continue to pass | NEEDS_CLARIFICATION | Spec claims 150/150 tests pass | Cannot independently verify runtime test results in this review. The spec's completion summary states "150 tests passed across 25 files (0 regressions)." No structural issues found that would cause regressions. |

**Coverage**: 7/9 criteria fully implemented, 1 partial, 1 unverifiable in static review

#### Extra Work (not in spec)

| File | Change | Justification |
|------|--------|---------------|
| `sportSummary.ts:41-43` | `updateDependencies()` method | JUSTIFIED -- required by `DashboardWidgetDefinition` interface contract (returns empty Map, consistent with `createDependencies` approach) |

#### Issues

- [MAJOR] **Partial implementation**: Criterion #2 -- The spec explicitly states "Default size at creation time: w=3, h=1 (set in `createDefaultWidget()` method, not via min getters)." No `createDefaultWidget()` method exists in the definition class. The widget will be created with whatever the framework default is (likely min dimensions 2x1), not the specified 3x1 default. The test (`widget.test.ts:66`) is titled "default dimensions are 3x1" but only verifies min dimensions -- this is a misleading test that masks the missing implementation. If the dashboard framework handles default dimensions differently (e.g., via a shared base method that reads min dimensions), the spec text is inaccurate rather than the code being wrong -- but as written, the spec requirement is not met.
<!-- /SECTION:spec-compliance -->

---

## Security Review
<!-- SECTION:security -->
### Security

**Agent**: `security-code-reviewer`

*No security issues found.*

- [INFO] **Svelte text interpolation is safe by default**: All user-controlled values rendered in templates (`settings.name` at `DashboardSportSummaryWidget.svelte:96`, `trackable.icon` and `trackable.name` at `SportQuickLog.svelte:39-40`, and numeric stats at lines 111/119/128) use Svelte's `{expression}` syntax, which auto-escapes output to text nodes. No `{@html}` directives are used anywhere in the changed files, so there is no XSS vector through template rendering.

- [INFO] **Widget settings input is text-only with no dangerous sinks**: The `EditSportSummaryWidgetSidebar.svelte` name input (`oninput` at line 21) reads from `HTMLInputElement.value` and passes it through a typed callback (`onChange`). The value is only ever rendered as a text node (never injected into `innerHTML`, `href`, or script context), which is safe.

- [INFO] **SportQuickLog event handlers are well-scoped**: The dropdown in `SportQuickLog.svelte` passes typed `Trackable` objects to `onSelect`, which feeds into `openFormModal(trackable.formId)`. The `formId` originates from the local Dexie/IndexedDB store (not from URL params or external input), limiting injection risk. The backdrop overlay properly closes the dropdown on external click.

- [INFO] **No dynamic query construction**: `journal.getSportEntries()` at `DashboardSportSummaryWidget.svelte:51-54` receives timestamp numbers and a string array of form IDs sourced from local store data. No user-supplied strings are interpolated into queries.

- [INFO] **No sensitive data exposure**: The `console.error` at `DashboardSportSummaryWidget.svelte:63` logs only the caught exception object from local data loading -- no credentials, tokens, or PII are included in the log statement.

- [INFO] **Settings type constraint is minimal but acceptable**: `DashboardSportSummaryWidgetSettings` contains only `{ name: string }` with no length validation. This is a cosmetic concern (a very long name could cause layout overflow) rather than a security vulnerability, since the value never leaves the client-side IndexedDB store in a dangerous way. Flagging as informational only.
<!-- /SECTION:security -->

---

## Code Quality
<!-- SECTION:code-quality -->
### Code Quality

**Agent**: `code-quality-reviewer`

- [MINOR] **Duplicate `formatDuration` logic in `SportStatsService`**: The standalone function `formatDurationMs` (line 39) and the instance method `SportStatsService.formatDuration` (line 95) in the stats service contain identical logic. The widget imports the standalone version, which is correct, but the instance method is dead code that will cause confusion about which to use.
  - Location: `client/src/services/sport/stats.ts:95-100`
  - Suggestion: Remove the `formatDuration` instance method. The standalone `formatDurationMs` is the canonical version.

- [MINOR] **`updateDependencies` implements a commented-out interface method**: `DashboardSportSummaryWidgetDefinition` declares `updateDependencies` (line 41), but the `DashboardWidgetDefinition` interface has this method commented out (dashboard.ts line 119). This is dead code. Existing widgets like `checklist.ts` still carry it from before the interface change, but new code should not perpetuate it.
  - Location: `client/src/model/dashboard/widgets/sportSummary.ts:41-43`
  - Suggestion: Remove `updateDependencies` from the sport summary definition since it is not part of the current interface contract.

- [MINOR] **Terse destructuring variable names in `loadData`**: `let [st, f, rd]` requires reading the `Promise.all` arguments to understand what each abbreviation means. The state variables they assign to use clear names (`sportTrackables`, `allForms`, `allRestDays`), so the destructuring should match.
  - Location: `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:39`
  - Suggestion: Use `let [loadedTrackables, loadedForms, loadedRestDays]` for consistency with the target state variables.

- [MINOR] **Stat card markup repeated 3 times with only data varying**: The three stat cards (Sessions, Duration, Streak) at lines 107-130 share identical 8-line structure. Only icon, color scheme, value, and label differ.
  - Location: `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:107-130`
  - Suggestion: Extract a derived array of stat descriptors `[{icon, colorClass, value, label}]` and iterate with `{#each}`. Adding or removing a stat becomes a one-line change instead of copying 8 lines.

- [MINOR] **`$effect` uses dummy variables for dependency tracking**: The `$effect` block assigns `currentWeekStart` and `currentWeekEnd` to unused `_start`/`_end` variables solely to subscribe to reactivity. This is a valid Svelte 5 pattern but is opaque without explanation.
  - Location: `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:67-71`
  - Suggestion: Add a comment like `// Subscribe to week range changes` above the dummy reads, or pass the values as arguments to `loadData(start, end)` to make the dependency chain self-documenting.

- [INFO] **Consistent pattern adherence**: The widget registration follows the established pattern exactly -- enum in `DashboardWidgetType`, union member in `DashboardWidgetSettings`, definition in the `definitions` map, renderer entries in both `DashboardWidgetRenderer.svelte` and `EditWidgetSidebar.svelte`. Well executed.

- [INFO] **Good error handling in `loadData`**: The `try/catch` sets `loaded = true` in the catch path, preventing the widget from being stuck in a perpetual loading state on failure. This is a solid defensive pattern not all existing widgets implement.

- [INFO] **Clean component decomposition**: Extracting `SportQuickLog.svelte` as a standalone dropdown keeps the main widget focused on stats display and makes the quick-log reusable elsewhere.
<!-- /SECTION:code-quality -->

---

## Architecture Review
<!-- SECTION:architecture -->
### Approach Review

**Agent**: `senior-architecture-reviewer` | **Status**: MINOR_ADJUSTMENTS

#### Requirements Check

| Requirement | Status | Notes |
|-------------|--------|-------|
| SPORT_SUMMARY enum registered | DONE | Added to `DashboardWidgetType` enum in `dashboard.ts:75` |
| Widget definition with 2x1 min dimensions | DONE | `sportSummary.ts` defines minWidth=2, minHeight=1 |
| Weekly stats display (sessions, duration, streak) | DONE | Widget derives stats via `statsService.computeWeekStats()` |
| Quick-log dropdown lists sport trackables | DONE | `SportQuickLog.svelte` renders trackable list, triggers `openFormModal` |
| Settings editor for widget name | DONE | `EditSportSummaryWidgetSidebar.svelte` with text input |
| Registered in BOTH RENDERERS maps | DONE | Both `DashboardWidgetRenderer.svelte:53` and `EditWidgetSidebar.svelte:52` |
| `createDependencies()` returns empty Map | DONE | Explicitly returns `new Map()` with comment explaining bypass |
| Existing tests pass | DONE | 150/150 per completion summary |

#### TDD Compliance

**Score**: 0/1 | **Status**: VIOLATIONS_FOUND

| Criterion | Test Commit | Impl Commit | Order | Status |
|-----------|-------------|-------------|-------|--------|
| All Phase 3 work | 218d213 | 218d213 | SAME_COMMIT | MINOR_VIOLATION |

All implementation and test code landed in a single `wip: auto-commit` (218d213). There are no separate test-first commits. This is a minor TDD violation since the tests do exist and cover the definition class well (11 tests in `widget.test.ts`), but the commit history does not demonstrate test-first discipline.

#### Solution Assessment

| Metric | Score | Notes |
|--------|-------|-------|
| Approach Quality | 8/10 | Sound approach. Bypassing the Variable system is justified and documented. The widget reuses `SportStatsService.computeWeekStats()` directly, ensuring consistency with the Sport page. |
| Architecture Fit | 7/10 | Follows existing widget patterns closely (matches Goal/Welcome pattern for definition class, RENDERERS registration, and file placement). Two issues noted below: dead `updateDependencies` method and inherited circular dependency. |
| Best Practices | 7/10 | Good error handling in `loadData()`. Minor concerns around service instantiation in the component and implicit reactive dependency tracking. |

#### Issues

- [MAJOR] **`updateDependencies` method is dead code not required by interface**: `DashboardSportSummaryWidgetDefinition` in `client/src/model/dashboard/widgets/sportSummary.ts:41-43` implements an `updateDependencies()` method, but the `DashboardWidgetDefinition` interface in `client/src/model/dashboard/dashboard.ts:118-119` has this method **commented out**. This means the method exists on the class but is never callable through the interface, making it dead code. The Goal widget (`goal.ts`) and Welcome widget (`welcome.ts`) also carry this vestigial method, so it is a pre-existing pattern -- but new code should not propagate dead code further. Note: the spec-compliance reviewer marked this as "JUSTIFIED -- required by interface contract," but that assessment is incorrect since the interface has the method commented out. --> **Suggestion**: Remove `updateDependencies` from `sportSummary.ts`. Do not copy dead code from older widgets.

- [MINOR] **Circular dependency between `sportSummary.ts` and `dashboard.ts` (inherited)**: `sportSummary.ts:1` imports `DashboardWidgetType` from `dashboard.ts`, and `dashboard.ts:47-48` imports `DashboardSportSummaryWidgetDefinition` from `sportSummary.ts`. This is the identical circular pattern used by all 12 existing widget definitions (Goal, Welcome, Chart, EntryRow, Table, Tags, Metric, Trackable, NewCorrelations, Insights, Checklist, Reflections). The test file documents this at line 2-3. This works in practice because ES module resolution handles type-level circularity and the `definitions` Map is populated after all imports resolve. **Assessment**: Not blocking -- the PR correctly follows established precedent. Tech debt note: extracting `DashboardWidgetType` enum into `model/dashboard/widgetType.ts` would break the cycle for all widgets.

- [MINOR] **Service instances created directly in component body**: `DashboardSportSummaryWidget.svelte:25-26` creates `new SportStreakService()` and `new SportStatsService(streakService)` inside the component. The architectural convention is views -> stores -> services, meaning views should not instantiate services directly. However, these services are stateless computation utilities with no side effects and no shared state, making this a pragmatic and acceptable trade-off. If sport services gain state or caching in the future, they should be moved to singletons consumed via a store.

- [MINOR] **`$effect` with implicit dependency capture deserves a comment**: In `DashboardSportSummaryWidget.svelte:67-71`, the `$effect` assigns `currentWeekStart`/`currentWeekEnd` to unused local variables to register them as reactive dependencies that trigger `loadData()`. This is a valid Svelte 5 pattern, but the unused variables look like mistakes without a comment. --> **Suggestion**: Add a brief comment like `// Reactive deps: re-run loadData when week range changes`.

- [INFO] **`SportQuickLog` placement is architecturally correct**: Located at `client/src/components/sport/SportQuickLog.svelte` (general sport component) rather than under `components/dashboard/`. This is the right call -- the component has zero dashboard-specific dependencies (accepts only `trackables: Trackable[]` and `onSelect` callback), making it reusable on the Sport page or other surfaces. Good separation of concerns.

- [INFO] **Variable system bypass is architecturally justified**: Compared against two existing widgets: (1) Goal widget (`goal.ts`) returns empty Map from `createDependencies()`, (2) Welcome widget (`welcome.ts`) also returns empty Map. This establishes clear precedent for widgets that do not participate in the Variable dependency system. The Sport Summary widget follows this pattern with explicit documentation (comment at `sportSummary.ts:36`). The rationale -- avoiding dual-math complexity by reusing Sport page services directly -- is sound and well-documented in the tech decomposition (Implementation Decision #4).

- [INFO] **Widget pattern consistency verified across layers**: Compared the new widget against Goal and Welcome widget patterns: (1) definition class structure (interface implementation, settings type, methods) -- consistent; (2) enum + union + definitions map registration in `dashboard.ts` -- consistent; (3) RENDERERS map entries in both `DashboardWidgetRenderer.svelte` and `EditWidgetSidebar.svelte` -- consistent; (4) file/folder naming convention (`types/sportSummary/`) -- consistent.
<!-- /SECTION:architecture -->

---

## Test Coverage
<!-- SECTION:test-coverage -->
### Test Coverage

**Agent**: `test-coverage-reviewer`

- [MINOR] **Coverage gap**: `updateDependencies` method untested
  - Files: `client/src/model/dashboard/widgets/sportSummary.ts:41-43`
  - Every other public method on `DashboardSportSummaryWidgetDefinition` has explicit coverage (`getType`, `getName`, `getIcon`, `getMinWidth`, `getMinHeight`, `getDefaultSettings`, `createDependencies`). The `updateDependencies` method is the sole gap. While it is a trivial empty-map return, testing it completes 100% method coverage and guards against accidental future changes.
  - Suggestion: Add to the TP-8.1 describe block: `test("updateDependencies returns empty map", () => { const def = new DashboardSportSummaryWidgetDefinition(); const deps = def.updateDependencies({}, {name: "Old"}, {name: "New"}); expect(deps).toBeInstanceOf(Map); expect(deps.size).toBe(0); });`

- [MINOR] **Edge case missing**: Zero-duration entries not tested at widget level
  - Files: `client/tests/sport/widget.test.ts` (TP-8.2 block)
  - TP-8.2 tests cover no-entries (line 155) and multiple trackables (line 131), but not entries where duration is `pNumber(0)`. Such entries should count as a session (`sessions === 1`) while contributing `0` to `totalDurationMs`. The stats service tests in `client/tests/sport/stats.test.ts` cover zero-duration formatting, but the widget-level consistency test does not verify this boundary.
  - Suggestion: Add a test with `pNumber(0)` entries asserting `sessions > 0` and `totalDurationMs === 0`.

- [MINOR] **Fragile import ordering**: Circular dependency workaround is comment-only
  - Files: `client/tests/sport/widget.test.ts:2-4`
  - The test relies on importing `dashboard.ts` before `sportSummary.ts` to avoid a circular dependency, documented only by a single-line comment. If a developer or auto-formatter reorders imports, tests break with a non-obvious error. This is a test reliability concern.
  - Suggestion: Add a more prominent doc comment explaining the constraint, or restructure the module graph so the registration side-effect in `dashboard.ts` does not create the circular path.

- [INFO] **Svelte components not unit-tested (acceptable)**: `DashboardSportSummaryWidget.svelte`, `SportQuickLog.svelte`, and `EditSportSummaryWidgetSidebar.svelte` have no test files. This is consistent with the project pattern -- no other dashboard widget Svelte components have unit tests. Core logic (stats computation, definition registration) is extracted into pure TypeScript and tested there, which is the correct testing pyramid approach.

- [INFO] **Positive practice**: Strong spec-to-test traceability. Tests are organized under `describe("TP-8.1: ...")` and `describe("TP-8.2: ...")` blocks referencing spec test point IDs directly. Good pattern for audit trails.

- [INFO] **Positive practice**: The `mockEntry` helper from `tests/common.ts` wraps answers in `pDisplay` (matching real Dexie/IndexedDB storage format), which means the `unwrapDisplayValue` code path in `getEntryDurationMs` is exercised implicitly through widget stats tests.
<!-- /SECTION:test-coverage -->

---

## Performance Review
<!-- SECTION:performance -->
### Performance

**Agent**: `performance-reviewer`

- [MAJOR] **Race condition from unguarded async `$effect`**: The `$effect` (line 67-71) calls `loadData()` on every change to `currentWeekStart`/`currentWeekEnd` but does not cancel or sequence prior in-flight calls. If the user navigates weeks rapidly, multiple `loadData()` calls race and the last to resolve wins -- which may not be the most recent request. This causes stale data to overwrite fresh data.
  - Location: `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:67-71`
  - Impact: Stale week data displayed after rapid navigation. With slow IndexedDB queries, the window for this is meaningful.
  - Suggestion: Add a monotonic counter so only the latest call's result is applied.
    ```ts
    // Before
    $effect(() => {
        let _start = currentWeekStart;
        let _end = currentWeekEnd;
        loadData();
    });

    // After
    let loadGeneration = 0;
    $effect(() => {
        let _start = currentWeekStart;
        let _end = currentWeekEnd;
        let gen = ++loadGeneration;
        loadData(gen);
    });
    // Inside loadData, skip state writes if gen !== loadGeneration
    ```

- [INFO] **Streak computed from week-scoped entries only**: `computeWeekStats` passes the week-filtered `sportEntries` to `streakService.calculateStreak()`, which walks back up to 365 days. Since entries only span the current week (max 7 days), the streak will never exceed 7 and the loop exits early on the first gap outside the week. Not a performance problem (the loop exits quickly), but the streak value will be incorrect if the intent is to show a global streak spanning multiple weeks.
  - Location: `client/src/services/sport/stats.ts:90` called from widget line 82-86

- [INFO] **Multiple widget instances duplicate data loads**: If multiple `DashboardSportSummaryWidget` instances exist on the same dashboard, each independently calls `trackables.getSportTrackables()`, `$forms`, `$restDays`, and `journal.getSportEntries()`. The stores likely serve from cache so practical impact is low, but `getSportEntries()` may hit IndexedDB each time. Not actionable now given the niche scenario.
  - Location: `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte:39-58`

No issues found with:
- **Service instantiation**: `SportStreakService` and `SportStatsService` are stateless and lightweight -- per-widget instances are fine.
- **`computeWeekStats` complexity**: O(trackables * questions + entries * fields) which is well-bounded for typical data sizes.
- **`SportQuickLog` overlay**: The `fixed inset-0` div is conditionally rendered (`{#if open}`) so it has zero cost when the dropdown is closed. When open, it is a single transparent element -- negligible.
- **`buildTimeElapsedFieldsMap`**: Rebuilt per derivation but O(small) -- memoization would add complexity for no real gain.
<!-- /SECTION:performance -->

---

## Coverage
<!-- SECTION:coverage -->
| Reviewer | Status | Critical | Major | Minor | Info |
|----------|--------|----------|-------|-------|------|
| Spec Compliance | Completed | 0 | 1 (dismissed) | 0 | 0 |
| Security | Completed | 0 | 0 | 0 | 6 |
| Code Quality | Completed | 0 | 0 | 5 | 3 |
| Architecture | Completed | 0 | 1 | 3 | 3 |
| Test Coverage | Completed | 0 | 0 | 3 | 3 |
| Performance | Completed | 0 | 1 | 0 | 2 |
| Documentation | Skipped | — | — | — | — |
| **Codex** (GPT-5.4) | Completed | 0 | 2 | 2 | 1 |
| **Cursor** (Composer 2) | Completed | 0 | 3 | 4 | 5 |

**Documentation reviewer skipped**: Task is component code with no public API docs. Tech decomposition serves as documentation.
<!-- /SECTION:coverage -->

---

## Verification
<!-- SECTION:verification -->
| Command | Result |
|---------|--------|
| `npx svelte-check --output human` | 0 errors, 68 warnings (all pre-existing) |
| `npx vitest run` (from `client/`) | 150/150 tests passed, 25 test files, 0 failures |
<!-- /SECTION:verification -->

---

## Metadata
<!-- SECTION:metadata -->
| Field | Value |
|-------|-------|
| Diff source | `git diff c5498fa..218d213` |
| Changed files (source) | 8 (excl. task doc) |
| Lines added | 460 |
| Lines removed | 0 |
| Reviewers invoked | 6 (spec-compliance, security, code-quality, architecture, test-coverage, performance) |
| Reviewers skipped | 1 (documentation-accuracy — no public API docs in scope) |

**Changed files**:
- `client/src/model/dashboard/widgets/sportSummary.ts` (NEW)
- `client/src/model/dashboard/dashboard.ts` (MODIFIED)
- `client/src/components/dashboard/types/sportSummary/DashboardSportSummaryWidget.svelte` (NEW)
- `client/src/components/dashboard/sidebar/edit/types/sportSummary/EditSportSummaryWidgetSidebar.svelte` (NEW)
- `client/src/components/sport/SportQuickLog.svelte` (NEW)
- `client/src/components/dashboard/DashboardWidgetRenderer.svelte` (MODIFIED)
- `client/src/components/dashboard/sidebar/edit/EditWidgetSidebar.svelte` (MODIFIED)
- `client/tests/sport/widget.test.ts` (NEW)
<!-- /SECTION:metadata -->
