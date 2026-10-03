# Implementation tickets

All six hosts are in the initial release. Statuses describe installer work; none is marked implemented by the planning ZIP.

| ID | Result | Depends on |
|---|---|---|
| [SKP-001](SKP-001.md) | Reuse the catalog and repair portable instruction discovery | none |
| [SKP-002](SKP-002.md) | Create an independently installable CLI baseline | SKP-001 |
| [SKP-003](SKP-003.md) | Prove the contracts for all six host adapters | SKP-002 |
| [SKP-004](SKP-004.md) | Resolve complete dependencies and immutable content snapshots | SKP-001, SKP-002 |
| [SKP-005](SKP-005.md) | Install a requested skill and its dependencies on the selected host | SKP-003, SKP-004 |
| [SKP-006](SKP-006.md) | Update and remove safely without losing local changes | SKP-005 |
| [SKP-007](SKP-007.md) | Explain installation health without changing it | SKP-005, SKP-006 |
| [SKP-008](SKP-008.md) | Use the same operations through Agent Native | SKP-004, SKP-005, SKP-006, SKP-007 |
| [SKP-009](SKP-009.md) | Build reviewable bundles and release artifacts | SKP-004, SKP-008 |
| [SKP-010](SKP-010.md) | Verify the installer across Windows, macOS, and Linux | SKP-006, SKP-007, SKP-008, SKP-009 |
| [SKP-011](SKP-011.md) | Qualify the complete flow in every initial host | SKP-003, SKP-010 |
| [SKP-013](SKP-013.md) | Mount a read-only loopback MCP endpoint | SKP-002, SKP-008 |
| [SKP-014](SKP-014.md) | Verify the MCP protocol and packed consumer | SKP-009, SKP-013 |
| [SKP-012](SKP-012.md) | Prepare the release and leave an honest handoff | SKP-009, SKP-010, SKP-011, SKP-014 |

Follow the dependency graph. SKP-003 is deliberately early: resolve native host uncertainty before building around guessed paths. SKP-011 is acceptance, not the first time Grok Bot, Grok CLI, or Antigravity receives implementation attention.
