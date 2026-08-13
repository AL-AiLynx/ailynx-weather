# HORUS A 중앙 Exporter 감사 v1

## 결론

**최종 판정: MODERATE FIX**

HORUS A에는 이미 JSON을 만드는 중앙 alert bus가 있습니다. 따라서 계산 로직을 다시 만들 필요는 없습니다. 다만 지금의 JSON 이름, 시간 처리, 중복 키, 실시간 trigger 전송은 AS1 공통 계약과 다릅니다. 첫 시험 송신기는 `AL GENUT A GPT FORCE HETEM GATE.txt` 하나로 정하고, 그 파일의 **확정 봉 snapshot**만 AS1 v1 envelope으로 바꾸는 작업이 필요합니다.

이번 감사에서는 제공된 `current/horus-a` 원본 11개를 읽기만 했습니다. 실제 Git 작업 폴더에는 `current` 원본이 없었으므로, 상위 workspace에 있는 제공 경로를 읽기 전용으로 검사했습니다. 이 문서와 파이프라인 파일만 실제 Git 작업 폴더에 저장했습니다.

## 검사 대상 전체 목록과 역할

| 파일 | 줄 수 | 역할 | Alert 관련 여부 |
| --- | ---: | --- | --- |
| `AL ARMOR GPT.txt` | 383 | Armor 상태·점수·저항 출력 | `alertcondition()` 367–373행 |
| `AL EARRING GPT.txt` | 247 | Earring 상태·이벤트·저항 출력 | `alertcondition()` 233–237행 |
| `AL GENUT A GPT FORCE HETEM GATE.txt` | 1,574 | 9개 구성요소를 모아 HORUS A 힘·관문·상태를 계산하고 통합 JSON bus를 전송 | `alert()` 1516, 1535, 1542, 1549, 1556, 1563행; `alertcondition()` 1570–1574행 |
| `AL GLOVE GPT.txt` | 406 | GLOVE handoff/피로 상태 출력 | `alertcondition()` 388–396행 |
| `AL HELMET GPT.txt` | 394 | Sweep/강도/상태 출력 | `alertcondition()` 375–384행 |
| `AL NECKLACE GPT.txt` | 485 | Spike/fade/활성 상태 출력 | `alertcondition()` 468–475행 |
| `AL PANTS GPT.txt` | 480 | LTF proxy와 방향·위험 상태 출력 | `alertcondition()` 464–470행 |
| `AL PER A GPT HETEM MONITOR.txt` | 1,250 | GENUT 출력 기반의 방어 검증·위험 모니터 | `alert()` 982, 984행; `alertcondition()` 1243–1250행 |
| `AL RING GPT.txt` | 451 | Ring trigger/event/fade 상태 출력 | `alertcondition()` 435–441행 |
| `AL SHIELD GPT.txt` | 420 | Shield filter/gate 상태 출력 | `alertcondition()` 404–410행 |
| `AL SHOES GPT.txt` | 575 | Edge/failure/추적 상태 출력 | `alertcondition()` 550–565행 |

`alert()`가 실제로 있는 파일은 **GENUT A**와 **PER A** 두 개입니다. JSON 문자열을 직접 조립하는 파일도 두 개입니다. GENUT A의 `f_makeAlertBusJson()`은 272–326행, PER A의 `f_perAlertJson()`은 471–490행입니다.

## 중앙 Exporter 후보

**선정 파일:** `current/horus-a/AL GENUT A GPT FORCE HETEM GATE.txt`

선정 이유는 다음과 같습니다.

- 641–702행에서 Shield, Armor, Pants, Glove, Shoes, Necklace, Earring, Ring, Helmet의 score/direction/state/active/event/resistance 출력을 `input.source`로 받습니다.
- 1484행부터 `HETEM Gate Alert Bus | Unified alert() JSON` 구역이 이미 있습니다.
- 1511–1517행의 `snapshotJsonA`는 `barstate.isconfirmed`, `barstate.isrealtime`, `alert.freq_once_per_bar_close`, `lastSnapshotKey`를 함께 사용합니다.
- 이미 HORUS A의 direction, state, risk, total, force, gate, pressure, block, event를 한 곳에서 보유합니다.

따라서 이 파일 한 곳만 AS1 외부 송신기로 쓰고, 나머지 구성요소 및 PER A의 알림은 기존 진단용으로 남기되 **AS1 Supabase Webhook에는 연결하지 않는 것**을 권장합니다.

## 현재 Alert 및 JSON 구조

### GENUT A의 확정 봉 snapshot

