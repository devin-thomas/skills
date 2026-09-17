# Owned Skill Manifest

Machine-readable catalog of Devin-owned public skills across approved source repositories.

## Format

`skills.json` is the canonical manifest. Each skill entry contains:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Stable unique skill identity |
| `slug` | string | Public route slug |
| `title` | string | Human display title |
| `summary` | string | Concise teaching/catalog summary |
| `category` | string | One of: `plan`, `build`, `specialized`, `fun` |
| `order` | integer | Deterministic ordering within the category |
| `sourceRepo` | string | Canonical public repository (`owner/repo`) |
| `sourcePath` | string | Entry-point path within that repository |
| `sourceVersion` | string or null | Optional friendly version |
| `sourceRevision` | string | Immutable 40-char hex SHA |
| `public` | boolean | Whether the skill is intentionally public |
| `ownedBy` | string | Ownership attribution |
| `relatedSkills` | array | Ordered IDs of related skills |
| `prerequisites` | array | Structured prerequisites |
| `recommendationOnly` | boolean | True for recommendation-only records |

## Source-of-truth rules

- **Source-derived facts** (repo, path, revision, declared name/description) are checked against canonical sources when practical.
- **Editorial decisions** (slug, category, order, teaching summary, related-skill presentation) are explicit and never silently overwritten from source text.
- Skills implemented in this repository have their SKILL.md name validated against the manifest ID.
- External skills (Starter Pack, product-bound) contain references only — no implementation is copied.

## Validation

Run `python scripts/validate-manifest.py` or the standard `python scripts/validate-skills.py` (which invokes manifest validation automatically).

Tests: `python tests/test-manifest.py`

## Categories

1. **Plan** — Skills that establish how work begins and how it will be executed.
2. **Build** — Skills for constructing, executing, and quality-checking implementations.
3. **Specialized** — Skills tied to particular platforms or product domains.
4. **Fun** — Skills whose primary role is enjoyment.
