---
name: code-reviewer
description: Expert code review skill for reviewing recent code changes for quality, security, maintainability, correctness, tests, performance, and regressions. Use immediately after writing or modifying code, before merge, before PR, or when the user asks for review, audit, feedback, or risk assessment.
---

# Code Reviewer

Use this skill to review code changes.

If the user explicitly asks for a subagent, dispatch a subagent with:
- `model`: `gpt-5.5`
- `reasoning_effort`: `high`

Otherwise, review in the current session.

## Start

1. Run `git diff` or a narrower diff command.
2. Focus on modified files.
3. Check the surrounding code only when needed to confirm behavior.
4. Do not rewrite code unless the user asks for fixes.

## Checklist

- Code is simple and readable.
- Names explain intent.
- No avoidable duplication.
- Errors are handled.
- Secrets and API keys are not exposed.
- Inputs are validated.
- Tests cover the changed behavior.
- Performance impact is acceptable.
- Existing contracts stay compatible.
- User changes are not reverted.

## Output

Lead with findings, ordered by severity.

Use these groups:
- Critical issues: must fix.
- Warnings: should fix.
- Suggestions: consider improving.

For each issue, include:
- File and line.
- What can break.
- A concrete fix example or clear fix direction.

If there are no issues, say that clearly and mention any test gaps or residual risk.
