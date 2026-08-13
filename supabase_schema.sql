-- ========================================================
-- Complete Supabase / PostgreSQL Relational Database Schema
-- Sales and Order Management System
-- ========================================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(256) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'agent')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Course Types Table
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

-- 3. Create Order Statuses Table
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

-- 4. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    "studentName" VARCHAR(256) NOT NULL,
    phone1 VARCHAR(50) NOT NULL,
    phone2 VARCHAR(50),
    province VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    landmark TEXT NOT NULL,
    "totalPrice" NUMERIC NOT NULL,
    "basePrice" NUMERIC DEFAULT 250,
    "deliveryFee" NUMERIC DEFAULT 0,
    "StudentVaultCode_ID" VARCHAR(100) DEFAULT 'PENDING',
    "StudentVaultCode_Serial" VARCHAR(100) DEFAULT 'PENDING',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdByUsername" VARCHAR(100),
    "piecesCount" INT DEFAULT 1,
    "hasReturn" VARCHAR(50) DEFAULT 'لا',
    "goodsType" VARCHAR(256) DEFAULT 'كورس تعليمي',
    "returnDescription" TEXT DEFAULT '',
    "receiptNumber" VARCHAR(100),
    "ShipmentTrackingCode" VARCHAR(100) DEFAULT NULL,
    "notes" TEXT DEFAULT '',
    "courseTypeId" INT REFERENCES course_types(id) ON DELETE SET NULL,
    "internalNotes" TEXT DEFAULT '',
    "telegramUsername" VARCHAR(100) DEFAULT '',
    "statusId" INT REFERENCES order_statuses(id) ON DELETE SET NULL DEFAULT 1,
    "waseet_tracking_number" VARCHAR(100) DEFAULT NULL,
    "waseet_sticker_url" TEXT DEFAULT NULL,
    "waseet_sync_status" VARCHAR(50) DEFAULT 'pending',
    "waseet_sync_error" TEXT DEFAULT '',
    "waseet_synced_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 5. Create Codes (Code Vault) Table
CREATE TABLE IF NOT EXISTS codes (
    id UUID PRIMARY KEY,
    "codeValue" VARCHAR(100) UNIQUE NOT NULL,
    "serialNumber" VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('available', 'used')) DEFAULT 'available',
    "orderId" INT REFERENCES orders(id) ON DELETE SET NULL,
    "assignedAt" TIMESTAMP WITH TIME ZONE,
    "courseTypeId" INT REFERENCES course_types(id) ON DELETE SET NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false
);

-- 6. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    "requestTemplate" TEXT NOT NULL,
    "confirmationTemplate" TEXT NOT NULL,
    "defaultOrderNote" TEXT DEFAULT ''
);

-- 7. Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) UNIQUE NOT NULL
);

-- Seed default product
INSERT INTO products (name) VALUES ('كورس تعليمي') ON CONFLICT (name) DO NOTHING;

-- ========================================================
-- Default Settings
-- ========================================================

-- No administrator credentials are seeded in source control.
-- Existing installations keep their database user; legacy SHA-256 password
-- hashes are upgraded to scrypt automatically after a successful login.

-- Seed default settings template
INSERT INTO settings (id, "requestTemplate", "confirmationTemplate", "defaultOrderNote")
VALUES (
    1,
    'الاسم الرباعي:
رقم الهاتف:
رقم هاتف بديل:
المحافظة:
العنوان:
أقرب نقطة دالة:
معرف التلكرام:
السعر:',
    'تم تثبيت الطلب ✅
الاسم: {name}
📞 {phone1} - {phone2}
📍 المحافظة  : {province}
المنطقة : {address}
نقطة دالة : {landmark}
تفاصيل الطلب:
كود الدورة الالكترونية للأستاذ حسن فلاح
📚ملزمة مصدر الأحياء + كتيب الرسومات مجاناً
💰 مبلغ: {price} ألف دينار
🚚 مبلغ التوصيل: {deliveryFee} الف دينار
✅ يتم تسديد المبلغ كاملاً ({totalPrice} ألف دينار) عند استلام الطلب.
أهلاً بيك ويانه 🌹
هسه انت طالب مو عادي…
أنت طالب حسن فلاح',
    ''
) ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- Indexes & Performance Optimizations
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_codes_status ON codes(status);
CREATE INDEX IF NOT EXISTS idx_codes_course_type ON codes("courseTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_province ON orders(province);
CREATE INDEX IF NOT EXISTS idx_orders_course_type ON orders("courseTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders("statusId");
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ========================================================
-- Retroactive Column Migration Logic (For Existing Database)
-- ========================================================
DO $$
BEGIN
    -- RENAME migrations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assignedCode') THEN
        ALTER TABLE orders RENAME COLUMN "assignedCode" TO "StudentVaultCode_ID";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assignedSerial') THEN
        ALTER TABLE orders RENAME COLUMN "assignedSerial" TO "StudentVaultCode_Serial";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipmentCode') THEN
        ALTER TABLE orders RENAME COLUMN "shipmentCode" TO "ShipmentTrackingCode";
    END IF;

    -- ADD basePrice and deliveryFee columns to orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'basePrice') THEN
        ALTER TABLE orders ADD COLUMN "basePrice" NUMERIC DEFAULT 250;
        UPDATE orders SET "basePrice" = "totalPrice" WHERE "basePrice" IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'deliveryFee') THEN
        ALTER TABLE orders ADD COLUMN "deliveryFee" NUMERIC DEFAULT 0;
        UPDATE orders SET "deliveryFee" = 0 WHERE "deliveryFee" IS NULL;
    END IF;

    -- ADD courseTypeId, internalNotes, telegramUsername, statusId, defaultOrderNote
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'courseTypeId') THEN
        ALTER TABLE orders ADD COLUMN "courseTypeId" INT REFERENCES course_types(id) ON DELETE SET NULL;
        UPDATE orders SET "courseTypeId" = (SELECT id FROM course_types LIMIT 1) WHERE "courseTypeId" IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'internalNotes') THEN
        ALTER TABLE orders ADD COLUMN "internalNotes" TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'telegramUsername') THEN
        ALTER TABLE orders ADD COLUMN "telegramUsername" VARCHAR(100) DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'statusId') THEN
        ALTER TABLE orders ADD COLUMN "statusId" INT REFERENCES order_statuses(id) ON DELETE SET NULL DEFAULT 1;
        UPDATE orders SET "statusId" = 1 WHERE "statusId" IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'codes' AND column_name = 'courseTypeId') THEN
        ALTER TABLE codes ADD COLUMN "courseTypeId" INT REFERENCES course_types(id) ON DELETE SET NULL;
        UPDATE codes SET "courseTypeId" = (SELECT id FROM course_types LIMIT 1) WHERE "courseTypeId" IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'codes' AND column_name = 'isDisabled') THEN
        ALTER TABLE codes ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Reload schema cache to apply changes immediately
NOTIFY pgrst, 'reload schema';
