-- 보관한 이야기 목록이 질문을 들고 오지 않아, 두 화면이 각자 다른 우회를 하고 있었다.
-- 홈은 책마다 story 전문을 따로 받아 마지막 질문을 꺼냈고(책 4권이면 요청 5번),
-- 생각 더미는 포기하고 날짜를 썼다(책등 `2699`, 펼쳐도 `9월 9일의 이야기`).
-- 휴지통에 한 것과 같은 방식으로 질문을 함께 준다.
--
-- 정렬은 기존 목록과 같아야 한다 — 책장 순서(shelf_position)가 먼저이고 정하지 않은
-- 책이 뒤로 간다. 순서 편집이 이 정렬 위에서 동작한다.
create function public.list_saved_sessions(
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
  select coalesce(jsonb_agg(to_jsonb(r) - 'ord' order by r.ord), '[]'::jsonb) into result from (
    select s.id,
           s.origin_branch_id,
           s.started_at,
           s.completed_at,
           s.retention_decided_at,
           s.shelf_position,
           s.shelf_revision,
           s.turn_count,
           s.node_count,
           left(coalesce(n.final_text, m.content), 160) as question,
           row_number() over (
             order by s.shelf_position asc nulls last,
                      s.retention_decided_at desc,
                      s.id
           ) as ord
    from public.saved_thought_sessions s
    left join lateral (
      select q.final_text
      from public.question_nodes q
      join public.segments g on g.id = q.segment_id
      where q.session_id = s.id
      order by g.ordinal desc, q.ordinal desc
      limit 1
    ) n on true
    left join lateral (
      select content
      from public.messages
      where session_id = s.id and role = 'USER' and kind = 'RAW_THOUGHT'
      order by sequence_no
      limit 1
    ) m on true
    where s.user_id = auth.uid()
    order by s.shelf_position asc nulls last, s.retention_decided_at desc, s.id
    limit p_limit + 1 offset p_offset
  ) r;
  return result;
end $$;

revoke all on function public.list_saved_sessions(integer, integer) from public, anon;
grant execute on function public.list_saved_sessions(integer, integer) to authenticated;
