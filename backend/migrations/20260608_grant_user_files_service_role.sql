-- The service-role JWT bypasses RLS, but PostgreSQL table privileges are still
-- required. Run this once in the Supabase SQL Editor for the project.

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.user_files to service_role;
