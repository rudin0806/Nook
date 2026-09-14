# 첫 질문·Safety 내부 어댑터 구현

사용자가 초안 구현을 승인하여 RULES §1.3과 PRD의 Prompt A 역할을 갱신했다. A는 분류·초점 확인, 별도 Node 0 생성기는 첫 질문 제안을 담당한다. C/D의 기존 호출 조건은 변경하지 않았다.

## 구현

- Safety/A/Node 0 프롬프트를 각각 코드로 옮기고 Zod strict schema를 적용했다.
- Safety는 label/category만 받고 기존 safety_mapping.json에서 behavior/contact를 조회한다. 추가 필드·이전 category·불가능한 조합은 거절한다.
- A의 필드 조합, 원문 후보 일치, Node 0의 인용 일치와 단일 질문을 검사한다. 인용 검사만으로 의미적 과잉 해석까지 검증되지는 않는다.
- 서버 전용 Responses 어댑터는 기존 SDK factory를 사용한다. store:false, 자동 재시도 0, 명시적 모델/추론 설정, 출력 상한을 유지한다. Astra는 거절하고 Node 0는 Terra/Sol만 허용한다. 운영 모델을 새로 선택하지 않았다.
- createStartFlow는 서버가 제공한 Safety Gate 이후 A를 실행한다. STOP/HANDOFF면 다음 단계를 실행하지 않는다. 원문을 결과에 되돌려주지 않으며 DB에는 아무것도 쓰지 않는다.
- 여러 고민 경로는 서버 소유 후보 중 사용자가 명시적으로 선택할 때만 이어진다. 선택에도 Gate를 다시 호출한다. 선택값 변경과 같은 초안 객체 안의 중복 호출을 제어한다. 반환값은 복제하여 외부 변조가 내부 후보를 바꾸지 못하게 했다.
- 실패를 원문 없는 고정 오류로 반환하며 실패한 요청을 자동 반복하지 않는다. 생성 결과는 PROPOSAL일 뿐 승인·저장 성공이 아니다.

## 검증

- tests/start-flow.test.mts: 8개 테스트 통과. STOP/HANDOFF 차단, malformed 출력, 원문에 없는 인용/후보, 중복·충돌 선택, Safety 재실행, provider 실패와 재시도 차단을 포함한다.
- npm run validate: typecheck/lint/build 통과.
- npm run eval -- --dry: 기본 Judge 2개 fixture 정합 검사 통과. 유료 모델 호출은 하지 않았다. Safety/Start의 모델 정확도 결과가 아니다.

## 공개 연결 전 남은 부분

1. Safety classifier는 완전한 Gate가 아니다. Moderation 결합 우선순위·제3자 긴급도·다중 위험·구체적 타해 경로는 기존 제안 문서의 미결을 유지한다. 이 모듈을 단독 Gate로 배포하면 안 된다.
2. 공개 시작 API, 실제 인증 소유권, CAPTCHA/요청량·비용 제한, 초안 만료 및 DB 기반 분산 중복 방지, 사용자 승인 시 원자적 Node 저장은 아직 연결하지 않았다. 현재 deduplication은 단일 초안 객체 범위다.
3. 자유 입력 초점 응답 해석·불명확한 응답 UI는 후속 작업이다. 현재 coordinator는 명시적 후보 선택만 처리한다. 이는 자유 입력의 제품 허용 여부를 변경한 것이 아니다.
4. STOP 원문 미저장과 HANDOFF Message 저장의 실제 DB 처리는 후속 저장 계층에서 구현한다. 현재 단계는 저장 정책을 실행한 척하지 않는다.
5. 기존 Safety fixture 8건 category 변경과 S-14 안내문 정리는 제안 상태다. 실제 Safety/Start 평가 및 독립 회귀셋 검증은 남았다.

운영 DB·공개 입력창·배포 설정은 이번 작업에서 변경하지 않았다.
