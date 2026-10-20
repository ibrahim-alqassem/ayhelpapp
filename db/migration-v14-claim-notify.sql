-- إشعار المدير عند المطالبة بنشاط عبر الرابط
create or replace function public.claim_listing(tok uuid) returns json
language plpgsql security definer set search_path = public as $$
declare l public.listings; ph text; admin_id uuid;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  select * into l from public.listings where claim_token = tok;
  if l.id is null or l.status not in ('new','sent') then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  ph := public.login_phone(auth.uid());
  if ph is distinct from l.phone then return json_build_object('ok', false, 'reason', 'phone', 'phone', l.phone); end if;
  perform public.merge_listing(l.id, auth.uid());
  select id into admin_id from auth.users where email in ('966566874400@u.ayhelpapp.com', '059716@gmail.com')
   order by (email = '966566874400@u.ayhelpapp.com') desc limit 1;
  if admin_id is not null and admin_id <> auth.uid() then
    insert into public.notifications (user_id, title, body, kind)
    values (admin_id, 'تمت المطالبة بنشاط ✓', l.name || ' — استلم نشاطه وأصبح موثّقاً.', 'claimed');
  end if;
  return json_build_object('ok', true, 'name', l.name);
end $$;
revoke all on function public.claim_listing(uuid) from public, anon;
grant execute on function public.claim_listing(uuid) to authenticated;
select 'ok' as done;
