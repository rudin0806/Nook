-- 한 턴의 각 단계가 얼마나 걸리는지만 담는다.
--
-- 측정에서 한 턴이 평균 15.3초인데 judge_logs가 설명하는 것은 6.4초뿐이었다.
-- 나머지는 Vercel 런타임 로그에만 있어 DB에서 읽을 수 없었고, 그래서 무엇을
-- 줄여야 하는지 추측으로만 말할 수 있었다. 같은 값을 여기에 남겨 judge_logs와
-- 나란히 질의한다.
--
-- 발화도 사용자 식별자도 요청 본문도 들어가지 않는다. turn은 이 요청 안에서만
-- 만든 난수이며 사용자나 세션으로 이어지지 않는다 — 한 턴의 네 단계를 묶기 위한
-- 값이다. 운영 로그와 사용자 기록을 섞지 않기 위해 기존 어떤 테이블도 참조하지
-- 않는다.
begin;

create table public.ai_stage_timings (
  id uuid primary key default gen_random_uuid(),
  turn uuid not null,
  stage text not null check (stage in ('LOAD', 'SAFETY', 'GENERATE', 'COMMIT')),
  ms integer not null check (ms >= 0),
  model text,
  outcome text not null check (outcome in ('ok', 'failed')),
  created_at timestamptz not null default now()
);

create index ai_stage_timings_created_at_idx
  on public.ai_stage_timings (created_at desc);

-- 정책을 두지 않는다. anon·authenticated에는 아무 권한이 없으므로 API로 읽거나
-- 쓸 수 없고, 서버 전용 키만 들어온다.
alter table public.ai_stage_timings enable row level security;
revoke all on table public.ai_stage_timings from public, anon, authenticated;
grant select, insert on table public.ai_stage_timings to service_role;

comment on table public.ai_stage_timings is
  'Operational stage latency only. No utterance, no user or session reference. Service role only.';

commit;
