# Moderation 결합 및 시작 흐름 서버 배선

기준: `7644019`, RULES Safety Flow / PRD 8.1. 디자인은 사용자 요청에 따라 전면 교체 예정이며 이번 변경은 서버 로직에 한정한다.

## 구현

- `executeSafetyGate`: 입력·모델 설정 검증 → omni-moderation-latest → 문맥 Safety Classifier → 기존 결정론적 매핑.
- Moderation은 현재 발화를 검사한다. 분류기는 기존 context와 현재 발화에 더해 서버가 검증한 flagged/flagged_categories만 받는다. 점수·provider ID는 전달/저장하지 않는다.
- Moderation의 참/거짓을 STOP/CONTINUE로 직접 치환하지 않는다. 부정 결과에도 HANDOFF 등 문맥 판단이 필요하다.
- 실패·비정상 응답은 고정 오류로 중단한다. 원문을 오류에 담거나 자동 재시도하지 않는다.
- `createServerStartFlow`: 완전한 Gate를 시작 분류·Node 0 생성 앞에 연결한다. 초점 선택도 다시 Gate를 통과한다. 승인 전 후보를 저장하지 않는다.
- Safety 프롬프트 v2: Moderation 신호 해석 지침만 추가. label/category 계약과 정답 fixture는 그대로 유지.

## 검증과 한계

- Safety Gate 7개 + 기존 시작 흐름 8개, 총 15개 테스트 통과.
- 타입·린트·빌드 검증 수행. 모델 평가 dry-run의 기본 경계쌍 2개 통과.
- 전체 fixture 검사는 기존 Safety 분류명 불일치 8건으로 실패. 모델 품질 평가 통과를 뜻하지 않는다.
- 유료 모델 호출과 운영 DB 변경 없음. 공개 시작 API에 아직 연결하지 않음.
- 서버 팩터리는 요청 내 메모리 흐름이다. 워커 간 중복 방지·초안 보존·사용자 소유권·분산 요청량 제한·사용자 승인 원자적 저장을 대신하지 않는다.

## 다음 구현

공개 API를 열기 전에 위 저장/요청 경계를 구현하고 Safety fixture 계약 및 실제 모델 평가를 완료한다. STOP 원문 미저장, HANDOFF Message 저장은 DB 배선에서 구분해야 한다.

Moderation API 필드 참고: https://developers.openai.com/api/docs/guides/moderation
