#!/usr/bin/env python3
"""Independently validate AS1 v1.3 schemas, fixtures, and negative mutations."""
from __future__ import annotations

import copy
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
AGE_TOLERANCE_SECONDS = Decimal("0")

CHECKS = [
    "JSON_SCHEMA_VALIDATION", "PRODUCTION_SCHEMA_TEST_METADATA_ISOLATION",
    "FIXTURE_METADATA_ISOLATION", "RAW_EVENT_ID_SERVER_OWNERSHIP", "RAW_NORMALIZED_INSTRUMENT_PRESERVATION",
    "RAW_NORMALIZED_SESSION_HINT_PRESERVATION", "RAW_NORMALIZED_TIMING_PRESERVATION",
    "RAW_NORMALIZED_BAR_PRESERVATION", "RAW_NORMALIZED_QUALITY_PRESERVATION",
    "RAW_NORMALIZED_PAYLOAD_PRESERVATION", "NORMALIZED_FUSION_PROVENANCE",
    "NORMALIZED_FUSION_EXPECTATION_PROVENANCE", "NORMALIZED_FUSION_RECEIVED_AT_PROVENANCE",
    "FIXTURE_REGISTRY_SCHEMA_VALIDATION", "FIXTURE_SOURCE_PROFILE_RESOLUTION",
    "CANONICAL_REGIME_FROM_REGISTRY", "CONTRACT_LIFECYCLE_CONSISTENCY",
    "SESSION_POLICY_SCHEMA_VALIDATION", "SESSION_EXPECTATION_CONSISTENCY",
    "NOT_EXPECTED_HANDLING", "EXPECTED_MISSING_HANDLING",
    "AGE_SECONDS_RECOMPUTATION", "FRESHNESS_RECOMPUTATION", "DETERMINISTIC_FRESHNESS_RECOMPUTATION",
    "FUSION_STALE_LAYOUT_SET_CONSISTENCY", "FUSION_INVALID_LAYOUT_SET_CONSISTENCY",
    "FUSION_MISSING_LAYOUT_SET_CONSISTENCY", "FUSION_NOT_EXPECTED_LAYOUT_SET_CONSISTENCY",
    "FUSION_FLAG_CONSISTENCY",
    "CLOSED_ALL_LAYOUTS_NOT_EXPECTED", "VISIBILITY_BREAKDOWN_COUNT_RECOMPUTATION",
    "ASYNC_MULTITIMEFRAME_COVERAGE", "ASYNC_BAR_CLOSE_TIME_COVERAGE",
    "VISIBILITY_RECOMPUTATION", "VISIBILITY_ROUNDING",
    "NEGATIVE_MUTATION_AGE_SECONDS", "NEGATIVE_MUTATION_SOURCE_PROFILE",
    "NEGATIVE_MUTATION_CONTRACT", "NEGATIVE_MUTATION_FUSION_PROVENANCE",
    "NEGATIVE_MUTATION_FRESHNESS", "NEGATIVE_MUTATION_FUSION_SUMMARY",
    "NEGATIVE_MUTATION_EXPECTATION_PROVENANCE", "NEGATIVE_MUTATION_RECEIVED_AT_PROVENANCE",
    "NEGATIVE_MUTATION_VISIBILITY_BREAKDOWN",
    "FIXTURE_ID_CONSISTENCY",
]
QUALITY = {"GOOD": Decimal("1"), "LIMITED": Decimal("0.75"), "WATCH": Decimal("0.50"), "INVALID": Decimal("0")}
FRESHNESS = {"FRESH": Decimal("1"), "AGING": Decimal("0.70"), "STALE": Decimal("0.25")}
COHERENCE = {"ALIGNED": Decimal("1"), "MIXED": Decimal("0.85"), "CONFLICT": Decimal("0.60"), "INSUFFICIENT": Decimal("1")}
ALL_LAYOUTS = {"HORUS_A", "HORUS_B", "MAAT", "MAAT2"}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def half_up(value: Decimal, places: int) -> Decimal:
    return value.quantize(Decimal("1").scaleb(-places), rounding=ROUND_HALF_UP)


def recompute_freshness(session_context: dict, assembly_time: int) -> str:
    expectation = session_context["expectation_state"]
    if expectation == "NOT_EXPECTED":
        return "NOT_EXPECTED"
    assert expectation == "EXPECTED", "DETERMINISTIC_FRESHNESS_EXPECTATION_UNKNOWN"
    next_at = session_context["expected_next_observation_at"]
    deadline = session_context["freshness_deadline_at"]
    assert next_at is not None and deadline is not None, "DETERMINISTIC_FRESHNESS_INPUT_INCOMPLETE"
    assert next_at <= deadline, "DETERMINISTIC_FRESHNESS_WINDOW_INVALID"
    if assembly_time < next_at:
        return "FRESH"
    if assembly_time <= deadline:
        return "AGING"
    return "STALE"


