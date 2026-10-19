-- أي هلب: أنشطة يضيفها المدير (غير موثّقة) + رابط المطالبة + توثيق الأرقام
create extension if not exists http with schema extensions;

-- 1) علامة «موثّق» في ملف المستخدم، لا يغيّرها المستخدم بنفسه
alter table public.profiles add column if not exists verified boolean not null default false;
create or replace function public.protect_suspended() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.suspended is distinct from old.suspended then new.suspended := old.suspended; end if;
    if new.verified is distinct from old.verified then new.verified := old.verified; end if;
  end if;
  return new;
end $$;

-- 2) الأنشطة غير الموثّقة
create table if not exists public.listings (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  services text[] not null default '{}',
  district text, bio text, hours text default '24', price_note text,
  lat double precision, lng double precision,
  status text not null default 'new',          -- new | sent | claimed | removed
  consent boolean not null default false,
  source text,
  claim_token uuid not null default gen_random_uuid() unique,
  claimed_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz, claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists listings_phone_open on public.listings (phone) where status in ('new','sent');
alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
grant select (id, name, phone, services, district, bio, hours, price_note, lat, lng, status) on public.listings to anon, authenticated;
drop policy if exists "listings_read" on public.listings;
create policy "listings_read" on public.listings for select using (status in ('new','sent'));

-- 3) طلبات التوثيق والمطالبة (يرسل صاحبها الرمز عبر واتساب)
create table if not exists public.verify_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id bigint references public.listings(id) on delete cascade,
  code text not null,
  status text not null default 'pending',       -- pending | approved | rejected
  created_at timestamptz not null default now()
);
alter table public.verify_requests enable row level security;
drop policy if exists "vr_read_own" on public.verify_requests;
create policy "vr_read_own" on public.verify_requests for select to authenticated using (user_id = auth.uid());

