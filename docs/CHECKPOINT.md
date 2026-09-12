# C-03-pre 체크포인트

2026-09-12, 기준 브랜치 codex/rules-v3-retention-hardening, 부모 7ef308c.

사용자 확정 첨부 4개를 검토하고 Prompt B, 공통 완화형 계산, Judge Zod 검증과 결정론적 채점기를 통합했다. 기존 fixture의 AI 대사 수정과 참조 정리는 유지했다. MEDIUM 사유 6건, carryover 사유 2건을 근거 대조 후 명시했다.

검증: Judge fixture 32개, hedge 테스트 6개, Judge 테스트 8개. 전체 fixture 검사에는 Safety category 계약 불일치 8건이 남는다. 실제 모델 평가와 DB 변경은 이번 범위가 아니다.

다음: 남은 Claude 문서와 Safety 계약을 대조하고 서버 모델 runner를 연결한다. examples/reference의 의미적 평가와 실제 모델 회귀도 남아 있다. 첨부 hedge 패턴은 말끝뿐 아니라 아마/혹시 등 문장 내 패턴도 포함한다. 패턴 적정성과 0.70~0.80 모델 회귀 사례는 후속 검토한다.
