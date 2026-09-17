-- A shelf is more useful when a book's size means something, so the saved list
-- carries how much the conversation actually holds: user turns, and the number
-- of questions it passed through. Both are already counted on segments, so this
-- only exposes them. security_invoker keeps the caller's RLS on both tables.
create or replace view public.saved_thought_sessions with (security_invoker = true) as
select s.id,
       s.user_id,
       s.origin_branch_id,
       s.started_at,
       s.completed_at,
       s.retention_decided_at,
       s.shelf_position,
       (select public.own_shelf_revision()) as shelf_revision,
       coalesce(counted.turns, 0)::integer as turn_count,
       coalesce(counted.nodes, 0)::integer as node_count
from public.thought_sessions s
left join (
  select session_id,
         sum(turn_count)::integer as turns,
         sum(node_count)::integer as nodes
  from public.segments
  group by session_id
) counted on counted.session_id = s.id
where s.status = 'COMPLETED' and s.storage_state = 'SAVED';
