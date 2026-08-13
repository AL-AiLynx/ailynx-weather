# AS1 TradingView Alert → Supabase 전송 계약 v1

## 1. 이 문서의 목적

이 문서는 AiLynx 인공위성 1호(AS1)의 네 레이아웃, 즉 **HORUS A, HORUS B, MAAT, MAAT2**가 TradingView에서 만든 알림을 Supabase로 같은 방식으로 보내기 위한 약속입니다.

쉽게 말해, 레이아웃마다 계산 결과는 달라도 Supabase가 받는 "택배 상자"의 라벨은 같게 만드는 규칙입니다. 공통 상자는 `as1-alert-envelope-v1.json`으로 검사할 수 있습니다.

## 2. 전송 흐름

```text
TradingView 레이아웃의 대표 관측기
  → 확정 봉인지 확인
  → 공통 envelope + 레이아웃 고유 payload 생성
  → TradingView Alert Webhook
  → 수신 API / Supabase Edge Function
  → dedup_key 중복 검사 후 Supabase 저장
```

## 3. 반드시 지킬 전송 규칙

1. **확정 봉만 전송합니다.** Pine에서는 봉이 확정된 조건에서만 알림을 만들어야 하며, 받은 JSON의 `confirmed`는 항상 `true`입니다.
2. **레이아웃당 봉 하나에 최대 패킷 하나입니다.** 같은 레이아웃·종목·시간프레임·봉 마감 시각에 여러 관측기가 있어도 외부로 보내는 대표 패킷은 한 건입니다.
3. **중복은 `dedup_key`로 막습니다.** 네트워크 재시도나 TradingView 재전송이 있어도 Supabase는 같은 키를 한 번만 저장해야 합니다.
4. **비밀값은 보내지 않습니다.** Supabase 키, 서비스 역할 키, Webhook 비밀값, 인증 토큰은 Pine 코드와 Alert JSON에 넣지 않습니다. 수신 API의 안전한 환경 변수에서 관리합니다.
5. **영역을 섞지 않습니다.** AS1은 TradingView 레이아웃의 자체 계산만 전달합니다. AS2 TrendSpider의 구조 계산과 AS3 OpenMarket의 오더북·유동성 Zone은 복제하거나 포함하지 않습니다.

## 4. 공통 envelope 필드

모든 필드는 최상단에 있어야 하며, 모두 필수입니다.

| 필드 | 쉬운 설명 | 예시 |
| --- | --- | --- |
| `schema_version` | 이 JSON 약속의 버전 | `as1-alert-envelope-v1` |
| `satellite_id` | 데이터를 만든 인공위성 | `AS1` |
| `platform` | 원본 플랫폼 | `tradingview` |
| `layout_id` | 네 레이아웃 중 하나 | `horus-a` |
| `observer` | 패킷을 조립한 대표 관측기 이름 | `horus-a-hub` |
| `code_version` | 배포한 Pine 코드 버전 | `1.0.0` |
| `ticker_id` | TradingView의 원본 티커 식별자 | `BINANCE:BTCUSDT` |
| `symbol` | 사람이 읽는 종목명 | `BTCUSDT` |
| `timeframe` | 차트 시간프레임 | `15`, `1H`, `D` |
| `bar_open_time` | 대상 봉이 시작한 UTC 시각 | `2026-07-27T00:00:00Z` |
| `bar_close_time` | 대상 봉이 확정된 UTC 시각 | `2026-07-27T00:15:00Z` |
| `sent_at` | Webhook 메시지를 만든 UTC 시각 | `2026-07-27T00:15:01Z` |
| `packet_type` | 패킷의 의미 | `bar_close_snapshot` |
| `confirmed` | 확정 봉 여부. v1에서는 항상 `true` | `true` |
| `quality` | 계산 상태. 정상은 `normal`, 일부 값 미준비는 `degraded` | `normal` |
| `dedup_key` | 중복 저장을 막는 고유 키 | 아래 규칙 참고 |
| `payload` | 레이아웃 고유 결과만 담는 객체 | 아래 예시 참고 |

시간은 모두 UTC ISO 8601 형식(`Z`로 끝나는 형식)으로 보냅니다. `bar_close_time`은 패킷이 "어느 봉의 결과인지" 판별하는 기준 시각이고, `sent_at`은 실제 발송 시각입니다.

## 5. `dedup_key` 규칙

v1의 키 형식은 아래처럼 고정합니다.

```text
layout_id|ticker_id|timeframe|bar_close_time|schema_version
```

예시:

```text
horus-a|BINANCE:BTCUSDT|15|2026-07-27T00:15:00Z|as1-alert-envelope-v1
```

따라서 `dedup_key`에는 반드시 `layout_id`, `ticker_id`, `timeframe`, `bar_close_time`, `schema_version`의 다섯 값이 모두 들어갑니다. Supabase 테이블에는 이 값을 고유(UNIQUE)로 두고, 이미 존재하면 새 행을 만들지 않도록 처리합니다.

## 6. `payload` 작성법

`payload`에는 그 레이아웃만 아는 계산 결과만 넣습니다. envelope의 공통 필드(`symbol`, `timeframe`, `confirmed` 등)를 다시 넣지 않습니다.

예를 들어 HORUS A는 자신의 gate 상태와 활성 구성 요소를, MAAT2는 자신의 코어 모드와 시간 엔진 상태를 담을 수 있습니다. 정확한 키 이름과 값은 각 레이아웃이 책임지고 관리합니다. `examples/`의 네 JSON 파일이 최소 예시입니다.

`quality`가 `degraded`인 경우에도 envelope은 완전하게 보내고, `payload`에는 실제로 계산된 값만 넣습니다. 누락되거나 알 수 없는 값을 정상값처럼 꾸며 넣지 않습니다.

## 7. Supabase 수신 측 최소 처리

1. 요청 본문을 JSON으로 읽고 Schema v1과 필수 필드를 검사합니다.
2. `schema_version`, `satellite_id`, `platform`, `packet_type`, `confirmed`의 고정값을 확인합니다.
3. `dedup_key` 형식과 구성 요소가 envelope의 실제 값과 같은지 확인합니다.
4. 인증은 수신 API에서 처리합니다. 비밀값은 클라이언트 메시지에 기대지 않습니다.
5. `dedup_key`의 고유 제약을 사용해 저장합니다. 같은 키가 다시 오면 성공 응답을 주되 새 데이터는 추가하지 않는 방식이 안전합니다.

## 8. v1의 범위

이 계약은 AS1의 TradingView 알림 전달 형식만 정의합니다. 매수·매도 실행, 거래소 주문, AS2 TrendSpider 구조 계산, AS3 OpenMarket 오더북 및 유동성 Zone은 v1 범위 밖입니다.
