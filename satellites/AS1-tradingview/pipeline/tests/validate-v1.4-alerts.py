#!/usr/bin/env python3
"""Validate additive AS1 v1.4 MAAT/MAAT2 alert contracts."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema


TEST_DIR = Path(__file__).resolve().parent
PIPELINE = TEST_DIR.parent
SCHEMA_DIR = PIPELINE / "schema"
EXAMPLE_DIR = PIPELINE / "examples"

EXAMPLES = (
    "maat-validation-envelope-v1.4.json",
    "maat2-hub-state-envelope-v1.4.json",
    "maat2-time-engine-envelope-v1.4.json",
)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def expected_key(event: dict) -> str:
    return "|".join(
        (
            event["satellite_id"],
            event["layout_id"],
            event["packet_type"],
            event["instrument"]["ticker_id"],
            event["timing"]["timeframe"],
            str(event["timing"]["bar_close_time"]),
            event["schema_version"],
        )
    )


def must_fail(validator, event: dict, mutate) -> None:
    candidate = copy.deepcopy(event)
    mutate(candidate)
    try:
        validator.validate(candidate)
    except jsonschema.ValidationError:
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main() -> int:
    common = load(SCHEMA_DIR / "as1-common-types-v1.3.json")
    alert_schema = load(SCHEMA_DIR / "as1-alert-envelope-v1.4.json")
    policy_schema = load(SCHEMA_DIR / "as1-ingest-policy-v1.4.json")

    for schema in (common, alert_schema, policy_schema):
        jsonschema.Draft202012Validator.check_schema(schema)

    store = {
        common["$id"]: common,
        "as1-common-types-v1.3.json": common,
    }
    validator = jsonschema.Draft202012Validator(
        alert_schema,
        resolver=jsonschema.RefResolver.from_schema(alert_schema, store=store),
    )

    events = [load(EXAMPLE_DIR / name) for name in EXAMPLES]
    for event in events:
        validator.validate(event)
        assert event["client_event_key"] == expected_key(event)

    keys = {event["client_event_key"] for event in events}
    assert len(keys) == len(events), "packet_type must keep same-bar keys distinct"

    maat, hub, time = events
    assert maat["packet_type"] == "VALIDATION_SNAPSHOT"
    assert hub["packet_type"] == "HUB_STATE_SNAPSHOT"
    assert time["packet_type"] == "TIME_ENGINE_SNAPSHOT"
    assert hub["timing"]["bar_close_time"] == time["timing"]["bar_close_time"]
    assert hub["client_event_key"] != time["client_event_key"]

    must_fail(validator, hub, lambda e: e.__setitem__("observer", "MAAT2_TIME"))
    must_fail(validator, hub, lambda e: e.__setitem__("packet_type", "TIME_ENGINE_SNAPSHOT"))
    must_fail(validator, time, lambda e: e["payload"].__setitem__("prediction_direction", "UP"))
    must_fail(validator, time, lambda e: e["payload"].__setitem__("hit_miss", "HIT"))
    must_fail(validator, maat, lambda e: e["payload"].__setitem__("automatic_hit_miss", "HIT"))

    bad_key = copy.deepcopy(hub)
    bad_key["client_event_key"] = time["client_event_key"]
    validator.validate(bad_key)
    assert bad_key["client_event_key"] != expected_key(bad_key), "ingest key reconstruction must reject cross-packet keys"

    policy = load(PIPELINE / "config" / "as1-ingest-policy-v1.4.json")
    jsonschema.Draft202012Validator(policy_schema).validate(policy)
    assert policy["accepted_live_raw_schema_versions"] == ["as1.v1.3", "as1.v1.4"]

    print("AS1_V1_4_SCHEMA_VALIDATION = PASS")
    print("AS1_V1_4_LAYOUT_OBSERVER_PACKET_MATRIX = PASS")
    print("AS1_V1_4_PACKET_KEY_SEPARATION = PASS")
    print("AS1_V1_4_NO_PREDICTION_OR_AUTO_HIT_MISS = PASS")
    print("AS1_V1_3_ADDITIVE_COMPATIBILITY = PASS")
    print(f"EXAMPLES_VALIDATED = {len(events)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
