-- أي هلب: الإبلاغ عن مقدمي الخدمة
-- 1) عمود «موقوف» يخفي مقدم الخدمة عن الخريطة، ولا يستطيع المستخدم تغييره بنفسه
alter table public.profiles add column if not exists suspended boolean not null default false;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select
  using ((is_provider and active and not suspended) or auth.uid() = id);

create or replace function public.protect_suspended() returns trigger
language plpgsql as $$
begin
  if new.suspended is distinct from old.suspended and current_user in ('authenticated', 'anon') then
    new.suspended := old.suspended;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_suspended on public.profiles;
create trigger profiles_protect_suspended before update on public.profiles
  for each row execute function public.protect_suspended();

-- 2) جدول البلاغات
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (reporter_id, provider_id)
);
alter table public.reports enable row level security;
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and provider_id <> auth.uid());
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- 3) عند كل بلاغ: إشعار فوري لمدير التطبيق، وإيقاف تلقائي عند ٣ بلاغات من أشخاص مختلفين
create or replace function public.on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare admin_id uuid; pname text; n int;
begin
  select id into admin_id from auth.users where email = '059716@gmail.com' limit 1;
  select name into pname from public.profiles where id = new.provider_id;
  select count(distinct reporter_id) into n from public.reports where provider_id = new.provider_id and status = 'open';
  if n >= 3 then
    update public.profiles set suspended = true where id = new.provider_id;
  end if;
  if admin_id is not null then
    insert into public.notifications (user_id, title, body)
    values (admin_id, 'بلاغ جديد عن مقدم خدمة',
            coalesce(pname, '') || ' — ' || new.reason || ' (' || n || ' بلاغ)' ||
            case when n >= 3 then ' — تم إخفاؤه تلقائياً' else '' end);
  end if;
  return new;
end $$;
revoke all on function public.on_report() from public, anon, authenticated;
drop trigger if exists reports_after_insert on public.reports;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.on_report();
