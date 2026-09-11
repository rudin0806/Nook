begin;

create extension if not exists pgcrypto with schema extensions;

create type public.session_status as enum (
  'ACTIVE',
  'COMPLETED',
  'SAFETY_STOPPED',
  'HANDOFF_STOPPED'
);

create type public.session_storage_state as enum (
  'TEMPORARY',
  'SAVED',
  'TRASHED'
);

create type public.segment_status as enum ('ACTIVE', 'CLOSED');
create type public.message_role as enum ('USER', 'ASSISTANT');

create type public.message_kind as enum (
  'RAW_THOUGHT',
  'USER_REPLY',
  'START_REFRAME',
  'REFLECTION',
  'SHIFT_PROPOSAL',
  'CLOSURE',
  'SYSTEM_NOTICE'
);

create type public.question_node_kind as enum ('START', 'SHIFT');
create type public.clarification_status as enum ('ACTIVE', 'INVALIDATED');
create type public.branch_retention_state as enum ('PENDING', 'KEPT');
create type public.feedback_answer as enum ('CLEARER', 'SAME', 'UNSURE');
create type public.judge_action as enum ('SHIFT', 'REFLECT', 'CLOSE');
create type public.shift_confidence as enum ('HIGH', 'MEDIUM', 'LOW');

create type public.medium_reason as enum (
  'SINGLE_SPONTANEOUS',
  'ALL_HEDGED',
  'AI_LED_WITH_USER_MATERIAL'
);

create type public.safety_label as enum ('NONE', 'AMBIGUOUS', 'HIGH_RISK');

create type public.safety_category as enum (
  'NONE',
  'SUICIDE_SELF_HARM',
  'YOUTH',
  'VIOLENCE_VICTIM',
  'GENERAL_MENTAL_HEALTH'
);

create type public.safety_behavior as enum ('STOP', 'HANDOFF');
create type public.safety_trigger_source as enum ('MODERATION', 'CLASSIFIER', 'BOTH');

create table public.thought_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origin_branch_id uuid,
  status public.session_status not null default 'ACTIVE',
  storage_state public.session_storage_state not null default 'TEMPORARY',
  past_probe_count smallint not null default 0,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  retention_decided_at timestamptz,
  trashed_at timestamptz,
  purge_after timestamptz,
  temporary_expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint thought_sessions_id_user_unique unique (id, user_id),
  constraint thought_sessions_past_probe_count_check
    check (past_probe_count between 0 and 1),
  constraint thought_sessions_lifecycle_check
    check (
      (status = 'ACTIVE' and completed_at is null)
      or (status <> 'ACTIVE' and completed_at is not null)
    ),
  constraint thought_sessions_storage_check
    check (
      (
        storage_state = 'TEMPORARY'
        and retention_decided_at is null
        and trashed_at is null
        and purge_after is null
        and temporary_expires_at is not null
      )
      or (
        storage_state = 'SAVED'
        and status = 'COMPLETED'
        and retention_decided_at is not null
        and trashed_at is null
        and purge_after is null
        and temporary_expires_at is null
      )
      or (
        storage_state = 'TRASHED'
        and status = 'COMPLETED'
        and retention_decided_at is not null
        and trashed_at is not null
        and purge_after = trashed_at + interval '7 days'
        and temporary_expires_at is null
      )
    )
);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.thought_sessions (id) on delete cascade,
  ordinal smallint not null,
  status public.segment_status not null default 'ACTIVE',
  anchor_node_id uuid,
  node_count smallint not null default 0,
  turn_count smallint not null default 0,
  branch_count smallint not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz,

  constraint segments_id_session_unique unique (id, session_id),
  constraint segments_session_ordinal_unique unique (session_id, ordinal),
  constraint segments_ordinal_check check (ordinal >= 1),
  constraint segments_anchor_shape_check
    check (
      (ordinal = 1 and anchor_node_id is null)
      or (ordinal > 1 and anchor_node_id is not null)
    ),
  constraint segments_node_count_check check (node_count between 0 and 4),
  constraint segments_turn_count_check check (turn_count between 0 and 20),
  constraint segments_branch_count_check check (branch_count between 0 and 5),
  constraint segments_status_check
    check (
      (status = 'ACTIVE' and closed_at is null)
      or (status = 'CLOSED' and closed_at is not null)
    )
);

