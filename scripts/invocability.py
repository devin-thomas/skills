"""Reject skills whose settings hide them from the model.

Every skill must stay model-invocable. A skill fails when its SKILL.md
frontmatter or its sibling agents/openai.yaml sets disable-model-invocation,
user-invocable-only, allow_implicit_invocation: false or an equivalent, in any
spelling, at the top level or inside one host block (metadata, policy, claude,
codex, openai, agents). `user-invocable: false` only hides a skill from the
user's slash menu and passes. The same rules run in dvn's loader and audit.

Standard library only: this is a small YAML subset reader for flat and
one-level nested mappings. Block scalars are skipped, so prose that mentions a
setting never counts. Anything it cannot read safely is reported, so the check
fails closed.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Final

RULE: Final[str] = (
    "Every skill must stay model-invocable: remove disable-model-invocation, "
    "user-invocable-only, allow_implicit_invocation: false and equivalent settings "
    "from SKILL.md frontmatter and agents/openai.yaml."
)
# Keys whose only passing value is an unquoted false.
_MUST_BE_FALSE: Final[frozenset[str]] = frozenset(
    {"disablemodelinvocation", "userinvocableonly", "manualonly", "useronly"}
)
# Keys whose only passing value is an unquoted true.
_MUST_BE_TRUE: Final[frozenset[str]] = frozenset(
    {
        "modelinvocable",
        "modelinvocation",
        "allowmodelinvocation",
        "allowimplicitinvocation",
        "implicitinvocation",
    }
)
_MODE_KEYS: Final[frozenset[str]] = frozenset(
    {"invocation", "invocable", "invocationmode", "invocationpolicy"}
)
_MODEL_MODES: Final[frozenset[str]] = frozenset(
    {"auto", "automatic", "model", "implicit", "both", "any", "all"}
)
_NESTED: Final[frozenset[str]] = frozenset(
    {"metadata", "policy", "claude", "codex", "openai", "agents"}
)
_TRUE: Final[frozenset[str]] = frozenset({"true", "True", "TRUE"})
_FALSE: Final[frozenset[str]] = frozenset({"false", "False", "FALSE"})
_KEY_LINE: Final[re.Pattern[str]] = re.compile(
    r"""^(?P<indent>[ ]*)(?P<key>"[^"]*"|'[^']*'|[^\s#'"{\[\-][^:#]*?|-[^\s:#][^:#]*?)[ ]*:(?:[ ]+(?P<value>.*?))?[ ]*$"""
)
_BLOCK: Final[re.Pattern[str]] = re.compile(r"^[|>][-+0-9]*(?:[ ]+#.*)?$")
_FRONTMATTER: Final[re.Pattern[str]] = re.compile(r"\A﻿?---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.S)


def _normalized(key: str) -> str:
    return re.sub(r"[-_\s]", "", key.strip("\"'")).lower()


def _scalar(raw: str) -> tuple[str, bool]:
    """Return (text, quoted) for a YAML scalar, with any trailing comment removed."""
    raw = raw.strip()
    if raw[:1] in {'"', "'"}:
        end = raw.find(raw[0], 1)
        return (raw[1:end] if end > 0 else raw[1:]), True
    return re.sub(r"[ ]+#.*$", "", raw).strip(), False


def _judge(path: str, name: str, raw: str) -> str | None:
    text, quoted = _scalar(raw)
    shown = f'"{text}"' if quoted else (text or "null")
    if name in _MUST_BE_FALSE:
        return None if (not quoted and text in _FALSE) else f"{path}: {shown}"
    if name in _MUST_BE_TRUE:
        return None if (not quoted and text in _TRUE) else f"{path}: {shown}"
    if name in _MODE_KEYS:
        passes = (not quoted and text in _TRUE) or text.strip().lower() in _MODEL_MODES
        return None if passes else f"{path}: {shown}"
    return None


def _flow(path: str, body: str, violations: list[str]) -> None:
    for item in body.strip().strip("{}").split(","):
        key, sep, value = item.partition(":")
        if sep:
            name = _normalized(key.strip())
            found = _judge(f"{path}.{key.strip()}", name, value)
            if found:
                violations.append(found)


def violations(yaml_text: str) -> list[str]:
    """Settings in a YAML mapping (frontmatter or openai.yaml) that hide the skill."""
    found: list[str] = []
    parent: tuple[int, str, str] | None = None  # indent, display key, normalized key
    child_indent: int | None = None
    block_indent: int | None = None
    for line in yaml_text.splitlines():
        stripped = line.strip()
        indent = len(line) - len(line.lstrip(" "))
        if block_indent is not None:
            if not stripped or indent > block_indent:
                continue
            block_indent = None
        if not stripped or stripped.startswith("#") or stripped in {"---", "..."}:
            continue
        if "\t" in line[:indent + 1]:
            found.append("unreadable indentation (tab)")
            continue
        match = _KEY_LINE.match(line)
        if not match:
            continue  # list items and plain-scalar continuations carry no settings
        key = match.group("key").strip()
        name = _normalized(key)
        value = match.group("value") or ""
        if value and _BLOCK.match(value):
            block_indent = indent
        if parent is not None and indent <= parent[0]:
            parent, child_indent = None, None
        nested = parent is not None and indent > parent[0]
        if nested:
            child_indent = indent if child_indent is None else child_indent
            if indent != child_indent:
                continue  # deeper than one host block
        if indent > 0 and not nested:
            continue  # deeper than one host block, or under a key we don't inspect
        path = f"{parent[1]}.{key}" if nested and parent else key
        if not nested and name in _NESTED:
            if value.startswith("{"):
                _flow(key, value, found)
            elif not value:
                parent = (indent, key, name)
            continue
        if value.startswith("{") or value.startswith("["):
            if name in _MUST_BE_FALSE | _MUST_BE_TRUE | _MODE_KEYS:
                found.append(f"{path}: {value}")
            continue
        if value and _BLOCK.match(value):
            if name in _MUST_BE_FALSE | _MUST_BE_TRUE | _MODE_KEYS:
                found.append(f"{path}: {value}")
            continue
        result = _judge(path, name, value)
        if result:
            found.append(result)
    return found


def skill_violations(skill_md: Path) -> list[str]:
    """Violations for one skill folder's SKILL.md and agents/openai.yaml."""
    found: list[str] = []
    text = skill_md.read_text(encoding="utf-8")
    match = _FRONTMATTER.match(text)
    if match:
        found.extend("SKILL.md " + item for item in violations(match.group(1)))
    settings = skill_md.parent / "agents" / "openai.yaml"
    if settings.is_file():
        found.extend(
            "agents/openai.yaml " + item
            for item in violations(settings.read_text(encoding="utf-8"))
        )
    return found
