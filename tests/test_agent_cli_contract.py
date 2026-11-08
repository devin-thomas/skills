"""Static regression checks for the public agent-cli delegation contract.

Run: python3 -m unittest discover -s tests -p 'test_agent_cli_contract.py'
"""

import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "agent-cli"


def read(path: str) -> str:
    return (SKILL / path).read_text(encoding="utf-8")


def flat(text: str) -> str:
    return " ".join(text.split()).lower()


class FailClosedModelSelectionTests(unittest.TestCase):
    def test_requested_model_is_explicit_and_never_substituted(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("model selection **fails closed**", skill)
        self.assertIn("pass a requested model and effort explicitly", skill)
        self.assertIn("never map it to an assumed older version", skill)
        self.assertIn("ends that attempt as `blocked`", skill)
        self.assertIn("another model or effort is a new attempt", skill)

    def test_transport_failure_is_not_model_rejection(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("a transport failure does not establish model unavailability", skill)
        self.assertIn("do not silently switch providers, models, credentials, or paid access", skill)


class SinglePromptSubmissionTests(unittest.TestCase):
    def test_one_transport_and_one_accepted_turn(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("exactly one of argv, stdin, or the terminal ui", skill)
        self.assertIn("confirm exactly one accepted user turn", skill)
        self.assertIn("slow startup is not a reason to submit it again", skill)
        self.assertIn("avoid launching duplicates", skill)

    def test_provider_references_keep_one_submission(self):
        codex = flat(read("references/codex.md"))
        self.assertIn("leave the editor untouched", codex)
        antigravity = flat(read("references/antigravity.md"))
        self.assertIn("do not combine argv prompt and stdin", antigravity)
        control = flat(read("references/process-control.md"))
        self.assertIn("evidence that it will not duplicate an active turn", control)


class StartupVersusCompletionTests(unittest.TestCase):
    def test_outcome_vocabulary_separates_startup_from_completion(self):
        skill = read("SKILL.md")
        for outcome in ("completed", "handed-off", "ready", "startup-pending",
                        "recovered", "blocked", "failed"):
            self.assertRegex(skill, r"\| `" + re.escape(outcome) + r"` \|")
        self.assertIn(
            "never `completed` or `handed-off`", flat(skill)
        )

    def test_pending_startup_keeps_the_session(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("report `startup-pending` when the observation window expires", skill)
        self.assertIn("must not terminate an already accepted persistent session", skill)


class ParentOnlyPermissionTests(unittest.TestCase):
    def test_child_does_not_inherit_parent_tools(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("a child does not inherit parent-only connectors, logins, or approvals", skill)
        self.assertIn("assign any such step to the parent before launching", skill)
        self.assertIn("grant the child only the tools the task needs", skill)

    def test_permissions_are_not_widened_as_a_repair(self):
        self.assertIn("bypass, force, trust, and auto-approve options are never a repair", flat(read("SKILL.md")))
        self.assertIn("do not weaken permissions to repair authentication or quota", flat(read("references/cursor.md")))
        self.assertIn("claude.ai connectors stay with the parent", flat(read("references/claude.md")))
        self.assertIn("a parent-only deployment connector stays with the parent", flat(read("references/coding-artifacts.md")))


class SavedEvidenceRecoveryTests(unittest.TestCase):
    def test_recovery_runs_no_new_generation(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("saved-evidence recovery", skill)
        self.assertIn("live preflight and another generation are unnecessary", skill)
        verification = flat(read("references/verification.md"))
        self.assertIn("keep original evidence files and metadata unchanged", verification)
        self.assertIn("a newly computed hash alone does not prove historical integrity", verification)
        self.assertIn("recovery itself does not launch a worker", verification)
        self.assertIn("claim content recovery and current content checks", verification)


class NoUnauthorizedPaidFallbackTests(unittest.TestCase):
    def test_billing_route_is_preserved(self):
        skill = flat(read("SKILL.md"))
        self.assertIn("**no paid fallback:**", skill)
        self.assertIn("is not authorization to switch routes", skill)
        self.assertIn("check the child environment for credential variables", skill)

    def test_provider_specific_route_switches_are_named(self):
        claude = flat(read("references/claude.md"))
        self.assertIn("in print mode an api key present in the environment is always used", claude)
        self.assertIn("remove from the child's copy any higher-ranked variable", claude)
        self.assertIn("not authorization to move the run to api billing", flat(read("references/antigravity.md")))
        self.assertIn("enabling extra spending needs its own authorization", flat(read("references/cursor.md")))


class PortabilityTests(unittest.TestCase):
    OWNER_MARKERS = re.compile(
        r"titan|uppercut|devin|gohan|holding bay|\.ts\.net\b|"
        r"uppercut\.env|CLAUDE_OAUTH_TOKEN|C:[/\\]dev|~/scratch|/Users/|"
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\bssh (research|command)\b",
        re.IGNORECASE,
    )

    def test_no_owner_specific_setup(self):
        for path in sorted(SKILL.rglob("*")):
            if path.is_file():
                text = path.read_text(encoding="utf-8")
                match = self.OWNER_MARKERS.search(text)
                self.assertIsNone(match, f"{path.relative_to(ROOT)}: {match and match.group(0)}")

    def test_wrapper_extension_cannot_relax_contract(self):
        self.assertIn("never relaxes the evidence or authority rules", flat(read("SKILL.md")))


class DeclarationTests(unittest.TestCase):
    def test_declaration_pins_and_stages_match_files(self):
        declaration = json.loads(read("dvn.json"))

        def blob(path: str) -> str:
            return subprocess.check_output(
                ["git", "hash-object", str(SKILL / path)], text=True
            ).strip()

        self.assertEqual(declaration["skillName"], "agent-cli")
        self.assertEqual(declaration["skillBlobSha"], blob("SKILL.md"))
        keys = set()
        for resource in declaration["resources"]:
            keys.add(resource["key"])
            self.assertEqual(resource["gitBlobSha"], blob(resource["path"]), resource["path"])
            self.assertIn(f"({resource['path']})", read("SKILL.md"), resource["path"])
        self.assertEqual({stage["key"] for stage in declaration["stages"]}, keys)
        for stage in declaration["stages"]:
            self.assertEqual(stage["resources"], [stage["key"]])
        self.assertEqual(declaration["dependencies"], [])


if __name__ == "__main__":
    unittest.main()