def recompute_visibility(fusion: dict) -> dict:
    expected = fusion["expected_layouts"]
    components = {item["layout_id"]: item for item in fusion["component_states"]}
    scores, comparable = {}, 0
    for layout in expected:
        component = components.get(layout)
        if component is None:
            scores[layout] = Decimal("0")
            continue
        assert component["freshness"] != "NOT_EXPECTED"
        scores[layout] = Decimal("100") * QUALITY[component["sensor_quality"]] * FRESHNESS[component["freshness"]]
        comparable += int(component["valid"] and component["sensor_quality"] != "INVALID")
    if not expected:
        return {"base": None, "score": None, "state": "NOT_EXPECTED", "scores": scores}
    base = sum(scores.values(), Decimal("0")) / Decimal(len(expected))
    score = int(half_up(base * COHERENCE[fusion["fusion_status"]], 0))
    state = "INSUFFICIENT" if comparable < 2 else "NORMAL" if score >= 75 else "DEGRADED" if score >= 50 else "POOR"
    return {"base": half_up(base, 2), "score": score, "state": state, "scores": scores}


def validate_fixture(fixture: dict, validators: dict, profiles: dict) -> None:
    fid = fixture["fixture_id"]
    assert isinstance(fid, str) and fid
    raw_events = fixture["raw_events"]
    receipts = fixture["simulated_ingestion"]
    assert len(raw_events) == len(receipts) == len(fixture["normalized_observations"]), f"{fid}: ingestion cardinality"
    raw_by_id = {}
    for receipt in receipts:
        index, server_id = receipt["raw_event_index"], receipt["raw_event_id"]
        assert index < len(raw_events) and server_id not in raw_by_id
        raw_by_id[server_id] = raw_events[index]
    norm_by_id = {row["normalized_observation_id"]: row for row in fixture["normalized_observations"]}
    for raw in raw_events:
        validators["raw"].validate(raw)
        assert "fixture_id" not in raw and "raw_event_id" not in raw
        profile = profiles.get(raw["source_profile_code"])
        assert profile is not None, "UNKNOWN_SOURCE_PROFILE"
        instrument = raw["instrument"]
        comparisons = {
            "ticker_id": "PROFILE_TICKER_MISMATCH", "venue": "PROFILE_VENUE_MISMATCH",
            "asset_class": "PROFILE_ASSET_CLASS_MISMATCH", "instrument_type": "PROFILE_INSTRUMENT_TYPE_MISMATCH",
        }
        for field, error in comparisons.items():
            assert instrument[field] == profile[field], error
        assert instrument["contract"]["contract_type"] == profile["contract"]["contract_type"], "PROFILE_CONTRACT_MISMATCH"
        assert raw["bar"]["volume_unit"] == profile["volume_unit"], "PROFILE_VOLUME_UNIT_MISMATCH"
    for norm in fixture["normalized_observations"]:
        validators["normalized"].validate(norm)
        assert "fixture_id" not in norm
        raw = raw_by_id[norm["raw_event_id"]]
        profile = profiles[norm["source_profile_code"]]
        assert norm["canonical_regime_id"] == profile["canonical_regime_id"]
        for field in ("instrument", "session_hint", "timing", "bar", "quality", "payload"):
            assert raw[field] == norm[field], f"{fid}: raw/normalized {field} changed"
        for field in ("satellite_id", "layout_id", "observer", "code_version", "source_profile_code"):
            assert raw[field] == norm[field], f"{fid}: raw/normalized {field} changed"
    fusion = fixture["fusion_snapshot"]
    validators["fusion"].validate(fusion)
    assert "fixture_id" not in fusion
    assembly = fusion["assembly_time"]
    for component in fusion["component_states"]:
        norm = norm_by_id[component["normalized_observation_id"]]
        expected = {
            "raw_event_id": norm["raw_event_id"], "layout_id": norm["layout_id"],
            "ticker_id": norm["canonical_instrument"]["ticker_id"], "canonical_regime_id": norm["canonical_regime_id"],
            "timeframe": norm["timing"]["timeframe"], "bar_close_time": norm["timing"]["bar_close_time"],
            "received_at": norm["server_evaluation"]["received_at"],
            "expectation_state": norm["session_context"]["expectation_state"],
            "sensor_quality": norm["quality"]["sensor_quality"], "freshness": norm["server_evaluation"]["freshness"],
            "valid": norm["quality"]["valid"], "dedup_key": norm["dedup_key"],
            "contract_id": norm["canonical_instrument"]["contract"]["contract_id"], "series_segment_id": norm["series_segment_id"],
        }
        for key, value in expected.items():
            assert component[key] == value, f"{fid}: provenance mismatch for {key}"
        recomputed_age = Decimal(assembly - norm["timing"]["bar_close_time"]) / Decimal(1000)
        assert recomputed_age >= 0
        assert abs(Decimal(str(norm["server_evaluation"]["age_seconds"])) - recomputed_age) <= AGE_TOLERANCE_SECONDS
        assert abs(Decimal(str(component["age_seconds"])) - recomputed_age) <= AGE_TOLERANCE_SECONDS
        context, freshness = norm["session_context"], norm["server_evaluation"]["freshness"]
        assert freshness == recompute_freshness(context, assembly), f"{fid}: deterministic freshness mismatch"
    components = fusion["component_states"]
    selected = {component["layout_id"] for component in components}
    expected = set(fusion["expected_layouts"])
    recomputed_not_expected = {c["layout_id"] for c in components if c["expectation_state"] == "NOT_EXPECTED"}
    recomputed_stale = {c["layout_id"] for c in components if c["expectation_state"] == "EXPECTED" and c["freshness"] == "STALE"}
    recomputed_invalid = {c["layout_id"] for c in components if not c["valid"] or c["sensor_quality"] == "INVALID"}
    recomputed_missing = expected - selected
    assert set(fusion["not_expected_layouts"]) == recomputed_not_expected
    assert set(fusion["stale_layouts"]) == recomputed_stale
    assert set(fusion["invalid_layouts"]) == recomputed_invalid
    assert set(fusion["missing_layouts"]) == recomputed_missing
    assert expected.isdisjoint(recomputed_not_expected)
    flags = set(fusion["flags"])
    assert ("STALE_COMPONENT_PRESENT" in flags) == bool(recomputed_stale)
    assert ("INVALID_COMPONENT_PRESENT" in flags) == bool(recomputed_invalid)
    assert ("EXPECTED_COMPONENT_MISSING" in flags) == bool(recomputed_missing)
    if fid == "AS1_V13_CLOSED_001":
        assert "SESSION_CLOSED" in flags and not expected
    result, breakdown = recompute_visibility(fusion), fusion["visibility_breakdown"]
    recomputed_counts = {
        "expected_count": len(fusion["expected_layouts"]),
        "not_expected_count": len(fusion["not_expected_layouts"]),
        "fresh_count": sum(c["expectation_state"] == "EXPECTED" and c["freshness"] == "FRESH" for c in components),
        "aging_count": sum(c["expectation_state"] == "EXPECTED" and c["freshness"] == "AGING" for c in components),
        "stale_count": len(fusion["stale_layouts"]),
        "missing_count": len(fusion["missing_layouts"]),
        "invalid_count": len(fusion["invalid_layouts"]),
    }
    for field, value in recomputed_counts.items():
        assert breakdown[field] == value, f"{fid}: visibility breakdown mismatch for {field}"
    assert breakdown["base_visibility"] == (None if result["base"] is None else float(result["base"]))
    assert fusion["visibility_score"] == result["score"] and fusion["visibility_state"] == result["state"]
    assert breakdown["rounding_mode"] == "DECIMAL_HALF_UP"
    for layout, score in result["scores"].items():
        assert Decimal(str(breakdown["component_scores"][layout])) == score
    assert isinstance(fixture["expected_assertions"], dict)
    assert fixture["expected_assertions"]["visibility_score"] == fusion["visibility_score"]
    assert fixture["expected_assertions"]["visibility_state"] == fusion["visibility_state"]
    if fid == "AS1_V13_CLOSED_001":
        assert set(fusion["not_expected_layouts"]) == ALL_LAYOUTS
        assert fusion["expected_layouts"] == [] and fusion["missing_layouts"] == []
        assert fusion["visibility_score"] is None and fusion["visibility_state"] == "NOT_EXPECTED"
    if fid == "AS1_V13_NORMAL_001":
        assert len({n["timing"]["timeframe"] for n in fixture["normalized_observations"]}) >= 3
        assert len({n["timing"]["bar_close_time"] for n in fixture["normalized_observations"]}) >= 2
    if fid == "AS1_V13_ROLL_001":
        norms = fixture["normalized_observations"]
        assert len({n["source_profile_code"] for n in norms}) == 1
        assert {n["instrument"]["contract"]["contract_id"] for n in norms} == {"NQM26", "NQU26"}
        assert len({n["series_segment_id"] for n in norms}) == 2


