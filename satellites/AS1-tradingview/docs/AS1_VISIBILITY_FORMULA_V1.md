# AS1 Visibility Formula V1

Formula identifier: `AS1_VIS_V1`. Rounding mode: `DECIMAL_HALF_UP`. Intermediate values retain full precision.

Quality factors are GOOD 1.00, LIMITED 0.75, WATCH 0.50, INVALID 0.00. Freshness factors are FRESH 1.00, AGING 0.70, STALE 0.25. `NOT_EXPECTED` is excluded from numerator and denominator without penalty.

For each EXPECTED layout with data: `component_score = 100 × quality_factor × freshness_factor`. EXPECTED+MISSING scores zero and remains in the denominator. `base_visibility_raw` is the sum divided by `expected_count`; stored `base_visibility` is HALF_UP to two decimals.

Coherence factors are ALIGNED 1.00, MIXED 0.85, and CONFLICT 0.60. Missing data is not penalized again. With fewer than two comparable valid components, the factor is 1.00 and state is INSUFFICIENT. Final score is `base_visibility_raw × coherence_factor`, HALF_UP to an integer.

If `expected_count == 0`, score and base are null and state is NOT_EXPECTED. Otherwise fewer than two comparable components yields INSUFFICIENT. Remaining integer scores map to NORMAL 75–100, DEGRADED 50–74, and POOR 0–49.

The breakdown stores counts, base, factor, per-layout component scores, and rounding mode so SESHAT can reproduce any result.
