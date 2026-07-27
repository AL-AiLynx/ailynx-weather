# AS1 TradingView → Supabase Pipeline

현재 활성 전송 계약은 **as1.v1.1**입니다. v1 파일은 과거 기록과 비교를 위해 그대로 보존합니다. v1.1을 사용하기 전에 새 Schema와 예제를 기준으로 수신 API를 준비해야 합니다.

## 현재 상태

- Pine Alert Exporter는 아직 수정하거나 새로 만들지 않았습니다.
- Supabase, Webhook URL, 인증 키는 이 저장소의 예제와 문서에 넣지 않습니다.
- 현재 운영 관측 체제는 `COINBASE:BTCUSD`이며 `source_regime_id`는 `coinbase-btcusd-from-2026-07-22`입니다.
- 과거 Binance 체제(`BINANCE:BTCUSDT`)는 별도의 `source_regime_id`로 보존합니다. 서로 다른 체제의 가격을 자동 연결하거나 직접 비교하지 않습니다.
- Pine 원본(`archive`, `current`)은 이번 개정에서 수정하지 않았습니다.

## v1.1에서 달라진 점

센서가 보내는 envelope에는 다음 객체가 새로 들어갑니다.

- `instrument`: 거래소, 종목, 기준/호가 자산, 관측 체제
- `timing`: 차트 시간프레임과 봉 시작·마감·발송 시각
- `bar`: SESHAT 사후 검증에 필요한 OHLCV
- `quality`: 센서 자체의 품질, 신선도, 유효성, 경고 표지

`sensor envelope`은 TradingView 레이아웃 한 개가 보내는 원본 관측입니다. `fusion snapshot`은 서버가 여러 레이아웃의 가장 최근 확정 봉을 모아 만든 결과입니다. 둘은 같은 JSON이 아니며, fusion은 TradingView Alert로 보내지 않습니다.

## 파일 안내

- `schema/as1-alert-envelope-v1.1.json`: 레이아웃 한 개가 보내는 v1.1 sensor envelope Schema
- `schema/as1-fusion-snapshot-v1.1.json`: Supabase/기상청 조립기가 만드는 fusion 결과 Schema
- `examples/*-sample-v1.1.json`: 설명용 숫자를 쓴 v1.1 예제
- `examples/horus-a-live-envelope-draft-v1.1.json`: 현재 HORUS A 감사에서 확인한 값 중심의 연결 초안
- `mappings/horus-a-field-map-v1.1.json`: HORUS A의 현재 출력과 v1.1 필드 연결표
- `../docs/AS1_PIPELINE_CONTRACT_v1.1.md`: 초보자용 전체 계약 설명

## 다음 단계

다음 코드 작업은 HORUS A의 중앙 후보인 `AL GENUT A GPT FORCE HETEM GATE.txt`의 송신부만 대상으로 합니다. 확정 봉마다 최대 한 건의 `BAR_CLOSE_SNAPSHOT`을 만들고, 계산 로직은 변경하지 않는 것이 원칙입니다.