create unique index segments_one_active_per_session_idx
  on public.segments (session_id)
  where status = 'ACTIVE';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  segment_id uuid not null,
  role public.message_role not null,
  kind public.message_kind not null,
  content text not null,
  sequence_no integer not null,
  user_turn_no integer,
  reply_to_message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint messages_id_session_unique unique (id, session_id),
  constraint messages_segment_session_fk
    foreign key (segment_id, session_id)
    references public.segments (id, session_id)
    on delete cascade,
  constraint messages_content_check check (btrim(content) <> ''),
  constraint messages_sequence_no_check check (sequence_no >= 1),
  constraint messages_user_turn_no_check
    check (
      (role = 'USER' and user_turn_no is not null and user_turn_no >= 1)
      or (role = 'ASSISTANT' and user_turn_no is null)
    ),
  constraint messages_role_kind_check
    check (
      (
        role = 'USER'
        and kind in ('RAW_THOUGHT', 'USER_REPLY')
      )
      or (
        role = 'ASSISTANT'
        and kind in (
          'START_REFRAME',
          'REFLECTION',
          'SHIFT_PROPOSAL',
          'CLOSURE',
          'SYSTEM_NOTICE'
        )
      )
    ),
  constraint messages_session_sequence_unique unique (session_id, sequence_no)
);

create unique index messages_session_user_turn_unique_idx
  on public.messages (session_id, user_turn_no)
  where user_turn_no is not null;

create table public.question_nodes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  segment_id uuid not null,
  ordinal smallint not null,
  kind public.question_node_kind not null,
  ai_proposed_text text not null,
  final_text text not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint question_nodes_id_session_unique unique (id, session_id),
  constraint question_nodes_segment_session_fk
    foreign key (segment_id, session_id)
    references public.segments (id, session_id)
    on delete cascade,
  constraint question_nodes_segment_ordinal_unique unique (segment_id, ordinal),
  constraint question_nodes_ordinal_check check (ordinal >= 1),
  constraint question_nodes_proposed_text_check check (btrim(ai_proposed_text) <> ''),
  constraint question_nodes_final_text_check check (btrim(final_text) <> ''),
  constraint question_nodes_kind_ordinal_check
    check (kind = 'SHIFT' or (kind = 'START' and ordinal = 1))
);

alter table public.segments
  add constraint segments_anchor_node_fk
  foreign key (anchor_node_id, session_id)
  references public.question_nodes (id, session_id)
  on delete no action
  deferrable initially deferred;

create table public.shift_edges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.thought_sessions (id) on delete cascade,
  from_node_id uuid not null,
  to_node_id uuid not null,
  reason_text text not null,
  created_at timestamptz not null default now(),

  constraint shift_edges_id_session_unique unique (id, session_id),
  constraint shift_edges_from_node_fk
    foreign key (from_node_id, session_id)
    references public.question_nodes (id, session_id)
    on delete cascade,
  constraint shift_edges_to_node_fk
    foreign key (to_node_id, session_id)
    references public.question_nodes (id, session_id)
    on delete cascade,
  constraint shift_edges_to_node_unique unique (to_node_id),
  constraint shift_edges_distinct_nodes_check check (from_node_id <> to_node_id),
  constraint shift_edges_reason_text_check check (btrim(reason_text) <> '')
);

create table public.shift_edge_evidence (
  edge_id uuid not null,
  session_id uuid not null,
  message_id uuid not null,
  position smallint not null,
  created_at timestamptz not null default now(),

  primary key (edge_id, message_id),
  constraint shift_edge_evidence_edge_fk
    foreign key (edge_id, session_id)
    references public.shift_edges (id, session_id)
    on delete cascade,
  constraint shift_edge_evidence_message_fk
    foreign key (message_id, session_id)
    references public.messages (id, session_id)
    on delete cascade,
  constraint shift_edge_evidence_position_check check (position >= 1),
  constraint shift_edge_evidence_position_unique unique (edge_id, position)
);