GENUT A는 `snapshotKeyA`를 `syminfo.tickerid|group|layer|timeframe.period|time`으로 만들고(1511행), 같은 키가 마지막 키와 다를 때에만 전송합니다. 실제 전송 조건은 아래와 같습니다.

```text
enableAlertBus && sendSnapshots && barstate.isconfirmed &&
barstate.isrealtime && snapshotKeyA != lastSnapshotKey
```

이 경로는 확정 봉 원칙을 지킵니다. `alert.freq_once_per_bar_close`도 사용합니다. 다만 현재 `time`은 봉 시작 시각이며, 계약에서 요구하는 `bar_close_time`과 `sent_at`은 없습니다.

### GENUT A의 실시간 trigger

1534–1563행은 FORCE_SHIFT, PRESSURE_RISING, FORCE_CONFIRM, FORCE_FADE_BLOCK, TRAP_WAIT를 `alert.freq_once_per_bar`로 보냅니다. 조건도 `barstate.isrealtime`만 사용하므로 확정 봉 전용 계약에는 맞지 않습니다. AS1 v1 Supabase 경로에서는 이 다섯 trigger를 보내지 않아야 합니다.

### PER A의 실험 JSON

PER A는 979–985행에서 경고 조건이 되면 JSON을 전송합니다. `perAlertConfirmedOnly` 설정에 따라 미확정 봉도 허용될 수 있고, `ONCE_PER_BAR` 모드도 있습니다. GENUT가 이미 가진 종목·시간·힘·상태와 겹치므로 첫 시험 송신기로 쓰지 않습니다.

### 구성요소의 alertcondition

ARMOR, EARRING, GLOVE, HELMET, NECKLACE, PANTS, RING, SHIELD, SHOES는 각각 짧은 CSV 메시지를 내보냅니다. GENUT가 이들의 숨은 plot 값을 이미 수집하므로, 개별 alertcondition을 Supabase로 연결하면 같은 봉의 의미가 여러 파일에서 중복 전송될 수 있습니다.

## 현재 GENUT JSON 필드

`f_makeAlertBusJson()` 282–326행의 현재 필드는 다음과 같습니다.

```text
source, system, engine, observer, season, season_code, group, layer,
alert_kind, event, trigger, bar_status, gv, ec, es, gp,
symbol, tf, time, open, high, low, close, volume,
dir, state, risk, total, block, flow, next_tf, mode_code, event_code,
gate_state, gate_score, pressure_index, state_signature, event_signature,
dedup_key, brief_policy, gpt_allowed, voice_allowed, gaw_code, gaw_line, version
```

확보 가능한 HORUS A 고유 payload는 direction/state/risk, total/force/fade 점수, flow·flow_shift, gate state/score, pressure, block, event code/severity, next timeframe, mode, active component count입니다. 이 감사의 field map에는 이 범위만 넣었습니다.

## 공통 계약에 비해 부족한 필드

| AS1 v1 공통 필드 | 현재 상태 | 보완 방법 |
| --- | --- | --- |
| `schema_version` | 내부 `gv`/`gawSchemaVersionA`만 있음 | `as1.v1`을 별도 필드로 고정 |
| `satellite_id` | 없음 | `AS1` 추가 |
| `platform` | `source=TradingView` | `TRADINGVIEW` 별도 필드 추가 |
| `layout_id` | `observer=HORUS`, `group=A`로 분산 | `HORUS_A` 추가 |
| `observer` | `HORUS` 있음 | 유지 가능; 필요 시 중앙 관측기 이름을 별도 표기 |
| `code_version` | `version`은 있으나 이름이 다름 | `alertVersion`을 `code_version`으로 매핑 |
| `ticker_id` | `symbol=syminfo.tickerid`로만 있음 | `ticker_id`로 이름 변경 |
| `symbol` | 별도 표시 심볼 없음 | ticker_id에서 안전한 규칙으로 파생하거나 명시적으로 TBD 처리 |
| `timeframe` | `tf` 있음 | 이름 변경 |
| `bar_open_time` | `time` 있음(봉 시작 epoch) | ISO-8601 UTC로 변환 |
| `bar_close_time` | 없음 | `time_close` 추가 및 ISO-8601 UTC 변환 |
| `sent_at` | 없음 | 발송 시각 정책을 정한 뒤 추가 |
| `packet_type` | `alert_kind=SNAPSHOT` | `BAR_CLOSE_SNAPSHOT` 추가 |
| `confirmed` | 조건에는 있으나 JSON 필드는 없음 | `true` 추가 |
| `quality` | 없음 | 필요한 source가 모두 준비되었는지로 `normal`/`degraded` 결정 |
| `dedup_key` | 봉 종료 시각·계약 버전·layout_id가 없음 | 고정 5요소로 새로 생성 |

