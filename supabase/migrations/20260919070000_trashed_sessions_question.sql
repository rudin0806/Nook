-- 휴지통의 모든 행이 "2026년 9월 13일의 이야기"로 똑같이 보여 무엇을 복원하는지 알 수
-- 없었다. `trashed_thought_sessions`가 시각만 담고 질문을 담지 않기 때문이다.
-- `list_recoverable_sessions`와 같은 방식으로 마지막 중심 질문을 붙여 준다.
create function public.list_trashed_sessions(
  p_limit integer default 20,
  p_offset integer default 0
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_limit is null or p_offset is null
     or p_limit not between 1 and 50
     or p_offset not between 0 and 10000
  then raise exception 'INVALID_QUERY'; end if;
  perform public.settle_retention_for_user(auth.uid());
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into result from (
    select t.id,
           t.origin_branch_id,
           t.started_at,
           t.completed_at,
           t.trashed_at,
           t.purge_after,
           -- 확정된 질문이 없으면 처음 적은 생각을 쓰고, 그것도 없으면 빈 값으로 둔다.
           -- 화면이 날짜 제목으로 되돌아갈 수 있게 null을 그대로 넘긴다.
           left(coalesce(n.final_text, m.content), 160) as question
    from public.trashed_thought_sessions t
    left join lateral (
      select q.final_text
      from public.question_nodes q
      join public.segments g on g.id = q.segment_id
      where q.session_id = t.id
      order by g.ordinal desc, q.ordinal desc
      limit 1
    ) n on true
    left join lateral (
      select content
      from public.messages
      where session_id = t.id and role = 'USER' and kind = 'RAW_THOUGHT'
      order by sequence_no
      limit 1
    ) m on true
    where t.user_id = auth.uid()
    order by t.trashed_at desc, t.id
    limit p_limit + 1 offset p_offset
  ) r;
  return result;
end $$;

revoke all on function public.list_trashed_sessions(integer, integer) from public, anon;
grant execute on function public.list_trashed_sessions(integer, integer) to authenticated;
