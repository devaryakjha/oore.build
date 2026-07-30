# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues. Use the `gh` CLI and
infer `oore-ci/oore.build` from the repository remote.

## Operations

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Pull requests are not a triage request surface.

When a skill says to publish work, create a GitHub issue. When it asks for a
ticket, read the referenced issue and its comments.

## Wayfinding operations

Use GitHub's native sub-issues and issue dependencies. Do not encode hierarchy
or blocking only in issue-body checklists.

- A map is an issue labelled `wayfinder:map`.
- Decision tickets are native sub-issues labelled `wayfinder:research`,
  `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Create a child directly with
  `gh issue create --parent <map> --label "wayfinder:<type>" ...`.
- Add existing tickets with
  `gh issue edit <map> --add-sub-issue <ticket>`.
- Mark a ticket as blocked with
  `gh issue edit <ticket> --add-blocked-by <blocker>`.
- Mark the inverse edge with
  `gh issue edit <blocker> --add-blocking <ticket>`.
- Claim an unblocked ticket before working it with
  `gh issue edit <ticket> --add-assignee @me`.
- Query issue state, assignees, and labels with
  `gh issue view <ticket> --json state,assignees,labels`.
- Use the GitHub UI or REST issue dependency endpoints when a frontier query
  needs the complete native blocking graph.

Create issues first and wire relationships in a second pass when several new
tickets depend on one another. A frontier ticket is an open, unassigned child
whose native blockers are all closed. Close the decision ticket only after its
resolution comment is posted, then add a one-line linked gist to the map's
`Decisions so far` section.
