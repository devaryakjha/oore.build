# Operator workspace qualification

Accepted on 2026-08-23 against the authenticated demo at 1440x900 and 390x844.

## Screenshots

- [Operator Overview, desktop light](./operator-desktop-light.png)
- [Operator Overview, mobile dark](./operator-mobile-dark.png)
- [Project Overview, desktop dark](./project-desktop-dark.png)
- [Project Overview, mobile light](./project-mobile-light.png)

## Observed browser results

- The operator Overview renders Needs attention, Running now, Ready to install/share, and Recent failures in the accepted order. The demo exposed five valid install links and five permission-gated share controls.
- The project Overview renders Health, Build activity, and Delivery. Its tabs remain Overview, Builds, Pipelines, and Settings. The demo exposed two install-ready artifacts and two permission-gated share controls.
- The owner Settings hub exposes General, Runners, Sources, Artifact storage, Retention, Users, API tokens, Notifications, and Audit log through one Settings destination.
- A developer can open the FlutterShop project, run a build, and read one current FlutterShop breadcrumb without owner-only Users or Audit log links.
- A QA viewer lands on Ready to test, has six install links in the fixture, and does not receive the operator sidebar.
- Each tested page retains `main-content` and the skip link. Nested breadcrumb links no longer mark an ancestor as the current page.
- No Base UI button-semantics errors remained after the live pass.

## Mechanical results

- `make validate`: passed after the live fixes.
- Web tests: 34 passed, including navigation, breadcrumb, project health, Overview selection, and demo multi-field search behavior.
- Rust tests: 11 passed, including role-filtered project health and literal multi-field build search.
- Production and demo web builds passed. The existing TanStack Virtual React Compiler advisory and bundle-size warning remain unchanged.

All new Overview data comes from existing API responses, the additive project latest-build contract, or the bounded build/artifact queries in this change. The UI does not add release entities or install analytics.
