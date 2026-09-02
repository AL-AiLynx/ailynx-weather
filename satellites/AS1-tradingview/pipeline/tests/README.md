# AS1 pipeline contract tests

Run from the repository root:

```text
python -m pip install -r satellites/AS1-tradingview/pipeline/tests/requirements-test.txt
python satellites/AS1-tradingview/pipeline/tests/validate-v1.3-fixtures.py
python satellites/AS1-tradingview/pipeline/tests/audit-v1.2-known-issues.py
python satellites/AS1-tradingview/pipeline/tests/validate-v1.4-alerts.py
```

The v1.3 validator checks Draft 2020-12 schemas, lossless Raw-to-Normalized inheritance, Fusion provenance, session expectation semantics, contract rollover, and an independent `AS1_VIS_V1` recomputation using `DECIMAL_HALF_UP`. The v1.4 validator covers the additive MAAT/MAAT2 Raw packets, layout/observer/packet matrix, same-bar packet key separation, v1.3 live compatibility, and the ban on prediction or automatic HIT/MISS mutation. The legacy audit passes only when every declared v1.2 defect is detected; expected legacy defects do not make the process fail.
