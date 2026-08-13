#!/usr/bin/env python3
"""Validate AS1 v1.3 schemas and cross-layer fixture invariants."""
from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

try:
    import jsonschema
except ImportError:
    print("BLOCKED_DEPENDENCY: install requirements-test.txt", file=sys.stderr)
    raise SystemExit(2)

TEST_DIR = Path(__file__).resolve().parent
PIPELINE = TEST_DIR.parent
SCHEMA_DIR = PIPELINE / "schema"
FIXTURE_DIR = TEST_DIR / "fixtures" / "v1.3"

CHECKS = [
    "JSON_SCHEMA_VALIDATION", "RAW_NORMALIZED_INSTRUMENT_PRESERVATION",
    "RAW_NORMALIZED_SESSION_HINT_PRESERVATION", "RAW_NORMALIZED_TIMING_PRESERVATION",
    "RAW_NORMALIZED_BAR_PRESERVATION", "RAW_NORMALIZED_QUALITY_PRESERVATION",
    "RAW_NORMALIZED_PAYLOAD_PRESERVATION", "NORMALIZED_FUSION_PROVENANCE",
    "CONTRACT_LIFECYCLE_CONSISTENCY", "REGIME_CONSISTENCY",
    "SESSION_EXPECTATION_CONSISTENCY", "NOT_EXPECTED_HANDLING",
    "EXPECTED_MISSING_HANDLING", "VISIBILITY_RECOMPUTATION",
    "VISIBILITY_ROUNDING", "FIXTURE_ID_CONSISTENCY",
]
QUALITY = {"GOOD": Decimal("1"), "LIMITED": Decimal("0.75"), "WATCH": Decimal("0.50"), "INVALID": Decimal("0")}
FRESHNESS = {"FRESH": Decimal("1"), "AGING": Decimal("0.70"), "STALE": Decimal("0.25")}
COHERENCE = {"ALIGNED": Decimal("1"), "MIXED": Decimal("0.85"), "CONFLICT": Decimal("0.60"), "INSUFFICIENT": Decimal("1")}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def half_up(value: Decimal, places: int) -> Decimal:
    quantum = Decimal("1").scaleb(-places)
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


def recompute(fusion: dict) -> dict:
    expected = fusion["expected_layouts"]
    components = {item["layout_id"]: item for item in fusion["component_states"]}
    scores = {}
    comparable = 0
    for layout in expected:
        component = components.get(layout)
        if component is None:
            scores[layout] = Decimal("0")
            continue
        if component["freshness"] == "NOT_EXPECTED":
            raise AssertionError(f"{layout}: NOT_EXPECTED component listed as EXPECTED")
        scores[layout] = Decimal("100") * QUALITY[component["sensor_quality"]] * FRESHNESS[component["freshness"]]
        if component["valid"] and component["sensor_quality"] != "INVALID":
            comparable += 1
    if not expected:
        return {"expected_count": 0, "missing_count": 0, "base_visibility": None,
                "coherence_factor": Decimal("1"), "visibility_score": None,
                "visibility_state": "NOT_EXPECTED", "scores": scores, "comparable": comparable}
    raw_base = sum(scores.values(), Decimal("0")) / Decimal(len(expected))
    factor = COHERENCE[fusion["fusion_status"]]
    final = raw_base * factor
    score = int(half_up(final, 0))
    if comparable < 2:
        state = "INSUFFICIENT"
    elif score >= 75:
        state = "NORMAL"
    elif score >= 50:
        state = "DEGRADED"
    else:
        state = "POOR"
    return {"expected_count": len(expected), "missing_count": len(fusion["missing_layouts"]),
            "base_visibility": half_up(raw_base, 2), "coherence_factor": factor,
            "visibility_score": score, "visibility_state": state, "scores": scores,
            "comparable": comparable}


