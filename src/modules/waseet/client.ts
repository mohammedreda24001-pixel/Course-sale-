import 'server-only';

import type {
  WaseetApiEnvelope,
  WaseetCityApi,
  WaseetCreateOrderPayload,
  WaseetEditOrderPayload,
  WaseetInvoiceApiRecord,
  WaseetOrderApiRecord,
  WaseetPackageSizeApi,
  WaseetRegionApi,
  WaseetStatusApi,
} from './types';

const DEFAULT_BASE_URL = 'https://api.alwaseet-iq.net/v1/merchant';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_TOKEN_TTL_SECONDS = 1_200;

type TokenCache = { token: string; expiresAt: number };

type WaseetGlobal = typeof globalThis & {
  __courseSaleWaseetToken?: TokenCache;
  __courseSaleWaseetLoginPromise?: Promise<string>;
  __courseSaleWaseetRateQueue?: Promise<void>;
  __courseSaleWaseetLastRequestAt?: number;
};

const globalCache = globalThis as WaseetGlobal;

export class WaseetApiError extends Error {
  readonly code?: string;
  readonly httpStatus?: number;
  readonly uncertain: boolean;

  constructor(
    message: string,
    options: { code?: string; httpStatus?: number; uncertain?: boolean } = {},
  ) {
    super(message);
    this.name = 'WaseetApiError';
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.uncertain = Boolean(options.uncertain);
  }
}