def mutation_must_fail(fixture: dict, mutate, validators: dict, profiles: dict) -> None:
    candidate = copy.deepcopy(fixture)
    mutate(candidate)
    try:
        validate_fixture(candidate, validators, profiles)
    except (AssertionError, KeyError, jsonschema.ValidationError):
        return
    raise AssertionError("negative mutation was not detected")


def main() -> int:
    common = load(SCHEMA_DIR / "as1-common-types-v1.3.json")
    schemas = {name: load(SCHEMA_DIR / filename) for name, filename in {
        "raw": "as1-alert-envelope-v1.3.json", "normalized": "as1-normalized-observation-v1.3.json",
        "fusion": "as1-fusion-snapshot-v1.3.json"}.items()}
    registry_schema = load(SCHEMA_DIR / "as1-source-profile-registry-v1.3.json")
    ingest_schema = load(SCHEMA_DIR / "as1-ingest-policy-v1.3.json")
    for schema in [common, *schemas.values(), registry_schema, ingest_schema]:
        jsonschema.Draft202012Validator.check_schema(schema)
    for name in ("raw", "normalized", "fusion"):
        assert "fixture_id" not in schemas[name].get("required", [])
        assert "fixture_id" not in schemas[name]["properties"]
    assert "raw_event_id" not in schemas["raw"].get("required", [])
    assert "raw_event_id" not in schemas["raw"]["properties"]
    assert "raw_event_id" in schemas["normalized"].get("required", [])
    assert "raw_event_id" in schemas["normalized"]["properties"]
    store = {common["$id"]: common, "as1-common-types-v1.3.json": common}
    validators = {name: jsonschema.Draft202012Validator(schema, resolver=jsonschema.RefResolver.from_schema(schema, store=store)) for name, schema in schemas.items()}
    registry_validator = jsonschema.Draft202012Validator(registry_schema, resolver=jsonschema.RefResolver.from_schema(registry_schema, store=store))
    registry_validator.validate(load(PIPELINE / "config" / "source-profile-registry-v1.3.json"))
    fixture_registry = load(FIXTURE_DIR / "fixture-source-profile-registry-v1.3.json")
    registry_validator.validate(fixture_registry)
    profiles = {p["source_profile_code"]: p for p in fixture_registry["profiles"]}
    assert set(profiles) >= {"CB_BTCUSD_SPOT_20260722_V1", "OKX_BTCUSDT_PERP_LEGACY_V1", "TEST_EQUITY_SESSION_V1", "CME_NQ_FRONT_MONTH_V1"}
    jsonschema.Draft202012Validator(ingest_schema).validate(load(PIPELINE / "config" / "as1-ingest-policy-v1.3.json"))
    fixtures = [load(path) for path in sorted(FIXTURE_DIR.glob("AS1_V13_*.json"))]
    try:
        fixture_ids = [fixture["fixture_id"] for fixture in fixtures]
        assert len(fixture_ids) == len(set(fixture_ids))
        for fixture in fixtures:
            validate_fixture(fixture, validators, profiles)
        normal = next(f for f in fixtures if f["fixture_id"] == "AS1_V13_NORMAL_001")
        roll = next(f for f in fixtures if f["fixture_id"] == "AS1_V13_ROLL_001")
        mutation_must_fail(normal, lambda f: f["normalized_observations"][0]["server_evaluation"].__setitem__("age_seconds", f["normalized_observations"][0]["server_evaluation"]["age_seconds"] + 300), validators, profiles)
        mutation_must_fail(normal, lambda f: f["raw_events"][0].__setitem__("source_profile_code", "UNKNOWN_PROFILE"), validators, profiles)
        mutation_must_fail(normal, lambda f: f["normalized_observations"][0]["instrument"]["contract"].pop("contract_id"), validators, profiles)
        mutation_must_fail(normal, lambda f: f["fusion_snapshot"]["component_states"][0].__setitem__("timeframe", "999"), validators, profiles)
        def mutate_freshness(f):
            f["normalized_observations"][0]["server_evaluation"]["freshness"] = "AGING"
            f["fusion_snapshot"]["component_states"][0]["freshness"] = "AGING"
        mutation_must_fail(roll, mutate_freshness, validators, profiles)
        mutation_must_fail(roll, lambda f: f["fusion_snapshot"].__setitem__("stale_layouts", []), validators, profiles)
        mutation_must_fail(normal, lambda f: f["fusion_snapshot"]["component_states"][0].__setitem__("expectation_state", "NOT_EXPECTED"), validators, profiles)
        mutation_must_fail(normal, lambda f: f["fusion_snapshot"]["component_states"][0].__setitem__("received_at", f["fusion_snapshot"]["component_states"][0]["received_at"] + 1), validators, profiles)
        mutation_must_fail(roll, lambda f: f["fusion_snapshot"]["visibility_breakdown"].__setitem__("stale_count", f["fusion_snapshot"]["visibility_breakdown"]["stale_count"] + 1), validators, profiles)
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
