#!/usr/bin/env python3
"""Confirm that the immutable v1.2 baseline still exposes its documented defects."""
from __future__ import annotations

import json
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent
PIPELINE = TEST_DIR.parent


def load(relative: str):
    return json.loads((PIPELINE / relative).read_text(encoding="utf-8"))


def main() -> int:
    expected = load("tests/legacy/v1.2/known-issues-v1.2.json")["expected_known_issues"]
    normalized = load("schema/as1-normalized-observation-v1.2.json")
    fusion = load("schema/as1-fusion-snapshot-v1.2.json")
    fusion_sample = load("examples/fusion-snapshot-sample-v1.2.json")
    registry_schema = load("schema/as1-source-profile-registry-v1.2.json")
    registry = load("config/source-profile-registry-v1.2.json")
    nprops = normalized["properties"]
    fprops = fusion["properties"]
    profile_props = registry_schema["$defs"]["profile"]["properties"]
    detected = {
        "NORMALIZED_STRUCTURE_TOO_LOOSE": all(nprops[name] == {"type": "object"} for name in ("instrument", "timing", "bar", "quality")),
        "NORMALIZED_CONTRACT_NOT_GUARANTEED": "contract" not in nprops["instrument"].get("required", []),
        "FUSION_SAMPLE_COMPONENT_MISMATCH": len(fusion_sample["component_states"]) != 4,
        "FUSION_FLAGS_FIELD_MISSING": "flags" not in fprops,
        "VISIBILITY_FORMULA_UNDEFINED": "visibility_formula_version" not in fprops and "visibility_breakdown" not in fprops,
        "FRESHNESS_NOT_SESSION_AWARE": "NOT_EXPECTED" not in fprops["component_states"]["items"]["properties"]["freshness"]["enum"],
        "MINIMUM_SCHEMA_VERSION_COUPLED_TO_PROFILE": "minimum_schema_version" in profile_props and all("minimum_schema_version" in p for p in registry["profiles"]),
        "PROFILE_STATUS_AND_IS_ACTIVE_DUPLICATED": "profile_status" in profile_props and "is_active" in profile_props and all("profile_status" in p and "is_active" in p for p in registry["profiles"]),
    }
    ok = True
    for issue in expected:
        state = "DETECTED" if detected.get(issue, False) else "NOT_DETECTED"
        print(f"{issue:<46} {state}")
        ok &= detected.get(issue, False)
    print(f"LEGACY_V1_2_REGRESSION_AUDIT = {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
