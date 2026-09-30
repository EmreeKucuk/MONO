-- Run once in Supabase SQL Editor. Every account has its own private workspace.
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"widgets":[],"events":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint valid_workspace check (jsonb_typeof(state) is not distinct from 'object' and jsonb_typeof(state->'widgets') is not distinct from 'array' and jsonb_typeof(state->'events') is not distinct from 'array')
);
alter table public.workspaces add column if not exists revision bigint not null default 0;
alter table public.workspaces drop constraint if exists valid_workspace;
alter table public.workspaces add constraint valid_workspace check (jsonb_typeof(state) is not distinct from 'object' and jsonb_typeof(state->'widgets') is not distinct from 'array' and jsonb_typeof(state->'events') is not distinct from 'array');
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;
drop policy if exists "Read own workspace" on public.workspaces;
drop policy if exists "Insert own workspace" on public.workspaces;
drop policy if exists "Update own workspace" on public.workspaces;
drop policy if exists "Delete own workspace" on public.workspaces;
create policy "Read own workspace" on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workspace" on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own workspace" on public.workspaces for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_workspace_cas(expected_revision bigint, next_state jsonb)
returns table(new_revision bigint)
language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(next_state) is distinct from 'object' or jsonb_typeof(next_state->'widgets') is distinct from 'array' or jsonb_typeof(next_state->'events') is distinct from 'array' then
    raise exception 'Invalid workspace';
  end if;
  if expected_revision = 0 then
    insert into public.workspaces(user_id,state,revision,updated_at)
    values(auth.uid(),next_state,1,now()) on conflict (user_id) do nothing
    returning revision into new_revision;
    if found then return next; end if;
  end if;
  update public.workspaces
  set state=next_state,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and revision=expected_revision
  returning revision into new_revision;
  if found then return next; end if;
end;
$$;
revoke all on function public.save_workspace_cas(bigint,jsonb) from public, anon;
grant execute on function public.save_workspace_cas(bigint,jsonb) to authenticated;
