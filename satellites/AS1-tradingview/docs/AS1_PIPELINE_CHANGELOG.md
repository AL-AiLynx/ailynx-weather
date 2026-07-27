# AS1 Pipeline Changelog

## as1.v1.1 — 2026-07-27

### 개정 이유

운영 기준 종목이 2026-07-22부터 `COINBASE:BTCUSD`로 바뀌었습니다. 과거 `BINANCE:BTCUSDT`와 가격 체제·호가 자산이 다르므로, 하나의 연속 가격처럼 자동 비교하면 안 됩니다. 또한 SESHAT 사후 검증에는 봉의 OHLCV가 필요하고, 서로 다른 레이아웃 시간프레임을 같은 봉 마감 시각으로 억지로 맞추면 안 됩니다.

### 추가된 필드

- `instrument`: `ticker_id`, `venue`, `symbol`, `base_asset`, `quote_asset`, `source_regime_id`
- `timing`: `timeframe`, `bar_open_time`, `bar_close_time`, `sent_at`
- `bar`: `open`, `high`, `low`, `close`, `volume`, `volume_unit`
- `quality`: `sensor_quality`, `freshness`, `valid`, `flags`
- fusion 결과: `fusion_status`, `visibility_score`, stale/conflicting/missing layout 목록과 component age

### 변경된 규칙

- dedup key는 `satellite_id|layout_id|ticker_id|source_regime_id|timeframe|bar_close_time|schema_version`이 되었습니다.
- 차트 `timing.timeframe`과 MAAT/MAAT2의 주인공 시간축은 분리했습니다. 주인공 시간축은 payload에만 둡니다.
- 센서 품질(INVALID 포함), 신선도(STALE 포함), 레이아웃 간 충돌(CONFLICT)은 서로 다른 상태입니다.
- `volume`은 숫자 또는 `null`을 허용합니다. `null`이면 `MISSING_VOLUME` flag가 필요합니다.

### 호환성 주의

v1 Schema와 예제는 삭제·변경하지 않았습니다. v1.1은 다른 필드 구조와 고정 literal을 사용하므로 v1 수신기와 혼용하지 마세요. 수신 API는 `schema_version`으로 분기해야 합니다. 서로 다른 `source_regime_id`의 가격을 자동 연결하거나 직접 비교하지 않습니다.

### 현재 구현 상태

이번 개정은 문서, Schema, 매핑, 예제만 만듭니다. 실제 Pine Alert와 Supabase 전송은 아직 생성하거나 연결하지 않았습니다.

## as1.v1 — 최초 계약

최초 공통 envelope 계약입니다. 과거 기록으로 보존하며, v1.1 전환 전 비교 기준으로 사용합니다.