## 과도하거나 중복되는 정보

- 현재 JSON의 OHLCV는 첫 layout-state snapshot의 공통 필수값이 아닙니다. 별도 시세 데이터가 필요한 경우에만 다시 논의합니다.
- `gaw_code`, `gaw_line`, `brief_policy`, defense metadata, 평가 기간, 목적 문자열은 briefing/방어용 내부 메타데이터입니다. 첫 Supabase 계약 payload에서는 제외합니다.
- GENUT `alert()` bus, GENUT `alertcondition()` JSON, PER A JSON, 9개 구성요소의 alertcondition을 동시에 Webhook으로 보내면 같은 상태가 여러 번 전달될 수 있습니다.
- AS2 TrendSpider의 도로·벽·관문 계산과 AS3 OpenMarket의 오더북·유동성 Zone은 이 payload에 넣지 않습니다.

## 현재 dedup과 확정 봉 판정

현재 snapshot의 중복 방지 키는 1513행에서 `tickerid_group_layer_timeframe_TF_SNAPSHOT` 형태로 만듭니다. 이 값에는 봉 마감 시각과 AS1 `schema_version`이 없습니다. `lastSnapshotKey`(1510–1517행)는 Pine 실행 중 중복을 줄이지만, Supabase 재시도/재수신을 위한 영속 멱등 키는 아닙니다.

AS1용 새 키는 다음 형식이어야 합니다.

```text
HORUS_A|ticker_id|timeframe|bar_close_time|as1.v1
```

snapshot은 확정 봉 조건을 만족합니다. 반면 GENUT trigger와 PER A의 설정 선택형 alert은 확정 봉 전용이라고 단정할 수 없습니다.

## 수정 위치와 안전한 보완 방법

계산식, 구성요소, score, 관문 로직은 바꾸지 않습니다. 다음처럼 **송신부만** 보완합니다.

1. GENUT A의 `f_makeAlertBusJson()`(272–326행) 옆에 AS1 전용 envelope builder를 추가합니다. 기존 builder를 대체하지 않습니다.
2. 1511–1514행에서 `time_close`를 사용해 AS1 `dedup_key`를 만들고, `snapshotJsonA` 대신 AS1 snapshot JSON을 조립합니다.
3. 1515–1517행의 기존 확정 봉 guard와 `alert.freq_once_per_bar_close`만 AS1 전송에 사용합니다.
4. 1534–1563행의 real-time trigger `alert()`는 AS1 Webhook으로 연결하지 않거나 AS1 전송 대상에서 제외합니다.
5. PER A 979–985행 및 9개 구성요소의 `alertcondition()`은 보존하되, AS1 Supabase Alert 설정을 만들지 않습니다.
6. 수신 API는 새 `dedup_key`에 UNIQUE 제약을 두어 재전송을 안전하게 무시합니다.

## 계약/Schema 주의점

현재 저장소의 `as1-alert-envelope-v1.json`은 `as1-alert-envelope-v1`, `tradingview`, `horus-a`, `bar_close_snapshot`을 허용합니다. 이번 작업 지시의 live draft 고정값은 `as1.v1`, `TRADINGVIEW`, `HORUS_A`, `BAR_CLOSE_SNAPSHOT`입니다. 이 둘은 대소문자와 값이 달라 현재 Schema 검증을 통과하지 않습니다.

따라서 다음 코드 작업 전에 계약의 canonical literal을 하나로 확정하고 Schema를 그 결정에 맞춰 별도 변경해야 합니다. 이 감사에서는 기존 계약/Schema를 수정하지 않았습니다.

## 다음 코드 작업 범위

- 대상: `AL GENUT A GPT FORCE HETEM GATE.txt`의 272–326행 및 1511–1517행 주변 송신부만.
- 추가: AS1 envelope builder, `time_close` 기반 UTC 변환, 새 `dedup_key`, quality 계산, 중앙 snapshot 한 건.
- 제외: HORUS A 계산 로직, 9개 구성요소 계산, PER A 방어 계산, archive, AS2/AS3 관련 로직.
- 검증: TradingView에서 확정 봉 하나마다 `BAR_CLOSE_SNAPSHOT` 한 건, 같은 키 재전송 시 Supabase 한 행만 저장되는지 확인.