def validate_fixture(path: Path, validators: dict[str, jsonschema.Draft202012Validator]) -> None:
    fixture = load(path)
    fid = fixture["fixture_id"]
    raw_by_id = {row["raw_event_id"]: row for row in fixture["raw_events"]}
    norm_by_id = {row["normalized_observation_id"]: row for row in fixture["normalized_observations"]}
    for raw in fixture["raw_events"]:
        validators["raw"].validate(raw)
        assert raw["fixture_id"] == fid
    for norm in fixture["normalized_observations"]:
        validators["normalized"].validate(norm)
        assert norm["fixture_id"] == fid
        raw = raw_by_id[norm["raw_event_id"]]
        for field in ("instrument", "session_hint", "timing", "bar", "quality", "payload"):
            assert raw[field] == norm[field], f"{fid}: raw/normalized {field} changed"
        for field in ("satellite_id", "layout_id", "observer", "code_version", "source_profile_code"):
            assert raw[field] == norm[field], f"{fid}: raw/normalized {field} changed"
        expectation = norm["session_context"]["expectation_state"]
        freshness = norm["server_evaluation"]["freshness"]
        assert (expectation == "NOT_EXPECTED") == (freshness == "NOT_EXPECTED")
    fusion = fixture["fusion_snapshot"]
    validators["fusion"].validate(fusion)
    assert fusion["fixture_id"] == fid
    for component in fusion["component_states"]:
        norm = norm_by_id[component["normalized_observation_id"]]
        assert component["raw_event_id"] == norm["raw_event_id"]
        expected_pairs = {
            "layout_id": norm["layout_id"], "ticker_id": norm["canonical_instrument"]["ticker_id"],
            "canonical_regime_id": norm["canonical_regime_id"], "timeframe": norm["timing"]["timeframe"],
            "bar_close_time": norm["timing"]["bar_close_time"], "sensor_quality": norm["quality"]["sensor_quality"],
            "freshness": norm["server_evaluation"]["freshness"], "valid": norm["quality"]["valid"],
            "dedup_key": norm["dedup_key"], "contract_id": norm["canonical_instrument"]["contract"]["contract_id"],
            "series_segment_id": norm["series_segment_id"],
        }
        for key, value in expected_pairs.items():
            assert component[key] == value, f"{fid}: provenance mismatch for {key}"
    regimes = {c["canonical_regime_id"] for c in fusion["component_states"]}
    if len(regimes) > 1:
        assert "REGIME_MIXED_COMPONENTS" in fusion["flags"]
    assert set(fusion["expected_layouts"]).isdisjoint(fusion["not_expected_layouts"])
    assert set(fusion["missing_layouts"]) <= set(fusion["expected_layouts"])
    if fusion["missing_layouts"]:
        assert "EXPECTED_COMPONENT_MISSING" in fusion["flags"]
    result = recompute(fusion)
    breakdown = fusion["visibility_breakdown"]
    assert breakdown["expected_count"] == result["expected_count"]
    assert breakdown["missing_count"] == result["missing_count"]
    assert breakdown["base_visibility"] == (None if result["base_visibility"] is None else float(result["base_visibility"]))
    assert Decimal(str(breakdown["coherence_factor"])) == result["coherence_factor"]
    assert fusion["visibility_score"] == result["visibility_score"]
    assert fusion["visibility_state"] == result["visibility_state"]
    assert breakdown["rounding_mode"] == "DECIMAL_HALF_UP"
    for layout, score in result["scores"].items():
        assert Decimal(str(breakdown["component_scores"][layout])) == score
    assert fixture["expected_assertions"]["visibility_score"] == fusion["visibility_score"]
    assert fixture["expected_assertions"]["visibility_state"] == fusion["visibility_state"]
    if fid == "AS1_V13_CLOSED_001":
        assert not fusion["expected_layouts"] and fusion["visibility_score"] is None
    if fid == "AS1_V13_MISSING_001":
        assert breakdown["component_scores"][fusion["missing_layouts"][0]] == 0
    if fid == "AS1_V13_ROLL_001":
        profiles = {n["source_profile_code"] for n in fixture["normalized_observations"]}
        contracts = {n["instrument"]["contract"]["contract_id"] for n in fixture["normalized_observations"]}
        segments = {n["series_segment_id"] for n in fixture["normalized_observations"]}
        assert len(profiles) == 1 and contracts == {"NQM26", "NQU26"} and len(segments) == 2
        assert all(n["instrument"]["contract"]["series_symbol"] == "NQ1!" for n in fixture["normalized_observations"])


def main() -> int:
    common = load(SCHEMA_DIR / "as1-common-types-v1.3.json")
    schemas = {
        "raw": load(SCHEMA_DIR / "as1-alert-envelope-v1.3.json"),
        "normalized": load(SCHEMA_DIR / "as1-normalized-observation-v1.3.json"),
        "fusion": load(SCHEMA_DIR / "as1-fusion-snapshot-v1.3.json"),
    }
    registry_schema = load(SCHEMA_DIR / "as1-source-profile-registry-v1.3.json")
    ingest_schema = load(SCHEMA_DIR / "as1-ingest-policy-v1.3.json")
    for schema in [common, *schemas.values(), registry_schema, ingest_schema]:
        jsonschema.Draft202012Validator.check_schema(schema)
    store = {common["$id"]: common, "as1-common-types-v1.3.json": common}
    validators = {name: jsonschema.Draft202012Validator(schema, resolver=jsonschema.RefResolver.from_schema(schema, store=store)) for name, schema in schemas.items()}
    jsonschema.Draft202012Validator(registry_schema, resolver=jsonschema.RefResolver.from_schema(registry_schema, store=store)).validate(load(PIPELINE / "config" / "source-profile-registry-v1.3.json"))
    jsonschema.Draft202012Validator(ingest_schema).validate(load(PIPELINE / "config" / "as1-ingest-policy-v1.3.json"))
    fixtures = sorted(FIXTURE_DIR.glob("*.json"))
    assert {p.stem for p in fixtures} == {"AS1_V13_NORMAL_001", "AS1_V13_CLOSED_001", "AS1_V13_MISSING_001", "AS1_V13_ROLL_001"}
    try:
        for fixture in fixtures:
            validate_fixture(fixture, validators)
    except Exception as exc:
        print(f"V1_3_FIXTURE_VALIDATION = FAIL: {exc}", file=sys.stderr)
        return 1
    for check in CHECKS:
        print(f"{check} = PASS")
    print(f"FIXTURES_VALIDATED = {len(fixtures)}")
    print("V1_3_FIXTURE_VALIDATION = PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
