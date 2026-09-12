# Nook 재개 지점

## 이번에 구현한 것

- `src/engine/hedge.ts`: 전체 세션의 사용자 발화만 세어 완화형 비율과 `hedgeSpeaker`를 계산한다. 5개 이상·비율 0.7 이상일 때만 true다.
- `HEDGE_ENDINGS_VERSION = v1`: 기존 확장 감사 목록의 어미를 공통 함수로 옮겼다. 조사 중간 표현 대신 발화 끝을 검사한다.
- 중복 발화 ID는 오류로 거절해 history와 현재 창이 겹쳐 비율이 부풀려지는 것을 막는다.
- fixture 검증기가 공통 함수를 사용한다. 실제 API·LLM 호출에는 아직 연결하지 않았다.
- `npm run test:hedge`: 경계 테스트 6개, 그중 한 테스트에서 원본 Judge 32개 전부와 보정 결과를 대조한다.

## 재개할 때

이번 검증: `test:hedge` 6개 및 Judge fixture 32개 보정 일치, `typecheck`·`lint`·`build` 통과. `eval:validate`는 fixture 오류 0개·기존 계약 불일치 10개로 종료 코드 1이다.

작업 브랜치는 `codex/rules-v3-retention-hardening`, [PR #2](https://github.com/rudin0806/Nook/pull/2)다. 시작 전 최신 head를 확인한다. 이번 작업의 기준 head는 `f441e1c7386a3b15a4cf946b7ecc411b2747e78d`였다.

1. `docs/STATUS.md`와 이 파일을 읽고 변경 파일만 확인한다.
2. `npm run test:hedge`로 계산기 회귀를 확인한다.
3. Claude C-01 결과 또는 사용자 결정을 받아 아래 계약 차이를 정리한다.
4. 이후 Judge/Safety 입출력 스키마·실제 평가기를 구현한다. 비교 결과가 없는 프롬프트를 최적화 완료로 표시하지 않는다.

## 아직 남은 것

- carryover의 `medium_reason` 2건과 Safety category 8건은 기존 계약 불일치다. 이번 변경으로 해결된 것이 아니다.
- 첨부 RULES의 HANDOFF 상태와 main의 `HANDOFF_STOPPED`, 제3자 안내 문구 등은 `docs/HANDOFF.md` C-01에서 검토한다.
- 후속 DB migration의 무조건적인 `public.rls_auto_enable()` 권한 회수는 해당 helper가 없는 새 DB에서 실패할 가능성이 있어 재현 검토가 필요하다. 이미 적용된 migration을 임의 수정·재적용하지 않았다.
- 원격 DB 재적용·RLS 재시험·운영 배포·실제 AI 평가는 이번에 실행하지 않았다.

`eval:validate` 전체는 기존 계약 불일치로 실패할 수 있다. 완화형 계산기 테스트 통과와 전체 평가 통과를 구분한다.
