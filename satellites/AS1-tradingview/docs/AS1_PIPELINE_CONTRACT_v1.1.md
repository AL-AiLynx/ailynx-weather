# AS1 TradingView Alert → Supabase 전송 계약 v1.1

## 목적

v1.1은 HORUS A/B, MAAT, MAAT2가 TradingView에서 보낸 확정 봉 관측을 Supabase에 안전하게 저장하기 위한 약속입니다. v1은 보존하고, 새 수신기는 v1.1을 사용합니다. 이 문서의 숫자는 예시이며 실제 시세가 아닙니다.

## 운영 기준과 관측 체제

현재 운영 기준은 `COINBASE:BTCUSD`이며 다음 체제를 사용합니다.

```text
ticker_id: COINBASE:BTCUSD
venue: COINBASE
symbol: BTCUSD
base_asset: BTC
quote_asset: USD
source_regime_id: coinbase-btcusd-from-2026-07-22
```

과거 Binance 체제는 `binance-btcusdt-until-2026-07-21`처럼 별도 값으로 남깁니다. 같은 테이블에는 저장할 수 있지만, 가격·수익률·예측·실제 검증은 `ticker_id`와 `source_regime_id`가 모두 같을 때만 비교합니다. `source_regime_id`는 자동 추론하지 않는 운영 관리 설정값입니다. 나중 Pine에서는 ticker/venue/symbol은 `syminfo` 계열 값으로 만들 수 있지만 체제 ID는 설정값으로 유지합니다.

## Sensor envelope 구조

레이아웃 한 개는 최상단에 `schema_version`, `satellite_id`, `platform`, `layout_id`, `observer`, `code_version`, `instrument`, `timing`, `bar`, `packet_type`, `confirmed`, `quality`, `dedup_key`, `payload`를 보냅니다.

- `instrument`는 어느 거래소·자산·관측 체제인지 말합니다.
- `timing.timeframe`은 Alert가 나온 차트 시간프레임입니다.
- `bar_open_time`, `bar_close_time`, `sent_at`은 모두 Unix millisecond입니다.
- `bar`의 OHLC는 SESHAT의 HIT/PARTIAL/MISS 사후 검증에 필수입니다. volume은 숫자 또는 null이고 null이면 `MISSING_VOLUME` flag를 넣습니다. 현재 예제 volume unit은 사실을 과장하지 않는 `RAW_EXCHANGE_VOLUME`입니다.
- `payload`에는 레이아웃 고유 계산만 넣습니다.

확정 봉만 보내며 `confirmed`는 항상 true입니다. 레이아웃마다 확정 봉 하나에 최대 하나의 packet만 보냅니다.

## 시간과 비동기 조립

각 레이아웃은 다른 timeframe으로 확정될 수 있습니다. 그래서 서버는 모든 레이아웃의 `bar_close_time`을 억지로 같게 만들지 않습니다. `assembly_time` 이전에 이미 받은 각 레이아웃의 가장 최신 confirmed packet을 선택하고, `age_seconds`를 계산합니다. 각 레이아웃은 허용 시간 기준에 따라 FRESH, AGING, STALE이 됩니다.

차트 `timing.timeframe`은 MAAT/MAAT2의 주인공 시간축이 아닙니다. `protagonist_tf_minutes`, `previous_protagonist_tf_minutes`, `parent_tf_minutes`, `candidate_pack_minutes`, `window_state`, `expected_window_close_time` 같은 값은 MAAT/MAAT2 payload에만 둡니다.

## 품질과 fusion 상태

센서의 `quality`는 한 레이아웃의 상태입니다.

- `sensor_quality`: GOOD, LIMITED, WATCH, INVALID
- `freshness`: FRESH, AGING, STALE
- `valid`: 센서가 유효 데이터를 만들었는지
- `flags`: MISSING_VOLUME, PARTIAL_SOURCE, TIMING_DELAY처럼 이유를 적는 목록

`INVALID`은 데이터 자체가 유효하지 않다는 뜻입니다. `STALE`은 유효하지만 조립 시점에 오래됐다는 뜻입니다. `CONFLICT`는 여러 유효 센서가 서로 다른 상태를 보고한다는 뜻입니다. 그래서 CONFLICT는 센서가 아니라 서버 fusion 결과에 둡니다.

Fusion은 `ALIGNED`, `MIXED`, `CONFLICT`, `INSUFFICIENT` 중 하나이며 visibility score, stale/conflicting/missing layout, component별 age를 함께 보관합니다.

## dedup key

v1.1의 dedup key는 아래 일곱 값을 순서대로 넣습니다.

```text
satellite_id|layout_id|ticker_id|source_regime_id|timeframe|bar_close_time|schema_version
```

예시:

```text
AS1|HORUS_A|COINBASE:BTCUSD|coinbase-btcusd-from-2026-07-22|60|1785148800000|as1.v1.1
```

Supabase raw 테이블은 이 키를 UNIQUE로 처리합니다. 재전송은 성공으로 응답하되 새 행을 만들지 않습니다.

## SESHAT 검증과 데이터 흐름

SESHAT은 envelope의 OHLCV와 관측 체제가 같은 데이터만 사용해 HIT/PARTIAL/MISS를 검증합니다. 체제가 다른 가격을 이어 붙이지 않습니다.

```text
TradingView Alert → Edge Function → Raw 저장 → Normalized 저장 → Latest 선택 → Fusion 생성
```

TradingView는 sensor envelope만 보냅니다. Edge Function은 `received_at`을, 조립기 또는 fusion 함수는 `assembly_time`과 `age_seconds`를 만듭니다. fusion snapshot은 TradingView Alert가 아닙니다.

## v1과 v1.1의 차이

v1은 평면 필드 중심의 최초 envelope입니다. v1.1은 instrument/timing/bar/quality 객체를 추가하고, Coinbase 운영 체제와 source regime을 명시하며, OHLCV·비동기 조립·sensor quality와 fusion 상태를 분리합니다. v1은 삭제하지 않습니다.

## 보안 및 현재 범위

Supabase 키, Webhook URL, 비밀번호, service role key는 Alert JSON이나 이 문서에 넣지 않습니다. 이번 개정은 Pine Exporter를 작성하지 않으며 실제 Alert 또는 Supabase 전송도 만들지 않습니다.
