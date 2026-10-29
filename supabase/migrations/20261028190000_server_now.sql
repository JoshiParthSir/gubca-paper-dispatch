-- Returns the database's current time so the app can align its countdowns
-- with the clock the server uses to enforce exam windows (a college
-- computer's clock may be wrong or set to another time zone).
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$ SELECT now() $$;

REVOKE ALL ON FUNCTION public.server_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_now() TO authenticated;
