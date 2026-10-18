-- أي هلب: مراجعة البلاغات من داخل التطبيق + فتح الإشعار على الطلب أو البلاغ مباشرة
alter table public.notifications add column if not exists report_id bigint;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select email from auth.users where id = auth.uid()) = '059716@gmail.com', false);
$$;

-- إشعار البلاغ يحمل رقم البلاغ وسببه وتفاصيله
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
    insert into public.notifications (user_id, title, body, kind, report_id)
    values (admin_id, 'بلاغ جديد عن ' || coalesce(nullif(pname, ''), 'مقدم خدمة'),
            new.reason || coalesce(': ' || left(new.details, 120), '') ||
            ' — البلاغ رقم ' || n || case when n >= 3 then ' (أُخفي تلقائياً)' else '' end,
            'report', new.id);
  end if;
  return new;
end $$;

create or replace function public.admin_report(rid bigint) returns json
language plpgsql stable security definer set search_path = public as $$
declare r public.reports; res json;
begin
  if not public.is_app_admin() then return null; end if;
  select * into r from public.reports where id = rid;
  if r.id is null then return null; end if;
  select json_build_object(
    'report', to_json(r),
    'provider', (select json_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'district', p.district,
                                         'suspended', p.suspended, 'active', p.active)
                 from public.profiles p where p.id = r.provider_id),
    'reporter', (select coalesce(nullif(p.name, ''), '') || ' (' || u.email || ')'
                 from auth.users u left join public.profiles p on p.id = u.id where u.id = r.reporter_id),
    'reports', (select json_agg(json_build_object('reason', x.reason, 'details', x.details, 'status', x.status) order by x.created_at desc)
                from public.reports x where x.provider_id = r.provider_id)
  ) into res;
  return res;
end $$;

create or replace function public.admin_set_suspended(pid uuid, val boolean, rid bigint default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  update public.profiles set suspended = val where id = pid;
  update public.reports set status = case when val then 'actioned' else 'dismissed' end
   where provider_id = pid and status = 'open';
end $$;

create or replace function public.admin_close_report(rid bigint, st text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  update public.reports set status = st where id = rid;
end $$;

revoke all on function public.admin_report(bigint) from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean, bigint) from public, anon;
revoke all on function public.admin_close_report(bigint, text) from public, anon;
grant execute on function public.admin_report(bigint) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, bigint) to authenticated;
grant execute on function public.admin_close_report(bigint, text) to authenticated;

-- الإشعار الفوري يفتح الطلب أو البلاغ مباشرة عند الضغط عليه
create or replace function public.push_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text;
  t_en text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'onesignal_rest_key' limit 1;
  if k is null then return new; end if;

  t_en := case new.kind
            when 'new' then 'New request'
            when 'accepted' then 'Your request was accepted'
            when 'done' then 'Your request was completed'
            when 'declined' then 'The provider declined your request'
            when 'cancelled' then 'The customer cancelled'
            when 'report' then 'New report about a provider'
            else null end;
  t_en := coalesce(t_en || coalesce(' #' || new.request_id, ''), new.title);

  perform net.http_post(
    url := 'https://api.onesignal.com/notifications?c=push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Key ' || k),
    body := jsonb_build_object(
      'app_id', 'd9816bc6-3a0b-422c-8871-d630e240fc2e',
      'target_channel', 'push',
      'include_aliases', jsonb_build_object('external_id', jsonb_build_array(new.user_id::text)),
      'headings', jsonb_build_object('en', t_en, 'ar', new.title),
      'contents', jsonb_build_object(
        'en', coalesce(new.body, 'Open Ay Help for details'),
        'ar', coalesce(new.body, 'افتح أي هلب للتفاصيل')),
      'url', 'https://ayhelpapp.com/' || case
               when new.report_id is not null then '?report=' || new.report_id
               when new.request_id is not null then '?req=' || new.request_id
               else '' end
    )
  );
  return new;
exception when others then
  return new;
end $$;

-- تحديث إشعارات البلاغات السابقة لتفتح البلاغ
update public.notifications n set kind = 'report', report_id = r.id
  from public.reports r
 where n.kind is null and n.title like 'بلاغ جديد%' and n.report_id is null
   and n.created_at between r.created_at - interval '5 seconds' and r.created_at + interval '5 seconds';

select (select count(*) from public.notifications where kind = 'report') as report_notes,
       (select count(*) from pg_proc where proname in ('admin_report','admin_set_suspended','admin_close_report','is_app_admin')) as fns;
