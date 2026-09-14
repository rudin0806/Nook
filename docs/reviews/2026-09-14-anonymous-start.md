# 익명 대화 시작 준비

## 구현

`ensureAnonymousActor`는 기존 익명/영구 사용자의 ID를 재사용한다. 사용자 조회가 실패하면 신규 가입하지 않는다. 신규 가입은 서버가 허용하고 CAPTCHA 토큰이 있을 때만 요청하며, 가입 응답 뒤 다시 getUser로 같은 익명 사용자임을 확인한다. 외부 오류 원문·토큰은 반환하지 않고 자동 재시도하지 않는다.

`ensureConversationActor`는 기존 쿠키 기반 Supabase 클라이언트와 위 모듈을 연결한다. Route Handler/Server Action에서만 호출해야 한다. 공개 익명 가입 API는 아직 만들지 않았다. 실제 Raw Thought를 전달받거나 저장하지 않는다.

`NOOK_ANONYMOUS_SIGN_IN_ENABLED`가 정확히 true일 때만 신규 생성을 허용한다. 기본은 비활성이다. CAPTCHA 토큰 유무 검사 자체는 CAPTCHA 검증이 아니므로, 공급자의 CAPTCHA 검증 활성화와 요청 제한을 연결하기 전에 켜지 않는다. 동시 탭/독립 요청 간 중복 생성 제어는 상위 시작 흐름에서 추가해야 한다.

## 검증

단위 테스트 6개 통과: 기존 사용자 재사용, 비활성/잘못된 CAPTCHA 요청 거절, 가입 후 검증 및 재사용, 인증 장애 시 생성 금지, 외부 오류 비노출·재시도 금지, 다른 UID 검증 결과 거절. 타입·린트·빌드 통과. 실제 익명 가입·Google 연결 왕복은 미검증이다.

## 첫 입력 공개 전 남은 결정

- RULES §17: Safety Classifier의 구체 프롬프트. 기존 Safety 평가셋 category 불일치도 해결해야 한다.
- RULES §1.3: focus_required일 때 한 번의 초점 확인 질문을 누가 생성할지. 현재 Prompt D는 REFLECT 전용이고 Prompt A 출력 변경은 미확정이다.
- Prompt A와 Node 0 생성 프롬프트 및 평가. 기존 Prompt C는 SHIFT 전용이므로 첫 질문 생성에 그대로 호출하지 않는다.

위 계약 확정 후 시작 API에 익명 인증·Safety 선행·첫 질문 제안·사용자 확인·원자적 저장을 연결한다. 현재 입력 화면은 전송하지 않는다는 안내를 유지한다. 사용 가능한 대화 시작 기능이 완성됐다고 표현하지 않는다.
