# Issue tracker: GitHub

GitHub Issues contains the work records for this repository.

[Oore CI Project](https://github.com/orgs/oore-ci/projects/2/) is the
canonical progress view.

Every issue and task must be in Oore CI Project. Every issue and task must
have one repository milestone.

Pull requests are not a triage request surface. Link each pull request to its
issue.

## Language

Use strict Simplified Technical English for all agent-authored issue, pull
request, and comment text.

Use the official ASD-STE100 dictionary for full vocabulary compliance.

Use short sentences. Use direct statements. Use the same term for the same
item.

## Public content

GitHub content must contain user-relevant project information.

An issue can contain:

- The problem.
- The user outcome.
- The scope.
- The acceptance criteria.
- The milestone.
- The parent issue or sub-issues.
- A decision or blocker that changes the scope.

A pull request can contain:

- The change.
- The linked issue.
- The user or release effect.
- A decision or blocker that needs user input.

Do not publish:

- Test commands.
- Test results.
- Missing-test notes.
- Agent notes.
- Work logs.
- Execution logs.
- Internal handoff notes.
- Local validation details.
- Comments that only report progress.

Keep local validation evidence in the Codex task.

## Oore CI Project

Add every issue and task to
[Oore CI Project](https://github.com/orgs/oore-ci/projects/2/).

Set these project fields:

- `Status`
- `Release`
- `Feature`
- `Priority`
- `Area`
- `Work type`

Set `Start date` and `Target date` when the work has a schedule.

Change `Status` when the work state changes. Do not use an issue comment as a
progress log.

Keep `Release` equal to the release milestone. Use `Feature` for the smaller
product group.

## Milestones and hierarchy

Use a milestone for a release or a defined product objective.

Use semantic version names for release milestones. Examples include `v0.3.0`
and `v1.0.0`.

Give each milestone a clear outcome. Give each scheduled milestone a target
date.

Do not create a milestone for one task. Use a parent issue and sub-issues for
smaller work.

Use the same milestone for a parent issue and its sub-issues.

If no correct milestone exists, create the milestone before you create the
issue.

If an external issue has no milestone, assign one during the first triage.

## Operations

Create an issue:

`gh issue create --title "..." --body "..." --project "Oore CI" --milestone "..."`

Add an existing issue to the project:

`gh project item-add 2 --owner oore-ci --url <issue-url>`

Assign a milestone:

`gh issue edit <number> --milestone "..."`

Read an issue:

`gh issue view <number> --comments`

List issues:

`gh issue list --state open --json number,title,body,labels,comments,milestone`

Change labels:

`gh issue edit <number> --add-label "..."`

Close an issue:

`gh issue close <number>`

## Wayfinding operations

Use GitHub sub-issues and issue dependencies. Do not use checklists as the only
hierarchy or dependency record.

- A map is an issue with the `wayfinder:map` label.
- Decision tickets are sub-issues.
- Use `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or
  `wayfinder:task`.
- Create a child with
  `gh issue create --parent <map> --label "wayfinder:<type>" ...`.
- Add existing tickets with
  `gh issue edit <map> --add-sub-issue <ticket>`.
- Add a blocker with
  `gh issue edit <ticket> --add-blocked-by <blocker>`.
- Claim an unblocked ticket with
  `gh issue edit <ticket> --add-assignee @me`.

Add each map and ticket to Oore CI Project. Assign the same milestone to each
map and its tickets.

A frontier ticket is open and unassigned. All its blockers are closed.

Close a decision ticket after it contains the user-relevant decision. Add a
one-line decision link to the map.
