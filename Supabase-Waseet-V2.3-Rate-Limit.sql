-- Waseet Merchant API V2.3 distributed rate limiter for serverless deployments.
-- Additive and reversible: it does not alter orders or shipment data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.waseet_api_rate_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  next_request_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.waseet_api_rate_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_waseet_api_slot(
  p_min_interval_ms integer DEFAULT 1050
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  request_time timestamptz := clock_timestamp();
  reserved_after timestamptz;
  wait_ms integer;
BEGIN
  IF p_min_interval_ms < 1000 OR p_min_interval_ms > 60000 THEN
    RAISE EXCEPTION 'Waseet request interval must be between 1000 and 60000 ms.';
  END IF;

  INSERT INTO public.waseet_api_rate_state (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT next_request_at
  INTO reserved_after
  FROM public.waseet_api_rate_state
  WHERE id = 1
  FOR UPDATE;

  wait_ms := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (reserved_after - request_time)) * 1000)::integer
  );

  UPDATE public.waseet_api_rate_state
  SET
    next_request_at = GREATEST(reserved_after, request_time)
      + (p_min_interval_ms * interval '1 millisecond'),
    updated_at = request_time
  WHERE id = 1;

  RETURN wait_ms;
END
$function$;

CREATE OR REPLACE FUNCTION public.replace_waseet_metadata_snapshot(
  p_cities jsonb,
  p_regions jsonb,
  p_package_sizes jsonb,
  p_statuses jsonb,
  p_fetched_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cities_count integer;
  regions_count integer;
  package_sizes_count integer;
  statuses_count integer;
BEGIN
  IF jsonb_typeof(p_cities) <> 'array'
    OR jsonb_typeof(p_regions) <> 'array'
    OR jsonb_typeof(p_package_sizes) <> 'array'
    OR jsonb_typeof(p_statuses) <> 'array' THEN
    RAISE EXCEPTION 'Waseet metadata snapshots must be JSON arrays.';
  END IF;

  cities_count := jsonb_array_length(p_cities);
  regions_count := jsonb_array_length(p_regions);
  package_sizes_count := jsonb_array_length(p_package_sizes);
  statuses_count := jsonb_array_length(p_statuses);

  IF cities_count < 1 OR regions_count < 1
    OR package_sizes_count < 1 OR statuses_count < 1 THEN
    RAISE EXCEPTION 'Waseet metadata snapshot cannot contain an empty catalog.';
  END IF;

  INSERT INTO public.waseet_cities (id, name, active, fetched_at)
  SELECT city.id, BTRIM(city.name), true, p_fetched_at
  FROM jsonb_to_recordset(p_cities) AS city(id bigint, name text)
  WHERE NULLIF(BTRIM(city.name), '') IS NOT NULL
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    active = true,
    fetched_at = EXCLUDED.fetched_at;

  INSERT INTO public.waseet_regions (id, city_id, name, active, fetched_at)
  SELECT region.id, region.city_id, BTRIM(region.name), true, p_fetched_at
  FROM jsonb_to_recordset(p_regions) AS region(id bigint, city_id bigint, name text)
  WHERE NULLIF(BTRIM(region.name), '') IS NOT NULL
  ON CONFLICT (id) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    active = true,
    fetched_at = EXCLUDED.fetched_at;

  INSERT INTO public.waseet_package_sizes (id, name, active, fetched_at)
  SELECT package_size.id, BTRIM(package_size.name), true, p_fetched_at
  FROM jsonb_to_recordset(p_package_sizes) AS package_size(id bigint, name text)
  WHERE NULLIF(BTRIM(package_size.name), '') IS NOT NULL
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    active = true,
    fetched_at = EXCLUDED.fetched_at;

  INSERT INTO public.waseet_status_catalog (id, name, active, fetched_at)
  SELECT status.id, BTRIM(status.name), true, p_fetched_at
  FROM jsonb_to_recordset(p_statuses) AS status(id text, name text)
  WHERE NULLIF(BTRIM(status.id), '') IS NOT NULL
    AND NULLIF(BTRIM(status.name), '') IS NOT NULL
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    active = true,
    fetched_at = EXCLUDED.fetched_at;

  UPDATE public.waseet_regions SET active = false WHERE fetched_at < p_fetched_at;
  UPDATE public.waseet_cities SET active = false WHERE fetched_at < p_fetched_at;
  UPDATE public.waseet_package_sizes SET active = false WHERE fetched_at < p_fetched_at;
  UPDATE public.waseet_status_catalog SET active = false WHERE fetched_at < p_fetched_at;

  INSERT INTO public.waseet_metadata_runs (
    fetched_at, cities_count, regions_count, package_sizes_count,
    statuses_count, success, error_message
  ) VALUES (
    p_fetched_at, cities_count, regions_count, package_sizes_count,
    statuses_count, true, ''
  );
END
$function$;

ALTER TABLE public.waseet_api_rate_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.waseet_api_rate_state FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_waseet_api_slot(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_waseet_metadata_snapshot(
  jsonb, jsonb, jsonb, jsonb, timestamptz
) FROM PUBLIC;

DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.waseet_api_rate_state FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.waseet_api_rate_state FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.waseet_api_rate_state TO service_role;
    GRANT EXECUTE ON FUNCTION public.reserve_waseet_api_slot(integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.replace_waseet_metadata_snapshot(
      jsonb, jsonb, jsonb, jsonb, timestamptz
    ) TO service_role;
  END IF;
END
$grants$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Rollback, only if no application version still calls the function:
-- DROP FUNCTION IF EXISTS public.reserve_waseet_api_slot(integer);
-- DROP TABLE IF EXISTS public.waseet_api_rate_state;