-- رقم الدخول من حساب الجوال
create or replace function public.login_phone(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select substring(email from '^966(5[0-9]{8})@u\.ayhelpapp\.com$') from auth.users where id = uid;
$$;
revoke all on function public.login_phone(uuid) from public, anon, authenticated;

-- نقل بيانات النشاط إلى حساب المستخدم
create or replace function public.merge_listing(lid bigint, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  select * into l from public.listings where id = lid;
  insert into public.profiles (id, name, phone) values (uid, l.name, l.phone) on conflict (id) do nothing;
  update public.profiles set
    is_provider = true, active = true, verified = true,
    name = coalesce(nullif(name, ''), l.name), phone = l.phone,
    services = l.services, district = coalesce(l.district, district), bio = coalesce(l.bio, bio),
    hours = coalesce(l.hours, hours), price_note = coalesce(l.price_note, price_note),
    lat = coalesce(l.lat, lat), lng = coalesce(l.lng, lng)
  where id = uid;
  update public.listings set status = 'claimed', claimed_by = uid, claimed_at = now() where id = lid;
end $$;
revoke all on function public.merge_listing(bigint, uuid) from public, anon, authenticated;

-- معلومات رابط المطالبة (لمن يملك الرابط فقط)
create or replace function public.claim_info(tok uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'name', name, 'phone', phone, 'status', status)
  from public.listings where claim_token = tok;
$$;
grant execute on function public.claim_info(uuid) to anon, authenticated;

-- المطالبة بالرابط: يجب أن يكون رقم الدخول هو رقم النشاط
create or replace function public.claim_listing(tok uuid) returns json
language plpgsql security definer set search_path = public as $$
declare l public.listings; ph text;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  select * into l from public.listings where claim_token = tok;
  if l.id is null or l.status not in ('new','sent') then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  ph := public.login_phone(auth.uid());
  if ph is distinct from l.phone then return json_build_object('ok', false, 'reason', 'phone', 'phone', l.phone); end if;
  perform public.merge_listing(l.id, auth.uid());
  return json_build_object('ok', true, 'name', l.name);
end $$;
revoke all on function public.claim_listing(uuid) from public, anon;
grant execute on function public.claim_listing(uuid) to authenticated;

-- طلب رمز توثيق (lid = null لتوثيق الرقم، أو رقم النشاط للمطالبة به)
create or replace function public.request_verify(lid bigint default null) returns text
language plpgsql security definer set search_path = public as $$
declare c text; admin_id uuid; nm text; lname text;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  select code into c from public.verify_requests
   where user_id = auth.uid() and listing_id is not distinct from lid and status = 'pending' limit 1;
  if c is not null then return c; end if;
  c := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  insert into public.verify_requests (user_id, listing_id, code) values (auth.uid(), lid, c);
  select id into admin_id from auth.users where email in ('966566874400@u.ayhelpapp.com', '059716@gmail.com')
   order by (email = '966566874400@u.ayhelpapp.com') desc limit 1;
  select name into nm from public.profiles where id = auth.uid();
  if lid is not null then select name into lname from public.listings where id = lid; end if;
  if admin_id is not null then
    insert into public.notifications (user_id, title, body, kind)
    values (admin_id, case when lid is null then 'طلب توثيق رقم' else 'طلب ملكية نشاط' end,
            coalesce(nullif(nm, ''), 'مستخدم') || coalesce(' — ' || lname, '') || ' — الرمز ' || c, 'verify');
  end if;
  return c;
end $$;
revoke all on function public.request_verify(bigint) from public, anon;
grant execute on function public.request_verify(bigint) to authenticated;

-- ===== دوال الإدارة =====
create or replace function public.admin_listings() returns setof public.listings
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then return; end if;
  return query select * from public.listings where status <> 'removed' order by created_at desc;
end $$;

create or replace function public.admin_save_listing(j jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare rid bigint; ph text;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  ph := j->>'phone';
  if ph !~ '^5[0-9]{8}$' then return json_build_object('ok', false, 'reason', 'phone'); end if;
  if exists (select 1 from public.profiles p where p.phone = ph and p.is_provider)
     or exists (select 1 from auth.users u where u.email = '966' || ph || '@u.ayhelpapp.com') then
    return json_build_object('ok', false, 'reason', 'registered');
  end if;
  if (j->>'id') is null then
    insert into public.listings (name, phone, services, district, bio, hours, price_note, lat, lng, consent, source)
    values (j->>'name', ph, array(select jsonb_array_elements_text(coalesce(j->'services', '[]'))), j->>'district', j->>'bio',
            coalesce(j->>'hours', '24'), j->>'price_note', (j->>'lat')::float8, (j->>'lng')::float8,
            coalesce((j->>'consent')::boolean, false), coalesce(j->>'source', 'manual'))
    returning id into rid;
  else
    update public.listings set name = j->>'name', phone = ph,
      services = array(select jsonb_array_elements_text(coalesce(j->'services', '[]'))), district = j->>'district', bio = j->>'bio',
      hours = coalesce(j->>'hours', '24'), price_note = j->>'price_note', lat = (j->>'lat')::float8, lng = (j->>'lng')::float8,
      consent = coalesce((j->>'consent')::boolean, consent)
    where id = (j->>'id')::bigint returning id into rid;
  end if;
  return json_build_object('ok', true, 'id', rid);
exception when unique_violation then
  return json_build_object('ok', false, 'reason', 'duplicate');
end $$;

create or replace function public.admin_import_listings(rows jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r jsonb; res json; ins int := 0; skip int := 0;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    res := public.admin_save_listing(r - 'id' || jsonb_build_object('source', 'excel'));
    if (res->>'ok')::boolean then ins := ins + 1; else skip := skip + 1; end if;
  end loop;
  return json_build_object('inserted', ins, 'skipped', skip);
end $$;

create or replace function public.admin_listing_status(lid bigint, st text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  update public.listings set status = st, sent_at = case when st = 'sent' then now() else sent_at end where id = lid;
end $$;

create or replace function public.admin_verify_list() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then return '[]'::json; end if;
  return coalesce((select json_agg(x order by x.created_at desc) from (
    select v.id, v.code, v.created_at, v.listing_id, p.name as user_name, p.phone as contact_phone,
           public.login_phone(v.user_id) as login_phone, l.name as listing_name, l.phone as listing_phone
    from public.verify_requests v
    left join public.profiles p on p.id = v.user_id
    left join public.listings l on l.id = v.listing_id
    where v.status = 'pending') x), '[]'::json);
end $$;

create or replace function public.admin_verify_decide(rid bigint, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.verify_requests;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  select * into v from public.verify_requests where id = rid;
  if v.id is null then return; end if;
  update public.verify_requests set status = case when approve then 'approved' else 'rejected' end where id = rid;
  if approve then
    if v.listing_id is null then
      update public.profiles set verified = true where id = v.user_id;
    else
      perform public.merge_listing(v.listing_id, v.user_id);
    end if;
    insert into public.notifications (user_id, title, body, kind)
    values (v.user_id, case when v.listing_id is null then 'تم توثيق رقمك ✓' else 'تم تأكيد ملكيتك للنشاط ✓' end,
            'تظهر خدمتك الآن بعلامة «موثّق» على الخريطة.', 'verified');
  end if;
end $$;

-- استخراج الإحداثيات من رابط خرائط قوقل (يشمل الروابط المختصرة)
create or replace function public.admin_resolve_map(u text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r extensions.http_response; body text; m text[]; hdr text;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  r := extensions.http_get(u);
  body := coalesce(r.content, '');
  select value into hdr from unnest(r.headers) where lower(field) = 'location' limit 1;
  body := coalesce(hdr, '') || ' ' || left(body, 400000);
  m := regexp_match(body, '!3d(-?[0-9]+\.[0-9]+)!4d(-?[0-9]+\.[0-9]+)');
  if m is null then m := regexp_match(body, '@(-?[0-9]+\.[0-9]+),(-?[0-9]+\.[0-9]+)'); end if;
  if m is null then m := regexp_match(body, 'center=(-?[0-9]+\.[0-9]+)(?:%2C|,)(-?[0-9]+\.[0-9]+)'); end if;
  if m is null then m := regexp_match(body, '[?&](?:q|ll|query)=(-?[0-9]+\.[0-9]+)(?:%2C|,)\+?(-?[0-9]+\.[0-9]+)'); end if;
  if m is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'lat', m[1]::float8, 'lng', m[2]::float8);
exception when others then
  return json_build_object('ok', false, 'err', sqlerrm);
end $$;

revoke all on function public.admin_listings() from public, anon;
revoke all on function public.admin_save_listing(jsonb) from public, anon;
revoke all on function public.admin_import_listings(jsonb) from public, anon;
revoke all on function public.admin_listing_status(bigint, text) from public, anon;
revoke all on function public.admin_verify_list() from public, anon;
revoke all on function public.admin_verify_decide(bigint, boolean) from public, anon;
revoke all on function public.admin_resolve_map(text) from public, anon;
grant execute on function public.admin_listings() to authenticated;
grant execute on function public.admin_save_listing(jsonb) to authenticated;
grant execute on function public.admin_import_listings(jsonb) to authenticated;
grant execute on function public.admin_listing_status(bigint, text) to authenticated;
grant execute on function public.admin_verify_list() to authenticated;
grant execute on function public.admin_verify_decide(bigint, boolean) to authenticated;
grant execute on function public.admin_resolve_map(text) to authenticated;
grant execute on function public.is_app_admin() to authenticated;

select (select count(*) from pg_proc where proname in ('claim_listing','request_verify','admin_listings','admin_save_listing','admin_import_listings','admin_listing_status','admin_verify_list','admin_verify_decide','admin_resolve_map','merge_listing','claim_info','login_phone')) as fns,
       (select count(*) from information_schema.tables where table_name in ('listings','verify_requests')) as tbls;
