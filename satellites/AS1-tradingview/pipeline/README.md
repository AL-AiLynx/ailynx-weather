# AS1 TradingView → Supabase Pipeline v1

이 폴더는 AiLynx 인공위성 1호(AS1)의 TradingView 알림을 Supabase로 전달할 때 쓰는 **공통 약속**을 담습니다. HORUS A, HORUS B, MAAT, MAAT2는 서로 다른 계산을 하더라도 바깥 포장(envelope)은 같은 형식을 사용합니다.

## 파일 안내

- `schema/as1-alert-envelope-v1.json`: 서버 또는 테스트 도구가 JSON 형식을 검사할 때 쓰는 JSON Schema입니다.
- `examples/`: 레이아웃별 정상 패킷 예시입니다. 값은 설명용이며 실제 매매 신호나 비밀값이 아닙니다.
- `../docs/AS1_PIPELINE_CONTRACT_v1.md`: 필드 뜻, 전송 규칙, Supabase 처리 방법을 설명한 계약 문서입니다.

## 빠른 사용 순서

1. 각 레이아웃의 최종 관측기(허브 또는 대표 스크립트)가 봉 마감 시점에만 JSON 한 건을 만듭니다.
2. 공통 정보는 envelope의 최상단 필드에 넣고, 해당 레이아웃만의 결과는 `payload`에 넣습니다.
3. `confirmed`가 `true`인지 확인합니다.
4. `dedup_key`를 `layout_id|ticker_id|timeframe|bar_close_time|schema_version`으로 만듭니다.
5. TradingView Alert의 Webhook 메시지 본문에 JSON을 넣어 Supabase Edge Function 또는 수신 API로 보냅니다.

## 꼭 지킬 규칙

- 미확정 실시간 봉에는 전송하지 않습니다. 확정 봉만 전송합니다.
- 같은 레이아웃·심볼·시간프레임·봉 마감 시각에는 최대 한 개의 패킷만 보냅니다.
- 재전송이 발생할 수 있으므로 Supabase에서는 `dedup_key`를 고유값으로 처리합니다.
- API 키, Supabase 서비스 역할 키, Webhook 비밀값은 Pine 코드·알림 메시지·예제 JSON에 넣지 않습니다. 비밀값 검증은 수신 API 쪽에서 처리합니다.
- AS1은 TradingView 차트의 자체 관측 결과만 담습니다. AS2 TrendSpider의 구조 계산, AS3 OpenMarket의 오더북·유동성 Zone 데이터는 이 계약이나 `payload`에 넣지 않습니다.

`payload`의 키는 레이아웃마다 달라도 됩니다. 단, 공통 필드를 `payload` 안에 중복해서 넣지 마세요.
