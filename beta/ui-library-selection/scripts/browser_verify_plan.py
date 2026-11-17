#!/usr/bin/env python3
"""Validate a browser click-through plan used by browser_verify.mjs.

Standard library only. Does not launch a browser.

    python browser_verify_plan.py --check-plan PLAN.json

Exit codes: 0 plan is valid, 2 plan is missing or invalid.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ALLOWED_ACTIONS = frozenset(
    {
        "goto",
        "wait",
        "click",
        "type",
        "press",
        "hover",
        "scroll",
        "screenshot",
        "move",
    }
)

SELECTOR_ACTIONS = frozenset({"click", "hover", "scroll"})


def validate_plan(plan: Any) -> list[str]:
    """Return human-readable errors for a parsed plan document."""
    errors: list[str] = []
    if not isinstance(plan, dict):
        return ["plan must be a JSON object"]

    if "url" in plan and not isinstance(plan["url"], str):
        errors.append("url must be a string when present")
    if "out" in plan and not isinstance(plan["out"], str):
        errors.append("out must be a string when present")
    if "video" in plan and not isinstance(plan["video"], bool):
        errors.append("video must be a boolean when present")

    if "viewport" in plan:
        viewport = plan["viewport"]
        if not isinstance(viewport, dict):
            errors.append("viewport must be an object when present")
        else:
            for key in ("width", "height"):
                value = viewport.get(key)
                if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                    errors.append(f"viewport.{key} must be a positive integer")

    steps = plan.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("steps must be a non-empty array")
        return errors

    names: set[str] = set()
    for index, step in enumerate(steps):
        prefix = f"steps[{index}]"
        if not isinstance(step, dict):
            errors.append(f"{prefix} must be an object")
            continue
        action = step.get("action")
        if action not in ALLOWED_ACTIONS:
            errors.append(f"{prefix}.action must be one of {sorted(ALLOWED_ACTIONS)}")
            continue
        if action in SELECTOR_ACTIONS and not _nonempty_str(step.get("selector")):
            errors.append(f"{prefix}.selector is required for action {action}")
        if action == "wait" and not _positive_int(step.get("ms")):
            errors.append(f"{prefix}.ms must be a positive integer")
        if action == "type" and not _nonempty_str(step.get("text")):
            errors.append(f"{prefix}.text is required for action type")
        if action == "press" and not _nonempty_str(step.get("key")):
            errors.append(f"{prefix}.key is required for action press")
        if action == "move":
            if not _non_negative_number(step.get("x")) or not _non_negative_number(
                step.get("y")
            ):
                errors.append(f"{prefix}.x and {prefix}.y must be non-negative numbers")
        if action == "screenshot":
            name = step.get("name")
            if not _nonempty_str(name):
                errors.append(f"{prefix}.name is required for action screenshot")
            elif name in names:
                errors.append(f"{prefix}.name duplicates an earlier screenshot: {name}")
            else:
                names.add(str(name))
            if "fullPage" in step and not isinstance(step["fullPage"], bool):
                errors.append(f"{prefix}.fullPage must be a boolean when present")
        if action == "goto" and not _nonempty_str(step.get("url")):
            errors.append(f"{prefix}.url is required for action goto")
    return errors


def _nonempty_str(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _positive_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _non_negative_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-plan", required=True, metavar="PLAN.json")
    args = parser.parse_args(argv)
    path = Path(args.check_plan)
    if not path.is_file():
        print(json.dumps({"ok": False, "errors": [f"missing plan: {path}"]}))
        return 2
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "errors": [f"invalid JSON: {exc}"]}))
        return 2
    errors = validate_plan(plan)
    print(json.dumps({"ok": not errors, "errors": errors}))
    return 0 if not errors else 2


if __name__ == "__main__":
    raise SystemExit(main())
