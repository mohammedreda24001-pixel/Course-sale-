export type WaseetSyncState =
  | 'not_ready'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'needs_verification'
  | 'manual_review';

export type InternalOrderState = 'draft' | 'ready' | 'archived';

export interface WaseetApiEnvelope<T> {
  status: boolean;
  errNum?: string;
  msg?: string;
  data?: T;
}

export interface WaseetCityApi {
  id: string | number;
  city_name: string;
}

export interface WaseetRegionApi {
  id: string | number;
  region_name: string;
}

export interface WaseetPackageSizeApi {
  id: string | number;
  size: string;
}

export interface WaseetStatusApi {
  id: string | number;
  status: string;
}

export interface WaseetCreateOrderPayload {
  client_name: string;
  client_mobile: string;
  client_mobile2?: string;
  city_id: string;
  region_id: string;
  location: string;
  type_name: string;
  items_number: number;
  price: number;
  package_size: string;
  merchant_notes?: string;
  replacement: 0 | 1;
}

export interface WaseetEditOrderPayload extends WaseetCreateOrderPayload {
  qr_id: string;
}

export interface WaseetOrderApiRecord {
  id?: string | number;
  qr_id?: string | number;
  qr_link?: string;
  client_name?: string;
  client_mobile?: string;
  client_mobile2?: string;
  city_id?: string | number;
  city_name?: string;
  region_id?: string | number;
  region_name?: string;
  location?: string;
  type_name?: string;
  items_number?: string | number;
  price?: string | number;
  package_size?: string | number;
  merchant_notes?: string;
  replacement?: string | number;
  status_id?: string | number;
  status?: string;
  issue_notes?: string;
  created_at?: string;
  updated_at?: string;
  company_price?: string | number;
  city_fees?: string | number;
  merchant_price?: string | number;
  cash_fee?: string | number;
  delivery_price?: string | number;
  merchant_invoice_id?: string | number;
  merchant_mobile?: string;
  merchant_id?: string | number;
  current_city?: string | number;
  merchant_city?: string | number;
  merchant_created_at?: string;
  pickup_id?: string | number;
  pickup_created_at?: string;
  has_merchant_fin_record?: 0 | 1 | '0' | '1';
  deliver_confirmed_fin?: 0 | 1 | '0' | '1';
  [key: string]: unknown;
}

export interface WaseetInvoiceApiRecord {
  id: string | number;
  merchant_price?: string | number;
  delivered_orders_count?: string | number;
  replacement_delivered_orders_count?: string | number;
  status?: string;
  merchant_id?: string | number;
  updated_at?: string;
  [key: string]: unknown;
}

export interface WaseetInvoiceOrdersApiResponse {
  invoice: WaseetInvoiceApiRecord[];
  orders: WaseetOrderApiRecord[];
}

export interface WaseetMetadataCity {
  id: number;
  name: string;
  active: boolean;
  fetchedAt?: string;
}

export interface WaseetMetadataRegion {
  id: number;
  cityId: number;
  name: string;
  active: boolean;
  fetchedAt?: string;
}

export interface WaseetMetadataPackageSize {
  id: number;
  name: string;
  active: boolean;
  fetchedAt?: string;
}

export interface WaseetMetadataStatus {
  id: string;
  name: string;
  active: boolean;
  fetchedAt?: string;
}

export interface WaseetOrderInput {
  studentName: string;
  phone1: string;
  phone2?: string;
  waseetCityId: number;
  waseetRegionId: number;
  addressDetails: string;
  locationHint?: string;
  waseetPackageSizeId: number;
  collectionAmount: number;
  itemsCount: number;
  replacement: boolean;
  goodsType: string;
  merchantNotes?: string;
  receiptNumber?: string;
  courseTypeId: number;
  internalNotes?: string;
  telegramUsername?: string;
}

export interface WaseetOrderRecord {
  id: number;
  studentName: string;
  phone1: string;
  phone2?: string | null;
  waseet_city_id: number | null;
  waseet_city_name: string | null;
  waseet_region_id: number | null;
  waseet_region_name: string | null;
  address_details: string;
  location_hint: string;
  waseet_package_size_id: number | null;
  waseet_package_size_name: string | null;
  collection_amount: number;
  items_count: number;
  replacement: boolean;
  goods_type: string;
  merchant_notes: string;
  receiptNumber?: string | null;
  StudentVaultCode_ID: string;
  StudentVaultCode_Serial: string;
  courseTypeId?: number | null;
  internal_notes: string;
  telegram_username: string;
  internal_order_state: InternalOrderState;
  waseet_sync_state: WaseetSyncState;
  waseet_order_id?: string | null;
  waseet_qr_id?: string | null;
  waseet_status_id?: string | null;
  waseet_status_text?: string | null;
  waseet_issue_notes?: string | null;
  waseet_last_error?: string | null;
  waseet_last_synced_at?: string | null;
  waseet_dispatched_at?: string | null;
  waseet_company_price?: number | null;
  waseet_city_fees?: number | null;
  waseet_merchant_price?: number | null;
  waseet_cash_fee?: number | null;
  waseet_delivery_price?: number | null;
  waseet_invoice_id?: string | null;
  createdAt: string;
  updated_at?: string | null;
  createdById?: string | null;
  createdByUsername?: string | null;
  waseet_qr_link?: string | null;
  waseet_raw?: Record<string, unknown> | null;
  waseet_payload_hash?: string | null;
  waseet_dispatch_key?: string | null;
  legacy_shipping_data?: Record<string, unknown> | null;
}

export interface WaseetFieldReview<T = string> {
  value: T | null;
  confidence: number;
  state: 'matched' | 'review' | 'missing';
  source?: string;
  suggestions?: Array<{ id: number; name: string; confidence: number }>;
}

export interface WaseetParseResult {
  rawText: string;
  fields: {
    studentName: WaseetFieldReview;
    phone1: WaseetFieldReview;
    phone2: WaseetFieldReview;
    city: WaseetFieldReview<{ id: number; name: string }>;
    region: WaseetFieldReview<{ id: number; name: string }>;
    addressDetails: WaseetFieldReview;
    locationHint: WaseetFieldReview;
    collectionAmount: WaseetFieldReview<number>;
    itemsCount: WaseetFieldReview<number>;
    goodsType: WaseetFieldReview;
    merchantNotes: WaseetFieldReview;
  };
  reviewRequired: boolean;
  warnings: string[];
}