function config() {
  const username = process.env.WASEET_USERNAME?.trim();
  const password = process.env.WASEET_PASSWORD?.trim();
  if (!username || !password) {
    throw new WaseetApiError(
      'بيانات دخول الوسيط غير مضبوطة على الخادم. أضف WASEET_USERNAME وWASEET_PASSWORD إلى متغيرات البيئة.',
    );
  }

  return {
    username,
    password,
    baseUrl: (process.env.WASEET_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    timeoutMs: Math.max(5_000, Number(process.env.WASEET_REQUEST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
    tokenTtlMs:
      Math.max(60, Number(process.env.WASEET_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS) * 1_000,
    minRequestIntervalMs: Math.max(1_000, Number(process.env.WASEET_MIN_REQUEST_INTERVAL_MS) || 1_050),
  };
}

function isLikelyAuthFailure(envelope: WaseetApiEnvelope<unknown>): boolean {
  const text = `${envelope.errNum || ''} ${envelope.msg || ''}`.toLowerCase();
  return /token|auth|login|unauthor|صلاح|دخول|مصادق/.test(text);
}

async function paceRequest(minimumIntervalMs: number): Promise<void> {
  const previousQueue = globalCache.__courseSaleWaseetRateQueue || Promise.resolve();
  const currentTurn = previousQueue.catch(() => undefined).then(async () => {
    const lastRequestAt = globalCache.__courseSaleWaseetLastRequestAt || 0;
    const delay = Math.max(0, minimumIntervalMs - (Date.now() - lastRequestAt));
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    globalCache.__courseSaleWaseetLastRequestAt = Date.now();
  });
  globalCache.__courseSaleWaseetRateQueue = currentTurn.catch(() => undefined);
  await currentTurn;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  uncertainOnTransportFailure = false,
): Promise<Response> {
  const cfg = config();
  await paceRequest(cfg.minRequestIntervalMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const timeoutMessage = error instanceof Error && error.name === 'AbortError';
    throw new WaseetApiError(
      timeoutMessage
        ? 'انتهت مهلة الاتصال بالوسيط. لم تتم إعادة الإرسال تلقائياً لمنع إنشاء شحنة مكررة.'
        : 'تعذر الوصول إلى خادم الوسيط. لم تتم إعادة الإرسال تلقائياً لمنع إنشاء شحنة مكررة.',
      { uncertain: uncertainOnTransportFailure },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function parseEnvelope<T>(
  response: Response,
  uncertainOnUnreadableResponse = false,
): Promise<WaseetApiEnvelope<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WaseetApiError('أعاد الوسيط استجابة غير قابلة للقراءة.', {
      httpStatus: response.status,
      uncertain: uncertainOnUnreadableResponse,
    });
  }

  if (!payload || typeof payload !== 'object') {
    throw new WaseetApiError('تنسيق استجابة الوسيط غير صالح.', {
      httpStatus: response.status,
      uncertain: uncertainOnUnreadableResponse,
    });
  }

  return payload as WaseetApiEnvelope<T>;
}

async function login(force = false): Promise<string> {
  const cfg = config();
  const now = Date.now();

  const cachedToken = globalCache.__courseSaleWaseetToken;
  if (!force && cachedToken && cachedToken.expiresAt > now + 10_000) {
    return cachedToken.token;
  }

  if (!force && globalCache.__courseSaleWaseetLoginPromise) {
    return globalCache.__courseSaleWaseetLoginPromise;
  }

  const loginPromise = (async () => {
    const form = new FormData();
    form.set('username', cfg.username);
    form.set('password', cfg.password);

    const response = await fetchWithTimeout(
      `${cfg.baseUrl}/login`,
      { method: 'POST', body: form },
      cfg.timeoutMs,
    );
    const envelope = await parseEnvelope<{ token?: string }>(response);
    const token = envelope.data?.token;

    if (!response.ok || !envelope.status || !token) {
      throw new WaseetApiError(envelope.msg || 'فشل تسجيل الدخول إلى الوسيط.', {
        code: envelope.errNum,
        httpStatus: response.status,
      });
    }

    globalCache.__courseSaleWaseetToken = {
      token,
      expiresAt: Date.now() + cfg.tokenTtlMs,
    };
    return token;
  })();

  globalCache.__courseSaleWaseetLoginPromise = loginPromise;
  try {
    return await loginPromise;
  } finally {
    globalCache.__courseSaleWaseetLoginPromise = undefined;
  }
}

function createForm(payload: object): FormData {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw new WaseetApiError(`حقل Waseet غير قابل للإرسال: ${key}`);
    }
    form.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  });
  return form;
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: object;
    query?: Record<string, string | number | undefined>;
    uncertainOnTransportFailure?: boolean;
  } = {},
  authRetry = true,
): Promise<T> {
  const cfg = config();
  const token = await login();
  const url = new URL(`${cfg.baseUrl}/${path.replace(/^\//, '')}`);
  url.searchParams.set('token', token);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  const method = options.method || 'GET';
  const response = await fetchWithTimeout(
    url.toString(),
    {
      method,
      body: method === 'POST' ? createForm(options.body || {}) : undefined,
    },
    cfg.timeoutMs,
    Boolean(options.uncertainOnTransportFailure),
  );
  const envelope = await parseEnvelope<T>(response, Boolean(options.uncertainOnTransportFailure));

  if ((!response.ok || !envelope.status) && authRetry && isLikelyAuthFailure(envelope)) {
    globalCache.__courseSaleWaseetToken = undefined;
    await login(true);
    return request<T>(path, options, false);
  }

  if (!response.ok || !envelope.status) {
    throw new WaseetApiError(envelope.msg || `رفض الوسيط الطلب (${response.status}).`, {
      code: envelope.errNum,
      httpStatus: response.status,
    });
  }

  return envelope.data as T;
}

export const waseetClient = {
  async healthCheck(): Promise<{ authenticated: true }> {
    await login(true);
    return { authenticated: true };
  },

  getCities(): Promise<WaseetCityApi[]> {
    return request<WaseetCityApi[]>('citys');
  },

  getRegions(cityId: number): Promise<WaseetRegionApi[]> {
    return request<WaseetRegionApi[]>('regions', { query: { city_id: cityId } });
  },

  getPackageSizes(): Promise<WaseetPackageSizeApi[]> {
    return request<WaseetPackageSizeApi[]>('package-sizes');
  },

  getStatuses(): Promise<WaseetStatusApi[]> {
    return request<WaseetStatusApi[]>('statuses');
  },

  async createOrder(payload: WaseetCreateOrderPayload): Promise<WaseetOrderApiRecord> {
    const data = await request<WaseetOrderApiRecord[]>('create-order', {
      method: 'POST',
      body: payload,
      uncertainOnTransportFailure: true,
    });
    const record = Array.isArray(data) ? data[0] : undefined;
    if (!record?.id || !record.qr_id) {
      throw new WaseetApiError(
        'أعاد الوسيط نجاحاً من دون معرفات الشحنة الكاملة؛ يجب التحقق يدوياً قبل إعادة الإرسال.',
        { uncertain: true },
      );
    }
    return record;
  },

  async editOrder(payload: WaseetEditOrderPayload): Promise<void> {
    await request<unknown>('edit-order', {
      method: 'POST',
      body: payload,
      uncertainOnTransportFailure: true,
    });
  },

  getMerchantOrders(): Promise<WaseetOrderApiRecord[]> {
    return request<WaseetOrderApiRecord[]>('merchant-orders');
  },

  getOrdersByIds(ids: Array<string | number>): Promise<WaseetOrderApiRecord[]> {
    if (ids.length === 0) return Promise.resolve([]);
    if (ids.length > 25) {
      throw new WaseetApiError('واجهة الوسيط تقبل 25 معرف طلب كحد أقصى في دفعة المزامنة الواحدة.');
    }
    return request<WaseetOrderApiRecord[]>('get-orders-by-ids-bulk', {
      method: 'POST',
      body: { ids: ids.join(',') },
    });
  },

  getInvoices(): Promise<WaseetInvoiceApiRecord[]> {
    return request<WaseetInvoiceApiRecord[]>('get_merchant_invoices');
  },

  getInvoiceOrders(invoiceId: string | number): Promise<unknown> {
    return request<unknown>('get_merchant_invoice_orders', { query: { invoice_id: invoiceId } });
  },

  async receiveInvoice(invoiceId: string | number): Promise<void> {
    await request<unknown>('receive_merchant_invoice', { query: { invoice_id: invoiceId } });
  },

  async fetchLabel(qrLink: string): Promise<{ body: ArrayBuffer; contentType: string }> {
    const cfg = config();
    let url: URL;
    try {
      url = new URL(qrLink);
    } catch {
      throw new WaseetApiError('رابط ملصق الوسيط المخزن غير صالح.');
    }

    const hostname = url.hostname.toLowerCase();
    const officialHost = hostname === 'alwaseet-iq.net' || hostname.endsWith('.alwaseet-iq.net');
    if (url.protocol !== 'https:' || !officialHost) {
      throw new WaseetApiError('تم رفض رابط الملصق لأنه لا يعود إلى نطاق الوسيط الرسمي.');
    }

    // Stored QR links are intentionally tokenless. Inject a fresh server-side
    // merchant token at request time so the browser never sees it and old links
    // do not stop working when a previous token expires.
    url.searchParams.set('token', await login());
    const response = await fetchWithTimeout(url.toString(), { method: 'GET' }, cfg.timeoutMs);
    if (!response.ok) {
      throw new WaseetApiError('تعذر تنزيل ملصق الشحنة من الوسيط.', {
        httpStatus: response.status,
      });
    }
    return {
      body: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || 'application/pdf',
    };
  },
};