create table public.clarifications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  node_id uuid not null,
  text text not null,
  status public.clarification_status not null default 'ACTIVE',
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clarifications_id_session_unique unique (id, session_id),
  constraint clarifications_node_session_fk
    foreign key (node_id, session_id)
    references public.question_nodes (id, session_id)
    on delete cascade,
  constraint clarifications_text_check check (btrim(text) <> ''),
  constraint clarifications_status_check
    check (
      (status = 'ACTIVE' and invalidated_at is null)
      or (status = 'INVALIDATED' and invalidated_at is not null)
    )
);

create table public.clarification_evidence (
  clarification_id uuid not null,
  session_id uuid not null,
  message_id uuid not null,
  position smallint not null,
  created_at timestamptz not null default now(),

  primary key (clarification_id, message_id),
  constraint clarification_evidence_clarification_fk
    foreign key (clarification_id, session_id)
    references public.clarifications (id, session_id)
    on delete cascade,
  constraint clarification_evidence_message_fk
    foreign key (message_id, session_id)
    references public.messages (id, session_id)
    on delete cascade,
  constraint clarification_evidence_position_check check (position >= 1),
  constraint clarification_evidence_position_unique unique (clarification_id, position)
);

create table public.branch_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_session_id uuid references public.thought_sessions (id) on delete set null,
  source_segment_id uuid references public.segments (id) on delete set null,
  source_node_id uuid references public.question_nodes (id) on delete set null,
  text text not null,
  retention_state public.branch_retention_state not null default 'PENDING',
  kept_at timestamptz,
  created_at timestamptz not null default now(),

  constraint branch_questions_id_user_unique unique (id, user_id),
  constraint branch_questions_text_check check (btrim(text) <> ''),
  constraint branch_questions_retention_check
    check (
      (retention_state = 'PENDING' and kept_at is null)
      or (retention_state = 'KEPT' and kept_at is not null)
    )
);

alter table public.thought_sessions
  add constraint thought_sessions_origin_branch_fk
  foreign key (origin_branch_id)
  references public.branch_questions (id)
  on delete set null;

create table public.branch_question_evidence (
  branch_question_id uuid not null references public.branch_questions (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  position smallint not null,
  created_at timestamptz not null default now(),

  primary key (branch_question_id, message_id),
  constraint branch_question_evidence_position_check check (position >= 1),
  constraint branch_question_evidence_position_unique
    unique (branch_question_id, position)
);

create table public.session_feedback (
  session_id uuid primary key references public.thought_sessions (id) on delete cascade,
  answer public.feedback_answer not null,
  created_at timestamptz not null default now()
);

create table public.judge_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  segment_id uuid not null,
  user_message_id uuid not null,
  action public.judge_action not null,
  shift_confidence public.shift_confidence not null,
  medium_reason public.medium_reason,
  validated_output jsonb not null,
  model_name text not null,
  prompt_version text not null,
  latency_ms integer not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),

  constraint judge_logs_session_fk
    foreign key (session_id)
    references public.thought_sessions (id)
    on delete cascade,
  constraint judge_logs_segment_session_fk
    foreign key (segment_id, session_id)
    references public.segments (id, session_id)
    on delete cascade,
  constraint judge_logs_message_session_fk
    foreign key (user_message_id, session_id)
    references public.messages (id, session_id)
    on delete cascade,
  constraint judge_logs_output_check check (jsonb_typeof(validated_output) = 'object'),
  constraint judge_logs_model_name_check check (btrim(model_name) <> ''),
  constraint judge_logs_prompt_version_check check (btrim(prompt_version) <> ''),
  constraint judge_logs_latency_check check (latency_ms >= 0),
  constraint judge_logs_input_tokens_check check (input_tokens is null or input_tokens >= 0),
  constraint judge_logs_output_tokens_check check (output_tokens is null or output_tokens >= 0),
  constraint judge_logs_medium_reason_check
    check (
      (
        action = 'REFLECT'
        and shift_confidence = 'MEDIUM'
        and medium_reason is not null
      )
      or (
        not (action = 'REFLECT' and shift_confidence = 'MEDIUM')
        and medium_reason is null
      )
    ),
  constraint judge_logs_shift_requires_high_check
    check (action <> 'SHIFT' or shift_confidence = 'HIGH')
);

