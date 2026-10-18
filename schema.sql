-- أي خدمة: قاعدة البيانات (Supabase)
-- شغّل هذا الملف مرة واحدة في SQL Editor

-- 1) ملفات المستخدمين ومقدمي الخدمات
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  is_provider boolean not null default false,
  active boolean not null default true,
  services text[] not null default '{}',
  bio text,
  district text,
  lat double precision,
  lng double precision,
  hours text,
  price_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select
  using ((is_provider and active) or auth.uid() = id);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- إنشاء الملف تلقائياً عند التسجيل (الاسم والجوال من بيانات التسجيل)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) الطلبات
create table if not exists public.requests (
  id bigint generated always as identity primary key,
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  service text not null,
  customer_name text,
  customer_phone text,
  location text,
  lat double precision,
  lng double precision,
  car text,
  note text,
  status text not null default 'new'
    check (status in ('new','accepted','done','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.requests enable row level security;
drop policy if exists "requests_read" on public.requests;
create policy "requests_read" on public.requests for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);
drop policy if exists "requests_insert" on public.requests;
create policy "requests_insert" on public.requests for insert
  with check (auth.uid() = customer_id and customer_id <> provider_id);
drop policy if exists "requests_update" on public.requests;
create policy "requests_update" on public.requests for update
  using (auth.uid() = customer_id or auth.uid() = provider_id);

-- 3) الإشعارات
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  request_id bigint,
  kind text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notes_read" on public.notifications;
create policy "notes_read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notes_update" on public.notifications;
create policy "notes_update" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notes_delete" on public.notifications;
create policy "notes_delete" on public.notifications for delete using (auth.uid() = user_id);

-- إشعار تلقائي عند طلب جديد أو تغيير حالة الطلب
create or replace function public.notify_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if tg_op = 'INSERT' then
    insert into notifications (user_id, title, body, request_id, kind)
    values (new.provider_id, 'طلب جديد #' || new.id,
            coalesce(new.customer_name,'عميل') || ' — ' || coalesce(new.location,''), new.id, 'new');
  elsif new.status is distinct from old.status then
    new.updated_at := now();
    st := case new.status when 'accepted' then 'تم قبول طلبك'
                          when 'done' then 'تم تنفيذ طلبك'
                          when 'declined' then 'اعتذر مقدم الخدمة عن طلبك'
                          when 'cancelled' then 'ألغى العميل الطلب' else new.status end;
    insert into notifications (user_id, title, body, request_id, kind)
    values (case when new.status = 'cancelled' then new.provider_id else new.customer_id end,
            st || ' #' || new.id, null, new.id, new.status);
  end if;
  return new;
end $$;
drop trigger if exists on_request_insert on public.requests;
create trigger on_request_insert after insert on public.requests
  for each row execute function public.notify_request();
drop trigger if exists on_request_update on public.requests;
create trigger on_request_update before update on public.requests
  for each row execute function public.notify_request();

-- 4) حذف الحساب من داخل الموقع
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- 5) التحديث اللحظي
do $$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when others then null; end;
  begin alter publication supabase_realtime add table public.requests; exception when others then null; end;
end $$;


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
