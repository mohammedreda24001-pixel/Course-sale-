-- ============================================================================
-- Course-sale -> Waseet-native full migration
-- Version: 2026-08-16
-- Target: Supabase PostgreSQL / SQL Editor
--
-- IMPORTANT
-- 1) Take a database backup before running this file.
-- 2) Run the whole file once as one SQL Editor operation.
-- 3) Old shipping values are preserved inside orders.legacy_shipping_data.
-- 4) Legacy orders are NEVER auto-dispatched or silently mapped to Waseet IDs.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- --------------------------------------------------------------------------
-- 1. Core tables required by Course-sale
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  username varchar(100) UNIQUE NOT NULL,
  "passwordHash" varchar(256) NOT NULL,
  role varchar(50) NOT NULL CHECK (role IN ('admin', 'agent')),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_types (
  id serial PRIMARY KEY,
  name varchar(256) UNIQUE NOT NULL,
  "defaultPrice" numeric NOT NULL DEFAULT 0
);

INSERT INTO public.course_types (name, "defaultPrice")
VALUES
  ('دورة الأحياء', 250),
  ('دورة الكيمياء', 250),
  ('دورة الفيزياء', 250)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY,
  "requestTemplate" text NOT NULL DEFAULT '',
  "confirmationTemplate" text NOT NULL DEFAULT '',
  "defaultOrderNote" text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.orders (
  id bigserial PRIMARY KEY,
  "studentName" varchar(256) NOT NULL,
  phone1 varchar(50) NOT NULL,
  phone2 varchar(50),
  "StudentVaultCode_ID" varchar(100) NOT NULL DEFAULT 'PENDING',
  "StudentVaultCode_Serial" varchar(100) NOT NULL DEFAULT 'PENDING',
  "receiptNumber" varchar(100),
  "courseTypeId" integer REFERENCES public.course_types(id) ON DELETE SET NULL,
  "createdById" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  "createdByUsername" varchar(100),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  waseet_city_id bigint,
  waseet_city_name text,
  waseet_region_id bigint,
  waseet_region_name text,
  address_details text NOT NULL DEFAULT '',
  location_hint text NOT NULL DEFAULT '',
  waseet_package_size_id bigint,
  waseet_package_size_name text,
  collection_amount bigint NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 1,
  replacement boolean NOT NULL DEFAULT false,
  goods_type varchar(256) NOT NULL DEFAULT 'كورس تعليمي',
  merchant_notes text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  telegram_username varchar(100) NOT NULL DEFAULT '',

  internal_order_state varchar(32) NOT NULL DEFAULT 'ready',
  waseet_sync_state varchar(32) NOT NULL DEFAULT 'pending',
  waseet_order_id text,
  waseet_qr_id text,
  waseet_qr_link text,
  waseet_status_id text,
  waseet_status_text text,
  waseet_issue_notes text,
  waseet_last_error text NOT NULL DEFAULT '',
  waseet_last_synced_at timestamptz,
  waseet_dispatched_at timestamptz,
  waseet_company_price bigint,
  waseet_city_fees bigint,
  waseet_merchant_price bigint,
  waseet_cash_fee bigint,
  waseet_delivery_price bigint,
  waseet_invoice_id text,
  waseet_raw jsonb,
  waseet_payload_hash text,
  waseet_dispatch_key uuid,
  legacy_shipping_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.codes (
  id uuid PRIMARY KEY,
  "codeValue" varchar(100) UNIQUE NOT NULL,
  "serialNumber" varchar(100) NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used')),
  "orderId" bigint REFERENCES public.orders(id) ON DELETE SET NULL,
  "assignedAt" timestamptz,
  "courseTypeId" integer REFERENCES public.course_types(id) ON DELETE SET NULL,
  "isDisabled" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Existing installations can be older than the fresh schema above. Ensure all
-- fields used by the new application exist before backfilling and cleanup.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS "studentName" varchar(256),
  ADD COLUMN IF NOT EXISTS phone1 varchar(50),
  ADD COLUMN IF NOT EXISTS phone2 varchar(50),
  ADD COLUMN IF NOT EXISTS "StudentVaultCode_ID" varchar(100) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "StudentVaultCode_Serial" varchar(100) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "receiptNumber" varchar(100),
  ADD COLUMN IF NOT EXISTS "courseTypeId" integer,
  ADD COLUMN IF NOT EXISTS "createdById" uuid,
  ADD COLUMN IF NOT EXISTS "createdByUsername" varchar(100),
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS waseet_city_id bigint,
  ADD COLUMN IF NOT EXISTS waseet_city_name text,
  ADD COLUMN IF NOT EXISTS waseet_region_id bigint,
  ADD COLUMN IF NOT EXISTS waseet_region_name text,
  ADD COLUMN IF NOT EXISTS address_details text DEFAULT '',
  ADD COLUMN IF NOT EXISTS location_hint text DEFAULT '',
  ADD COLUMN IF NOT EXISTS waseet_package_size_id bigint,
  ADD COLUMN IF NOT EXISTS waseet_package_size_name text,
  ADD COLUMN IF NOT EXISTS collection_amount bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS replacement boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS goods_type varchar(256) DEFAULT 'كورس تعليمي',
  ADD COLUMN IF NOT EXISTS merchant_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_username varchar(100) DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_order_state varchar(32) DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS waseet_sync_state varchar(32) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS waseet_order_id text,
  ADD COLUMN IF NOT EXISTS waseet_qr_id text,
  ADD COLUMN IF NOT EXISTS waseet_qr_link text,
  ADD COLUMN IF NOT EXISTS waseet_status_id text,
  ADD COLUMN IF NOT EXISTS waseet_status_text text,
  ADD COLUMN IF NOT EXISTS waseet_issue_notes text,
  ADD COLUMN IF NOT EXISTS waseet_last_error text DEFAULT '',
  ADD COLUMN IF NOT EXISTS waseet_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS waseet_dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS waseet_company_price bigint,
  ADD COLUMN IF NOT EXISTS waseet_city_fees bigint,
  ADD COLUMN IF NOT EXISTS waseet_merchant_price bigint,
  ADD COLUMN IF NOT EXISTS waseet_cash_fee bigint,
  ADD COLUMN IF NOT EXISTS waseet_delivery_price bigint,
  ADD COLUMN IF NOT EXISTS waseet_invoice_id text,
  ADD COLUMN IF NOT EXISTS waseet_raw jsonb,
  ADD COLUMN IF NOT EXISTS waseet_payload_hash text,
  ADD COLUMN IF NOT EXISTS waseet_dispatch_key uuid,
  ADD COLUMN IF NOT EXISTS legacy_shipping_data jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.codes
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "isDisabled" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "courseTypeId" integer,
  ADD COLUMN IF NOT EXISTS "assignedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "orderId" bigint;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS "defaultOrderNote" text DEFAULT '';

-- --------------------------------------------------------------------------
-- 2. Waseet metadata, history and audit tables
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.waseet_cities (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waseet_regions (
  id bigint PRIMARY KEY,
  city_id bigint NOT NULL REFERENCES public.waseet_cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waseet_package_sizes (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waseet_status_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waseet_metadata_runs (
  id bigserial PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  cities_count integer NOT NULL DEFAULT 0,
  regions_count integer NOT NULL DEFAULT 0,
  package_sizes_count integer NOT NULL DEFAULT 0,
  statuses_count integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_message text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.waseet_status_history (
  id bigserial PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status_id text,
  status_id text,
  status_text text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waseet_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint REFERENCES public.orders(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_username text NOT NULL DEFAULT '',
  success boolean NOT NULL,
  message text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waseet_api_log (
  id bigserial PRIMARY KEY,
  order_id bigint REFERENCES public.orders(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method varchar(12) NOT NULL,
  success boolean NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text NOT NULL DEFAULT '',
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 3. Preserve legacy order data before any destructive cleanup
-- --------------------------------------------------------------------------

UPDATE public.orders AS current_order
SET legacy_shipping_data = jsonb_build_object(
  'migration_version', 'waseet-native-2026-08-16',
  'migrated_at', now(),
  'snapshot', to_jsonb(current_order)
    - 'legacy_shipping_data'
    - 'waseet_sticker_url'
    - 'waseet_qr_link'
    - 'waseet_raw',
  'redacted_fields', jsonb_build_array('waseet_sticker_url', 'waseet_qr_link', 'waseet_raw')
)
WHERE NOT (COALESCE(current_order.legacy_shipping_data, '{}'::jsonb) ? 'migration_version');

-- One-time, explicit backfill from the old model. Text names are retained only
-- to help manual review. No Waseet city/region/package ID is guessed.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'province'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET waseet_city_name = NULLIF(BTRIM(province::text), '')
      WHERE waseet_city_name IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'region'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET waseet_region_name = NULLIF(BTRIM(region::text), '')
      WHERE waseet_region_name IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'address'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET address_details = COALESCE(NULLIF(BTRIM(address::text), ''), address_details, '')
      WHERE COALESCE(address_details, '') = ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'landmark'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET location_hint = COALESCE(NULLIF(BTRIM(landmark::text), ''), location_hint, '')
      WHERE COALESCE(location_hint, '') = ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'packageSize'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET waseet_package_size_name = NULLIF(BTRIM("packageSize"::text), '')
      WHERE waseet_package_size_name IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'totalPrice'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET collection_amount = CASE
        WHEN COALESCE("totalPrice", 0) <= 0 THEN COALESCE(collection_amount, 0)
        WHEN "totalPrice" < 10000 THEN ROUND("totalPrice" * 1000)::bigint
        ELSE ROUND("totalPrice")::bigint
      END
      WHERE COALESCE(collection_amount, 0) = 0
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'piecesCount'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET items_count = GREATEST(1, COALESCE("piecesCount"::integer, 1))
      WHERE COALESCE(items_count, 1) = 1
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'hasReturn'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET replacement = LOWER(COALESCE("hasReturn"::text, '')) IN ('نعم', 'yes', 'true', '1')
      WHERE replacement = false
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'goodsType'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET goods_type = COALESCE(NULLIF(BTRIM("goodsType"::text), ''), goods_type, 'كورس تعليمي')
      WHERE COALESCE(goods_type, '') IN ('', 'كورس تعليمي')
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'notes'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET merchant_notes = COALESCE(NULLIF(BTRIM(notes::text), ''), merchant_notes, '')
      WHERE COALESCE(merchant_notes, '') = ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'returnDescription'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET merchant_notes = CONCAT_WS(E'\n', NULLIF(BTRIM(merchant_notes), ''),
        CASE WHEN NULLIF(BTRIM("returnDescription"::text), '') IS NOT NULL
          THEN 'وصف الاستبدال التاريخي: ' || BTRIM("returnDescription"::text)
          ELSE NULL END)
      WHERE NULLIF(BTRIM("returnDescription"::text), '') IS NOT NULL
        AND merchant_notes NOT LIKE '%وصف الاستبدال التاريخي:%'
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'internalNotes'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET internal_notes = COALESCE(NULLIF(BTRIM("internalNotes"::text), ''), internal_notes, '')
      WHERE COALESCE(internal_notes, '') = ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'telegramUsername'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET telegram_username = LTRIM(COALESCE(NULLIF(BTRIM("telegramUsername"::text), ''), telegram_username, ''), '@')
      WHERE COALESCE(telegram_username, '') = ''
    $sql$;
  END IF;
END
$migration$;

UPDATE public.orders
SET
  "studentName" = COALESCE(NULLIF(BTRIM("studentName"), ''), 'طلب تاريخي #' || id::text),
  phone1 = COALESCE(NULLIF(BTRIM(phone1), ''), ''),
  phone2 = NULLIF(BTRIM(phone2), ''),
  "receiptNumber" = NULLIF(BTRIM("receiptNumber"), ''),
  "StudentVaultCode_ID" = COALESCE(NULLIF(BTRIM("StudentVaultCode_ID"), ''), 'PENDING'),
  "StudentVaultCode_Serial" = COALESCE(NULLIF(BTRIM("StudentVaultCode_Serial"), ''), 'PENDING'),
  "createdByUsername" = COALESCE("createdByUsername", ''),
  address_details = COALESCE(address_details, ''),
  location_hint = COALESCE(location_hint, ''),
  collection_amount = GREATEST(0, COALESCE(collection_amount, 0)),
  items_count = GREATEST(1, COALESCE(items_count, 1)),
  replacement = COALESCE(replacement, false),
  goods_type = COALESCE(NULLIF(BTRIM(goods_type), ''), 'كورس تعليمي'),
  merchant_notes = COALESCE(merchant_notes, ''),
  internal_notes = COALESCE(internal_notes, ''),
  telegram_username = LTRIM(COALESCE(telegram_username, ''), '@'),
  internal_order_state = CASE
    WHEN internal_order_state IN ('draft', 'ready', 'archived') THEN internal_order_state
    ELSE 'ready'
  END,
  waseet_sync_state = CASE
    WHEN waseet_city_id IS NULL
      OR waseet_region_id IS NULL
      OR waseet_package_size_id IS NULL
      OR COALESCE(BTRIM(address_details), '') = ''
      OR COALESCE(collection_amount, 0) <= 0
      OR COALESCE(BTRIM(phone1), '') !~ '^[+]9647[0-9]{9}$'
      OR "courseTypeId" IS NULL
      OR (waseet_sync_state = 'synced' AND waseet_order_id IS NULL AND waseet_qr_id IS NULL)
      THEN 'manual_review'
    WHEN waseet_sync_state IN ('not_ready', 'pending', 'syncing', 'synced', 'failed', 'needs_verification', 'manual_review')
      THEN waseet_sync_state
    ELSE 'pending'
  END,
  waseet_order_id = NULLIF(BTRIM(waseet_order_id), ''),
  waseet_qr_id = NULLIF(BTRIM(waseet_qr_id), ''),
  -- QR links returned by Waseet may include a merchant token. Retain only
  -- the tokenless URL; the server injects a fresh token when proxying the PDF.
  waseet_qr_link = NULLIF(
    regexp_replace(
      regexp_replace(BTRIM(waseet_qr_link), '([?&])token=[^&]*&?', E'\\1', 'gi'),
      '[?&]+$', '', 'g'
    ),
    ''
  ),
  waseet_status_id = NULLIF(BTRIM(waseet_status_id), ''),
  waseet_payload_hash = NULLIF(BTRIM(waseet_payload_hash), ''),
  waseet_last_error = COALESCE(waseet_last_error, ''),
  waseet_raw = CASE
    WHEN jsonb_typeof(waseet_raw) = 'object' THEN waseet_raw - 'qr_link' - 'token'
    ELSE waseet_raw
  END,
  legacy_shipping_data = COALESCE(legacy_shipping_data, '{}'::jsonb),
  "createdAt" = COALESCE("createdAt", now()),
  updated_at = COALESCE(updated_at, now());

-- Duplicate active Waseet identifiers are unsafe. Keep the first and move any
-- later duplicate to manual review while preserving the original snapshot.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY waseet_qr_id ORDER BY id) AS duplicate_rank
  FROM public.orders
  WHERE waseet_qr_id IS NOT NULL
)
UPDATE public.orders AS target
SET
  waseet_qr_id = NULL,
  waseet_order_id = NULL,
  waseet_sync_state = 'manual_review',
  waseet_last_error = 'تم اكتشاف معرف Waseet مكرر أثناء الترحيل؛ يلزم تحقق يدوي.'
FROM ranked
WHERE target.id = ranked.id AND ranked.duplicate_rank > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY waseet_order_id ORDER BY id) AS duplicate_rank
  FROM public.orders
  WHERE waseet_order_id IS NOT NULL
)
UPDATE public.orders AS target
SET
  waseet_qr_id = NULL,
  waseet_order_id = NULL,
  waseet_sync_state = 'manual_review',
  waseet_last_error = 'تم اكتشاف رقم طلب Waseet مكرر أثناء الترحيل؛ يلزم تحقق يدوي.'
FROM ranked
WHERE target.id = ranked.id AND ranked.duplicate_rank > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "receiptNumber" ORDER BY id) AS duplicate_rank
  FROM public.orders
  WHERE NULLIF(BTRIM("receiptNumber"), '') IS NOT NULL
    AND internal_order_state <> 'archived'
)
UPDATE public.orders AS target
SET
  "receiptNumber" = NULL,
  waseet_sync_state = 'manual_review',
  waseet_last_error = 'تم اكتشاف رقم وصل مكرر أثناء الترحيل؛ حُفظت القيمة الأصلية في legacy_shipping_data.'
FROM ranked
WHERE target.id = ranked.id AND ranked.duplicate_rank > 1;

-- --------------------------------------------------------------------------
-- 4. Remove obsolete RPCs and shipping columns after preserving their values
-- --------------------------------------------------------------------------

DO $drop_old_functions$
DECLARE
  function_to_drop record;
BEGIN
  FOR function_to_drop IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_order_atomic',
        'create_waseet_order_atomic',
        'claim_waseet_dispatch',
        'archive_waseet_order',
        'preview_next_receipt_number'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', function_to_drop.signature);
  END LOOP;
END
$drop_old_functions$;

DROP INDEX IF EXISTS public.idx_orders_province;
DROP INDEX IF EXISTS public.idx_orders_region;
DROP INDEX IF EXISTS public.idx_orders_status;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS province CASCADE,
  DROP COLUMN IF EXISTS region CASCADE,
  DROP COLUMN IF EXISTS address CASCADE,
  DROP COLUMN IF EXISTS landmark CASCADE,
  DROP COLUMN IF EXISTS "packageSize" CASCADE,
  DROP COLUMN IF EXISTS "totalPrice" CASCADE,
  DROP COLUMN IF EXISTS "basePrice" CASCADE,
  DROP COLUMN IF EXISTS "deliveryFee" CASCADE,
  DROP COLUMN IF EXISTS "piecesCount" CASCADE,
  DROP COLUMN IF EXISTS "hasReturn" CASCADE,
  DROP COLUMN IF EXISTS "goodsType" CASCADE,
  DROP COLUMN IF EXISTS "returnDescription" CASCADE,
  DROP COLUMN IF EXISTS "ShipmentTrackingCode" CASCADE,
  DROP COLUMN IF EXISTS notes CASCADE,
  DROP COLUMN IF EXISTS "internalNotes" CASCADE,
  DROP COLUMN IF EXISTS "telegramUsername" CASCADE,
  DROP COLUMN IF EXISTS "statusId" CASCADE,
  DROP COLUMN IF EXISTS waseet_tracking_number CASCADE,
  DROP COLUMN IF EXISTS waseet_sticker_url CASCADE,
  DROP COLUMN IF EXISTS waseet_sync_status CASCADE,
  DROP COLUMN IF EXISTS waseet_sync_error CASCADE,
  DROP COLUMN IF EXISTS waseet_synced_at CASCADE;

DROP TABLE IF EXISTS public.order_statuses CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- --------------------------------------------------------------------------
-- 5. Defaults, constraints and indexes for the Waseet-native model
-- --------------------------------------------------------------------------

ALTER TABLE public.orders
  ALTER COLUMN "studentName" SET NOT NULL,
  ALTER COLUMN phone1 SET NOT NULL,
  ALTER COLUMN "StudentVaultCode_ID" SET DEFAULT 'PENDING',
  ALTER COLUMN "StudentVaultCode_ID" SET NOT NULL,
  ALTER COLUMN "StudentVaultCode_Serial" SET DEFAULT 'PENDING',
  ALTER COLUMN "StudentVaultCode_Serial" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN address_details SET DEFAULT '',
  ALTER COLUMN address_details SET NOT NULL,
  ALTER COLUMN location_hint SET DEFAULT '',
  ALTER COLUMN location_hint SET NOT NULL,
  ALTER COLUMN collection_amount SET DEFAULT 0,
  ALTER COLUMN collection_amount SET NOT NULL,
  ALTER COLUMN items_count SET DEFAULT 1,
  ALTER COLUMN items_count SET NOT NULL,
  ALTER COLUMN replacement SET DEFAULT false,
  ALTER COLUMN replacement SET NOT NULL,
  ALTER COLUMN goods_type SET DEFAULT 'كورس تعليمي',
  ALTER COLUMN goods_type SET NOT NULL,
  ALTER COLUMN merchant_notes SET DEFAULT '',
  ALTER COLUMN merchant_notes SET NOT NULL,
  ALTER COLUMN internal_notes SET DEFAULT '',
  ALTER COLUMN internal_notes SET NOT NULL,
  ALTER COLUMN telegram_username SET DEFAULT '',
  ALTER COLUMN telegram_username SET NOT NULL,
  ALTER COLUMN internal_order_state SET DEFAULT 'ready',
  ALTER COLUMN internal_order_state SET NOT NULL,
  ALTER COLUMN waseet_sync_state SET DEFAULT 'pending',
  ALTER COLUMN waseet_sync_state SET NOT NULL,
  ALTER COLUMN waseet_last_error SET DEFAULT '',
  ALTER COLUMN waseet_last_error SET NOT NULL,
  ALTER COLUMN legacy_shipping_data SET DEFAULT '{}'::jsonb,
  ALTER COLUMN legacy_shipping_data SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_internal_state_check,
  DROP CONSTRAINT IF EXISTS orders_waseet_sync_state_check,
  DROP CONSTRAINT IF EXISTS orders_collection_amount_check,
  DROP CONSTRAINT IF EXISTS orders_items_count_check,
  DROP CONSTRAINT IF EXISTS orders_payload_hash_check,
  DROP CONSTRAINT IF EXISTS orders_phone1_waseet_format_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_internal_state_check
    CHECK (internal_order_state IN ('draft', 'ready', 'archived')),
  ADD CONSTRAINT orders_waseet_sync_state_check
    CHECK (waseet_sync_state IN ('not_ready', 'pending', 'syncing', 'synced', 'failed', 'needs_verification', 'manual_review')),
  ADD CONSTRAINT orders_collection_amount_check
    CHECK (collection_amount >= 0),
  ADD CONSTRAINT orders_items_count_check
    CHECK (items_count >= 1),
  ADD CONSTRAINT orders_payload_hash_check
    CHECK (waseet_payload_hash IS NULL OR waseet_payload_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT orders_phone1_waseet_format_check
    CHECK (waseet_sync_state = 'manual_review' OR phone1 ~ '^[+]9647[0-9]{9}$');

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_codes_status_course ON public.codes(status, "courseTypeId", "isDisabled");
CREATE INDEX IF NOT EXISTS idx_codes_order_id ON public.codes("orderId");
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_orders_course_type ON public.orders("courseTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_waseet_city ON public.orders(waseet_city_id);
CREATE INDEX IF NOT EXISTS idx_orders_waseet_region ON public.orders(waseet_region_id);
CREATE INDEX IF NOT EXISTS idx_orders_waseet_sync_state ON public.orders(waseet_sync_state);
CREATE INDEX IF NOT EXISTS idx_orders_waseet_status ON public.orders(waseet_status_id);
CREATE INDEX IF NOT EXISTS idx_orders_waseet_qr ON public.orders(waseet_qr_id);
CREATE INDEX IF NOT EXISTS idx_orders_waseet_order_id ON public.orders(waseet_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_receipt ON public.orders("receiptNumber");
CREATE INDEX IF NOT EXISTS idx_orders_payload_hash ON public.orders(waseet_payload_hash);
CREATE INDEX IF NOT EXISTS idx_orders_student_name_trgm ON public.orders USING gin ("studentName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_phone1_trgm ON public.orders USING gin (phone1 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_waseet_regions_city ON public.waseet_regions(city_id, active, name);
CREATE INDEX IF NOT EXISTS idx_waseet_status_history_order ON public.waseet_status_history(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waseet_audit_order ON public.waseet_audit_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waseet_api_log_order ON public.waseet_api_log(order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_waseet_qr_id
  ON public.orders(waseet_qr_id) WHERE waseet_qr_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_waseet_order_id
  ON public.orders(waseet_order_id) WHERE waseet_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_active_receipt
  ON public.orders("receiptNumber")
  WHERE "receiptNumber" IS NOT NULL AND internal_order_state <> 'archived';

-- --------------------------------------------------------------------------
-- 6. Updated-at trigger
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_course_sale_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON public.orders;
CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_course_sale_updated_at();

-- --------------------------------------------------------------------------
-- 7. Atomic Waseet-native RPCs
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_next_receipt_number()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT (
    COALESCE(
      MAX(CASE WHEN "receiptNumber" ~ '^[0-9]+$' THEN "receiptNumber"::bigint END),
      1000
    ) + 1
  )::text
  FROM public.orders;
$function$;

CREATE OR REPLACE FUNCTION public.create_waseet_order_atomic(
  p_student_name text,
  p_phone1 text,
  p_phone2 text,
  p_waseet_city_id bigint,
  p_waseet_city_name text,
  p_waseet_region_id bigint,
  p_waseet_region_name text,
  p_address_details text,
  p_location_hint text,
  p_waseet_package_size_id bigint,
  p_waseet_package_size_name text,
  p_collection_amount bigint,
  p_items_count integer,
  p_replacement boolean,
  p_goods_type text,
  p_merchant_notes text,
  p_receipt_number text,
  p_course_type_id integer,
  p_internal_notes text,
  p_telegram_username text,
  p_created_by_id uuid,
  p_created_by_username text,
  p_payload_hash text
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_code public.codes%ROWTYPE;
  inserted_order public.orders%ROWTYPE;
  final_receipt text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('course-sale:waseet-order-create'));

  IF NULLIF(BTRIM(p_student_name), '') IS NULL THEN
    RAISE EXCEPTION 'اسم الطالب/المستلم مطلوب.';
  END IF;
  IF p_phone1 !~ '^[+]9647[0-9]{9}$' THEN
    RAISE EXCEPTION 'رقم الهاتف الأساسي ليس بصيغة الوسيط المطلوبة.';
  END IF;
  IF NULLIF(BTRIM(p_address_details), '') IS NULL THEN
    RAISE EXCEPTION 'تفاصيل العنوان مطلوبة.';
  END IF;
  IF p_collection_amount < 1 THEN
    RAISE EXCEPTION 'المبلغ المطلوب تحصيله يجب أن يكون أكبر من صفر.';
  END IF;
  IF p_items_count < 1 THEN
    RAISE EXCEPTION 'عدد القطع يجب أن يكون واحداً على الأقل.';
  END IF;
  IF p_payload_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'بصمة بيانات الطلب غير صالحة.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.waseet_cities
    WHERE id = p_waseet_city_id AND active = true AND name = p_waseet_city_name
  ) THEN
    RAISE EXCEPTION 'المحافظة لا تطابق قائمة الوسيط الحالية.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.waseet_regions
    WHERE id = p_waseet_region_id
      AND city_id = p_waseet_city_id
      AND active = true
      AND name = p_waseet_region_name
  ) THEN
    RAISE EXCEPTION 'المنطقة لا تتبع المحافظة المختارة في قائمة الوسيط.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.waseet_package_sizes
    WHERE id = p_waseet_package_size_id AND active = true AND name = p_waseet_package_size_name
  ) THEN
    RAISE EXCEPTION 'حجم الطرد لا يطابق قائمة الوسيط الحالية.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.course_types WHERE id = p_course_type_id) THEN
    RAISE EXCEPTION 'نوع الدورة غير موجود.';
  END IF;

  final_receipt := NULLIF(BTRIM(p_receipt_number), '');
  IF final_receipt IS NULL THEN
    final_receipt := public.preview_next_receipt_number();
  END IF;

  SELECT * INTO inserted_order
  FROM public.orders
  WHERE "receiptNumber" = final_receipt AND internal_order_state <> 'archived'
  FOR UPDATE;

  IF inserted_order.id IS NOT NULL THEN
    IF inserted_order.waseet_payload_hash = p_payload_hash THEN
      RETURN NEXT inserted_order;
      RETURN;
    END IF;
    RAISE EXCEPTION 'رقم الوصل مستخدم مسبقاً لطلب مختلف.';
  END IF;

  SELECT * INTO selected_code
  FROM public.codes
  WHERE status = 'available'
    AND COALESCE("isDisabled", false) = false
    AND "courseTypeId" = p_course_type_id
  ORDER BY "createdAt" NULLS FIRST, id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF selected_code.id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد كود متاح للدورة المختارة.';
  END IF;

  INSERT INTO public.orders (
    "studentName", phone1, phone2,
    waseet_city_id, waseet_city_name,
    waseet_region_id, waseet_region_name,
    address_details, location_hint,
    waseet_package_size_id, waseet_package_size_name,
    collection_amount, items_count, replacement, goods_type,
    merchant_notes, "receiptNumber", "courseTypeId",
    internal_notes, telegram_username,
    "StudentVaultCode_ID", "StudentVaultCode_Serial",
    "createdById", "createdByUsername",
    internal_order_state, waseet_sync_state,
    waseet_payload_hash, "createdAt", updated_at
  ) VALUES (
    BTRIM(p_student_name), p_phone1, NULLIF(BTRIM(p_phone2), ''),
    p_waseet_city_id, p_waseet_city_name,
    p_waseet_region_id, p_waseet_region_name,
    BTRIM(p_address_details), COALESCE(BTRIM(p_location_hint), ''),
    p_waseet_package_size_id, p_waseet_package_size_name,
    p_collection_amount, p_items_count, COALESCE(p_replacement, false),
    COALESCE(NULLIF(BTRIM(p_goods_type), ''), 'كورس تعليمي'),
    COALESCE(BTRIM(p_merchant_notes), ''), final_receipt, p_course_type_id,
    COALESCE(BTRIM(p_internal_notes), ''), LTRIM(COALESCE(BTRIM(p_telegram_username), ''), '@'),
    selected_code."codeValue", selected_code."serialNumber",
    p_created_by_id, COALESCE(BTRIM(p_created_by_username), ''),
    'ready', 'pending', p_payload_hash, now(), now()
  )
  RETURNING * INTO inserted_order;

  UPDATE public.codes
  SET
    status = 'used',
    "orderId" = inserted_order.id,
    "assignedAt" = now()
  WHERE id = selected_code.id;

  RETURN NEXT inserted_order;
END
$function$;

CREATE OR REPLACE FUNCTION public.claim_waseet_dispatch(
  p_order_id bigint,
  p_payload_hash text
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO current_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF current_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود.';
  END IF;
  IF current_order.internal_order_state = 'archived' THEN
    RAISE EXCEPTION 'لا يمكن إرسال طلب مؤرشف.';
  END IF;
  IF current_order.waseet_qr_id IS NOT NULL OR current_order.waseet_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'الطلب مرسل إلى الوسيط مسبقاً.';
  END IF;
  IF current_order.waseet_sync_state = 'syncing' THEN
    RAISE EXCEPTION 'توجد محاولة إرسال قيد التنفيذ؛ لا تعِد الإرسال.';
  END IF;
  IF current_order.waseet_sync_state IN ('manual_review', 'not_ready', 'needs_verification') THEN
    RAISE EXCEPTION 'الطلب غير مؤهل للإرسال قبل المراجعة أو التحقق اليدوي.';
  END IF;
  IF current_order.waseet_city_id IS NULL
    OR current_order.waseet_region_id IS NULL
    OR current_order.waseet_package_size_id IS NULL
    OR NULLIF(BTRIM(current_order.address_details), '') IS NULL
    OR current_order.collection_amount < 1 THEN
    RAISE EXCEPTION 'بيانات Waseet City/Region/Address/Package/Amount غير مكتملة.';
  END IF;
  IF current_order.waseet_payload_hash IS DISTINCT FROM p_payload_hash THEN
    RAISE EXCEPTION 'بيانات الطلب تغيرت؛ أعد حفظ الطلب قبل الإرسال.';
  END IF;

  UPDATE public.orders
  SET
    waseet_sync_state = 'syncing',
    waseet_dispatch_key = gen_random_uuid(),
    waseet_last_error = '',
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO current_order;

  RETURN NEXT current_order;
END
$function$;

CREATE OR REPLACE FUNCTION public.archive_waseet_order(
  p_order_id bigint,
  p_actor_id uuid,
  p_actor_username text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO current_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF current_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود.';
  END IF;
  IF current_order.waseet_qr_id IS NOT NULL OR current_order.waseet_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن أرشفة شحنة مرسلة إلى الوسيط من هذا الإجراء.';
  END IF;
  IF current_order.waseet_sync_state IN ('syncing', 'needs_verification') THEN
    RAISE EXCEPTION 'لا يمكن أرشفة الطلب قبل حسم محاولة الإرسال الحالية.';
  END IF;

  UPDATE public.orders
  SET internal_order_state = 'archived', updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.codes
  SET status = 'available', "orderId" = NULL, "assignedAt" = NULL
  WHERE "orderId" = p_order_id;

  INSERT INTO public.waseet_audit_log (
    order_id, action, actor_id, actor_username, success, message, details
  ) VALUES (
    p_order_id, 'order.archive', p_actor_id, COALESCE(p_actor_username, ''), true,
    'تمت أرشفة الطلب المحلي وإرجاع كود الدورة إلى المخزن.', '{}'::jsonb
  );
END
$function$;

-- --------------------------------------------------------------------------
-- 8. Waseet-native request and confirmation templates
-- --------------------------------------------------------------------------

INSERT INTO public.settings (
  id, "requestTemplate", "confirmationTemplate", "defaultOrderNote"
) VALUES (
  1,
  E'الاسم الرباعي:\nرقم الهاتف:\nرقم هاتف بديل:\nالمحافظة:\nالمنطقة:\nتفاصيل العنوان:\nأقرب نقطة دالة:\nالدورة / المنتج:\nالمبلغ المطلوب تحصيله:\nعدد القطع:\nملاحظات:',
  E'تم تثبيت الطلب ✅\nالاسم: {name}\n📞 {phone1} - {phone2}\n📍 المحافظة: {city}\nالمنطقة: {region}\nتفاصيل العنوان: {address}\nأقرب نقطة دالة: {landmark}\nالدورة: {course}\nالمبلغ المطلوب تحصيله: {amount} د.ع\nعدد القطع: {itemsCount}\nرقم الوصل: {receipt}\nكود الدورة: {code}\nرقم Waseet QR: {waseetQr}',
  ''
)
ON CONFLICT (id) DO UPDATE SET
  "requestTemplate" = EXCLUDED."requestTemplate",
  "confirmationTemplate" = EXCLUDED."confirmationTemplate",
  "defaultOrderNote" = COALESCE(public.settings."defaultOrderNote", '');

-- --------------------------------------------------------------------------
-- 9. RLS and grants: browser clients cannot access shipping secrets directly
-- --------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_package_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_status_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_metadata_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waseet_api_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.preview_next_receipt_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_waseet_order_atomic(
  text, text, text, bigint, text, bigint, text, text, text, bigint, text,
  bigint, integer, boolean, text, text, text, integer, text, text, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_waseet_dispatch(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_waseet_order(bigint, uuid, text) FROM PUBLIC;

DO $grants$
DECLARE
  application_tables text := 'public.users, public.course_types, public.settings, public.orders, public.codes, public.waseet_cities, public.waseet_regions, public.waseet_package_sizes, public.waseet_status_catalog, public.waseet_metadata_runs, public.waseet_status_history, public.waseet_audit_log, public.waseet_api_log';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE ' || application_tables || ' FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE ' || application_tables || ' FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON TABLE ' || application_tables || ' TO service_role';
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT EXECUTE ON FUNCTION public.preview_next_receipt_number() TO service_role;
    GRANT EXECUTE ON FUNCTION public.create_waseet_order_atomic(
      text, text, text, bigint, text, bigint, text, text, text, bigint, text,
      bigint, integer, boolean, text, text, text, integer, text, text, uuid, text, text
    ) TO service_role;
    GRANT EXECUTE ON FUNCTION public.claim_waseet_dispatch(bigint, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.archive_waseet_order(bigint, uuid, text) TO service_role;
  END IF;
END
$grants$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Post-run operational steps (not SQL):
-- 1) Set WASEET_USERNAME / WASEET_PASSWORD in Vercel server environment.
-- 2) Deploy the patched project.
-- 3) Open Add Order and press "تحديث قوائم الوسيط" once as an admin.
-- 4) Review every legacy order marked manual_review before any dispatch.
-- ============================================================================