create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.thought_sessions (id) on delete cascade,
  label public.safety_label not null,
  category public.safety_category not null,
  behavior public.safety_behavior not null,
  trigger_source public.safety_trigger_source not null,
  created_at timestamptz not null default now(),

  constraint safety_events_mapping_shape_check
    check (
      (
        behavior = 'STOP'
        and label in ('AMBIGUOUS', 'HIGH_RISK')
        and category <> 'NONE'
      )
      or (
        behavior = 'HANDOFF'
        and label = 'NONE'
        and category <> 'NONE'
      )
    )
);

create index thought_sessions_user_listing_idx
  on public.thought_sessions (user_id, status, storage_state, completed_at desc);
create index thought_sessions_origin_branch_idx
  on public.thought_sessions (origin_branch_id)
  where origin_branch_id is not null;
create index thought_sessions_trash_purge_idx
  on public.thought_sessions (purge_after)
  where storage_state = 'TRASHED';
create index thought_sessions_temporary_purge_idx
  on public.thought_sessions (temporary_expires_at)
  where storage_state = 'TEMPORARY';
create index segments_session_idx on public.segments (session_id, ordinal);
create index segments_anchor_node_idx
  on public.segments (anchor_node_id)
  where anchor_node_id is not null;
create index messages_segment_idx on public.messages (segment_id, sequence_no);
create index messages_reply_to_idx
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;
create index question_nodes_session_idx on public.question_nodes (session_id);
create index shift_edges_session_idx on public.shift_edges (session_id);
create index shift_edges_from_node_idx on public.shift_edges (from_node_id);
create index clarifications_node_status_idx on public.clarifications (node_id, status);
create index branch_questions_user_kept_idx
  on public.branch_questions (user_id, created_at desc)
  where retention_state = 'KEPT';
create index branch_questions_source_session_idx
  on public.branch_questions (source_session_id)
  where source_session_id is not null;
create index branch_questions_source_segment_idx
  on public.branch_questions (source_segment_id)
  where source_segment_id is not null;
create index branch_questions_source_node_idx
  on public.branch_questions (source_node_id)
  where source_node_id is not null;
create index branch_question_evidence_message_idx
  on public.branch_question_evidence (message_id);
