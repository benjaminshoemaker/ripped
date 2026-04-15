// Task 1.2.B scaffold: browser-level fail-loud smoke for REQ-028.
// This file is a placeholder — the real Playwright runner + loadFixture
// helper land in Task 2.0.A. Once the harness exists, this test will
// route `/data.json` to a broken fixture and assert the page renders
// `[data-testid="full-page-error"]` with no team grid.
//
// Until Task 2.0.A lands, this file is intentionally non-executable.
// It serves as the contract `src/validate.ts` must satisfy in the
// browser runtime.
//
// Contract:
//   GIVEN /data.json returns a malformed payload
//   WHEN  the page loads
//   THEN  [data-testid="full-page-error"] renders
//   AND   [data-testid="team-grid"] does NOT render
//
// See plans/greenfield/EXECUTION_PLAN.md Task 1.2.B for the full spec
// and Task 2.0.A for the Playwright harness.
export {};
