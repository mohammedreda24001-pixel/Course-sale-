-- ========================================================
-- Supabase SQL Migration Script
-- Run this in the Supabase SQL Editor to migrate an existing database
-- ========================================================

-- 1. Create Course Types Table (if not exists)
CREATE TABLE IF NOT EXISTS course_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) UNIQUE NOT NULL,
    "defaultPrice" NUMERIC NOT NULL DEFAULT 0
);

-- Seed default course types
INSERT INTO course_types (name, "defaultPrice")
VALUES 
    ('دورة الأحياء', 250),
    ('دورة الكيمياء', 250),
    ('دورة الفيزياء', 250)
ON CONFLICT (name) DO NOTHING;

-- 2. Create Order Statuses Table (if not exists)
CREATE TABLE IF NOT EXISTS order_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Seed default statuses
INSERT INTO order_statuses (id, name)
VALUES
    (1, 'جاهز للتسليم'),
    (2, 'تم الاستلام'),
    (3, 'عند المندوب'),
    (4, 'راجع')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Reset SERIAL sequence for statuses
SELECT setval('order_statuses_id_seq', COALESCE((SELECT MAX(id) FROM order_statuses), 1));

-- 3. Create Products Table (if not exists)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) UNIQUE NOT NULL
);

-- Seed default product
INSERT INTO products (name) VALUES ('كورس تعليمي') ON CONFLICT (name) DO NOTHING;

-- 4. Apply Schema Alterations and Migrations
DO $$
BEGIN
    -- Rename old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assignedCode') THEN
        ALTER TABLE orders RENAME COLUMN "assignedCode" TO "StudentVaultCode_ID";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assignedSerial') THEN
        ALTER TABLE orders RENAME COLUMN "assignedSerial" TO "StudentVaultCode_Serial";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipmentCode') THEN
        ALTER TABLE orders RENAME COLUMN "shipmentCode" TO "ShipmentTrackingCode";
    END IF;

    -- Add basePrice and deliveryFee columns to orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'basePrice') THEN
        ALTER TABLE orders ADD COLUMN "basePrice" NUMERIC DEFAULT 250;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'deliveryFee') THEN
        ALTER TABLE orders ADD COLUMN "deliveryFee" NUMERIC DEFAULT 0;
    END IF;

    -- Add other columns to orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'courseTypeId') THEN
        ALTER TABLE orders ADD COLUMN "courseTypeId" INT REFERENCES course_types(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'internalNotes') THEN
        ALTER TABLE orders ADD COLUMN "internalNotes" TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'telegramUsername') THEN
        ALTER TABLE orders ADD COLUMN "telegramUsername" VARCHAR(100) DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'statusId') THEN
        ALTER TABLE orders ADD COLUMN "statusId" INT REFERENCES order_statuses(id) ON DELETE SET NULL DEFAULT 1;
    END IF;

    -- Add Al-Waseet tracking & sync columns to orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waseet_tracking_number') THEN
        ALTER TABLE orders ADD COLUMN "waseet_tracking_number" VARCHAR(100) DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waseet_sticker_url') THEN
        ALTER TABLE orders ADD COLUMN "waseet_sticker_url" TEXT DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waseet_sync_status') THEN
        ALTER TABLE orders ADD COLUMN "waseet_sync_status" VARCHAR(50) DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waseet_sync_error') THEN
        ALTER TABLE orders ADD COLUMN "waseet_sync_error" TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waseet_synced_at') THEN
        ALTER TABLE orders ADD COLUMN "waseet_synced_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;

    -- Add defaultOrderNote to settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'defaultOrderNote') THEN
        ALTER TABLE settings ADD COLUMN "defaultOrderNote" TEXT DEFAULT '';
    END If;
    
    -- Add columns to codes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'codes' AND column_name = 'courseTypeId') THEN
        ALTER TABLE codes ADD COLUMN "courseTypeId" INT REFERENCES course_types(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'codes' AND column_name = 'isDisabled') THEN
        ALTER TABLE codes ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 5. Backfill/Migrate existing records
UPDATE orders SET "basePrice" = "totalPrice" WHERE "basePrice" IS NULL;
UPDATE orders SET "deliveryFee" = 0 WHERE "deliveryFee" IS NULL;
UPDATE codes SET "courseTypeId" = (SELECT id FROM course_types LIMIT 1) WHERE "courseTypeId" IS NULL;
UPDATE orders SET "courseTypeId" = (SELECT id FROM course_types LIMIT 1) WHERE "courseTypeId" IS NULL;
UPDATE orders SET "statusId" = 1 WHERE "statusId" IS NULL;

-- 6. Add Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_codes_status ON codes(status);
CREATE INDEX IF NOT EXISTS idx_codes_course_type ON codes("courseTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_province ON orders(province);
CREATE INDEX IF NOT EXISTS idx_orders_course_type ON orders("courseTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders("statusId");
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- 7. Reload schema cache to apply changes immediately for PostgREST API
NOTIFY pgrst, 'reload schema';