create index judge_logs_session_created_idx
  on public.judge_logs (session_id, created_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger thought_sessions_set_updated_at
before update on public.thought_sessions
for each row execute function public.set_updated_at();

create trigger clarifications_set_updated_at
before update on public.clarifications
for each row execute function public.set_updated_at();

create function public.prepare_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_status public.session_status;
  v_storage_state public.session_storage_state;
begin
  select ts.status, ts.storage_state
  into v_session_status, v_storage_state
  from public.thought_sessions ts
  where ts.id = new.session_id
  for update;

  if v_session_status is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session_status <> 'ACTIVE' or v_storage_state <> 'TEMPORARY' then
    raise exception 'SESSION_NOT_WRITABLE';
  end if;

  if new.reply_to_message_id is not null and not exists (
    select 1
    from public.messages parent_message
    where parent_message.id = new.reply_to_message_id
      and parent_message.session_id = new.session_id
  ) then
    raise exception 'REPLY_MESSAGE_SESSION_MISMATCH';
  end if;

  if new.role = 'USER' then
    update public.segments segment_row
    set turn_count = segment_row.turn_count + 1
    where segment_row.id = new.segment_id
      and segment_row.session_id = new.session_id
      and segment_row.status = 'ACTIVE'
      and segment_row.turn_count < 20;

    if not found then
      raise exception 'SEGMENT_TURN_LIMIT_REACHED';
    end if;

    update public.thought_sessions
    set last_activity_at = now(),
        temporary_expires_at = now() + interval '24 hours'
    where id = new.session_id;
  elsif not exists (
    select 1
    from public.segments segment_row
    where segment_row.id = new.segment_id
      and segment_row.session_id = new.session_id
      and segment_row.status = 'ACTIVE'
  ) then
    raise exception 'SEGMENT_NOT_ACTIVE';
  end if;

  return new;
end;
$$;

create trigger messages_prepare_insert
before insert on public.messages
for each row execute function public.prepare_message_insert();

create function public.prepare_question_node_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_segment_ordinal smallint;
  v_node_count smallint;
  v_segment_status public.segment_status;
  v_session_status public.session_status;
  v_storage_state public.session_storage_state;
begin
  select
    segment_row.ordinal,
    segment_row.node_count,
    segment_row.status,
    session_row.status,
    session_row.storage_state
  into
    v_segment_ordinal,
    v_node_count,
    v_segment_status,
    v_session_status,
    v_storage_state
  from public.segments segment_row
  join public.thought_sessions session_row on session_row.id = segment_row.session_id
  where segment_row.id = new.segment_id
    and segment_row.session_id = new.session_id
  for update of segment_row;

  if v_segment_ordinal is null then
    raise exception 'SEGMENT_NOT_FOUND';
  end if;

  if v_segment_status <> 'ACTIVE'
    or v_session_status <> 'ACTIVE'
    or v_storage_state <> 'TEMPORARY' then
    raise exception 'SEGMENT_NOT_WRITABLE';
  end if;

  if v_node_count >= 4 then
    raise exception 'SEGMENT_NODE_LIMIT_REACHED';
  end if;

  if new.ordinal <> v_node_count + 1 then
    raise exception 'QUESTION_NODE_ORDINAL_MISMATCH';
  end if;

  if new.kind = 'START' and not (
    v_segment_ordinal = 1
    and v_node_count = 0
    and new.ordinal = 1
  ) then
    raise exception 'START_NODE_ONLY_ALLOWED_FIRST';
  end if;

  if new.kind = 'SHIFT'
    and v_segment_ordinal = 1
    and v_node_count = 0 then
    raise exception 'FIRST_NODE_MUST_BE_START';
  end if;

  update public.segments
  set node_count = node_count + 1
  where id = new.segment_id;

  return new;
end;
$$;

create trigger question_nodes_prepare_insert
before insert on public.question_nodes
for each row execute function public.prepare_question_node_insert();

create function public.validate_segment_anchor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_previous_segment_id uuid;
  v_previous_last_node_id uuid;
begin
  if new.ordinal = 1 then
    return new;
  end if;

  select segment_row.id
  into v_previous_segment_id
  from public.segments segment_row
  where segment_row.session_id = new.session_id
    and segment_row.ordinal = new.ordinal - 1;

  if v_previous_segment_id is null then
    raise exception 'PREVIOUS_SEGMENT_NOT_FOUND';
  end if;

  select node_row.id
  into v_previous_last_node_id
  from public.question_nodes node_row
  where node_row.segment_id = v_previous_segment_id
  order by node_row.ordinal desc
  limit 1;

  if v_previous_last_node_id is null
    or new.anchor_node_id <> v_previous_last_node_id then
    raise exception 'ANCHOR_MUST_BE_PREVIOUS_SEGMENT_LAST_NODE';
  end if;

  return new;
end;
$$;

create constraint trigger segments_validate_anchor
after insert or update of anchor_node_id, ordinal, session_id on public.segments
deferrable initially deferred
for each row execute function public.validate_segment_anchor();

create function public.validate_shift_edge()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from_segment_ordinal smallint;
  v_from_node_ordinal smallint;
  v_to_segment_ordinal smallint;
  v_to_node_ordinal smallint;
  v_to_kind public.question_node_kind;
begin
  select segment_row.ordinal, node_row.ordinal
  into v_from_segment_ordinal, v_from_node_ordinal
  from public.question_nodes node_row
  join public.segments segment_row on segment_row.id = node_row.segment_id
  where node_row.id = new.from_node_id
    and node_row.session_id = new.session_id;

  select segment_row.ordinal, node_row.ordinal, node_row.kind
  into v_to_segment_ordinal, v_to_node_ordinal, v_to_kind
  from public.question_nodes node_row
  join public.segments segment_row on segment_row.id = node_row.segment_id
  where node_row.id = new.to_node_id
    and node_row.session_id = new.session_id;

  if v_to_kind <> 'SHIFT' then
    raise exception 'SHIFT_EDGE_TARGET_MUST_BE_SHIFT_NODE';
  end if;

  if (v_from_segment_ordinal, v_from_node_ordinal)
    >= (v_to_segment_ordinal, v_to_node_ordinal) then
    raise exception 'SHIFT_EDGE_MUST_MOVE_FORWARD';
  end if;

  return new;
end;
$$;

create constraint trigger shift_edges_validate_nodes
after insert or update on public.shift_edges
deferrable initially deferred
for each row execute function public.validate_shift_edge();

create function public.validate_user_message_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role public.message_role;
begin
  select message_row.role
  into v_role
  from public.messages message_row
  where message_row.id = new.message_id;

  if v_role is distinct from 'USER' then
    raise exception 'EVIDENCE_MUST_REFERENCE_USER_MESSAGE';
  end if;

  return new;
end;
$$;

create constraint trigger shift_edge_evidence_validate_message
after insert or update on public.shift_edge_evidence
deferrable initially deferred
for each row execute function public.validate_user_message_evidence();

create constraint trigger clarification_evidence_validate_message
after insert or update on public.clarification_evidence
deferrable initially deferred
for each row execute function public.validate_user_message_evidence();

create function public.prepare_branch_question_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_user_id uuid;
  v_session_status public.session_status;
  v_storage_state public.session_storage_state;
begin
  if new.retention_state <> 'PENDING'
    or new.source_session_id is null
    or new.source_segment_id is null
    or new.source_node_id is null then
    raise exception 'BRANCH_QUESTION_MUST_START_PENDING_WITH_SOURCE';
  end if;

  select session_row.user_id, session_row.status, session_row.storage_state
  into v_session_user_id, v_session_status, v_storage_state
  from public.thought_sessions session_row
  where session_row.id = new.source_session_id
  for update;

  if v_session_user_id is null then
    raise exception 'SOURCE_SESSION_NOT_FOUND';
  end if;

  if new.user_id <> v_session_user_id then
    raise exception 'BRANCH_QUESTION_OWNER_MISMATCH';
  end if;

  if v_session_status <> 'ACTIVE' or v_storage_state <> 'TEMPORARY' then
    raise exception 'SOURCE_SESSION_NOT_WRITABLE';
  end if;

  update public.segments segment_row
  set branch_count = segment_row.branch_count + 1
  where segment_row.id = new.source_segment_id
    and segment_row.session_id = new.source_session_id
    and segment_row.status = 'ACTIVE'
    and segment_row.branch_count < 5;

  if not found then
    raise exception 'SEGMENT_BRANCH_LIMIT_REACHED';
  end if;

  if new.source_node_id is not null and not exists (
    select 1
    from public.question_nodes node_row
    where node_row.id = new.source_node_id
      and node_row.session_id = new.source_session_id
      and node_row.segment_id = new.source_segment_id
  ) then
    raise exception 'BRANCH_SOURCE_NODE_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger branch_questions_prepare_insert
before insert on public.branch_questions
for each row execute function public.prepare_branch_question_insert();

create function public.validate_branch_question_sources()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session_user_id uuid;
begin
  if new.source_session_id is null then
    if new.source_segment_id is not null or new.source_node_id is not null then
      raise exception 'BRANCH_SOURCE_MUST_BE_NULL_TOGETHER';
    end if;
    return new;
  end if;

  select session_row.user_id
  into v_session_user_id
  from public.thought_sessions session_row
  where session_row.id = new.source_session_id;

  if v_session_user_id is null or v_session_user_id <> new.user_id then
    raise exception 'BRANCH_SOURCE_OWNER_MISMATCH';
  end if;

  if new.source_segment_id is not null and not exists (
    select 1
    from public.segments segment_row
    where segment_row.id = new.source_segment_id
      and segment_row.session_id = new.source_session_id
  ) then
    raise exception 'BRANCH_SOURCE_SEGMENT_MISMATCH';
  end if;

  if new.source_node_id is not null and not exists (
    select 1
    from public.question_nodes node_row
    where node_row.id = new.source_node_id
      and node_row.session_id = new.source_session_id
      and (
        new.source_segment_id is null
        or node_row.segment_id = new.source_segment_id
      )
  ) then
    raise exception 'BRANCH_SOURCE_NODE_MISMATCH';
  end if;

  return new;
end;
$$;

create constraint trigger branch_questions_validate_sources
after insert or update of user_id, source_session_id, source_segment_id, source_node_id
on public.branch_questions
deferrable initially deferred
for each row execute function public.validate_branch_question_sources();

create function public.validate_branch_question_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.branch_questions branch_row
    join public.messages message_row on message_row.id = new.message_id
    where branch_row.id = new.branch_question_id
      and message_row.role = 'USER'
      and branch_row.source_session_id = message_row.session_id
  ) then
    raise exception 'BRANCH_EVIDENCE_MUST_REFERENCE_SOURCE_USER_MESSAGE';
  end if;

  return new;
