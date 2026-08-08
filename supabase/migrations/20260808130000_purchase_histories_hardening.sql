-- Harden purchase_histories: length caps + immutable user_id on update

alter table public.purchase_histories
  drop constraint if exists purchase_histories_item_name_len;

alter table public.purchase_histories
  add constraint purchase_histories_item_name_len
  check (char_length(item_name) <= 200);

alter table public.purchase_histories
  drop constraint if exists purchase_histories_department_len;

alter table public.purchase_histories
  add constraint purchase_histories_department_len
  check (char_length(department) <= 100);

create or replace function public.purchase_histories_preserve_user_id()
returns trigger
language plpgsql
as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists purchase_histories_preserve_user_id on public.purchase_histories;
create trigger purchase_histories_preserve_user_id
  before update on public.purchase_histories
  for each row
  execute function public.purchase_histories_preserve_user_id();