end;
$$;

create constraint trigger branch_question_evidence_validate_message
after insert or update on public.branch_question_evidence
deferrable initially deferred
for each row execute function public.validate_branch_question_evidence();

create function public.validate_session_origin_branch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin_branch_id is not null and not exists (
    select 1
    from public.branch_questions branch_row
    where branch_row.id = new.origin_branch_id
      and branch_row.user_id = new.user_id
      and branch_row.retention_state = 'KEPT'
  ) then
    raise exception 'ORIGIN_BRANCH_MUST_BE_OWNED_AND_KEPT';
  end if;

  return new;
end;
$$;

create constraint trigger thought_sessions_validate_origin_branch
after insert or update of user_id, origin_branch_id on public.thought_sessions
deferrable initially deferred
for each row execute function public.validate_session_origin_branch();

create function public.validate_safety_event_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.session_status;
begin
  select session_row.status
  into v_status
  from public.thought_sessions session_row
  where session_row.id = new.session_id;

  if new.behavior = 'STOP' and v_status <> 'SAFETY_STOPPED' then
    raise exception 'STOP_EVENT_REQUIRES_SAFETY_STOPPED_SESSION';
  end if;

  if new.behavior = 'HANDOFF' and v_status <> 'HANDOFF_STOPPED' then
    raise exception 'HANDOFF_EVENT_REQUIRES_HANDOFF_STOPPED_SESSION';
  end if;

  return new;
end;
$$;

create constraint trigger safety_events_validate_session
after insert or update on public.safety_events
deferrable initially deferred
for each row execute function public.validate_safety_event_session();

revoke all on function public.set_updated_at() from public;
revoke all on function public.prepare_message_insert() from public;
revoke all on function public.prepare_question_node_insert() from public;
revoke all on function public.validate_segment_anchor() from public;
revoke all on function public.validate_shift_edge() from public;
revoke all on function public.validate_user_message_evidence() from public;
revoke all on function public.prepare_branch_question_insert() from public;
revoke all on function public.validate_branch_question_sources() from public;
revoke all on function public.validate_branch_question_evidence() from public;
revoke all on function public.validate_session_origin_branch() from public;
revoke all on function public.validate_safety_event_session() from public;

commit;
