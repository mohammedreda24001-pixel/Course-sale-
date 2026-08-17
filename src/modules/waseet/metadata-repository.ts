import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { waseetClient } from './client';
import type {
  WaseetMetadataCity,
  WaseetMetadataPackageSize,
  WaseetMetadataRegion,
  WaseetMetadataStatus,
} from './types';

const METADATA_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function numericId(value: string | number, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error(`أعاد الوسيط معرفاً غير صالح لـ${label}.`);
  }
  return id;
}

export const waseetMetadataRepository = {
  async listCities(): Promise<WaseetMetadataCity[]> {
    const { data, error } = await supabaseAdmin
      .from('waseet_cities')
      .select('id,name,active,fetched_at')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      active: Boolean(row.active),
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : undefined,
    }));
  },

  async listRegions(cityId?: number): Promise<WaseetMetadataRegion[]> {
    let query = supabaseAdmin
      .from('waseet_regions')
      .select('id,city_id,name,active,fetched_at')
      .eq('active', true)
      .order('name');
    if (cityId) query = query.eq('city_id', cityId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      cityId: Number(row.city_id),
      name: String(row.name),
      active: Boolean(row.active),
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : undefined,
    }));
  },

  async listPackageSizes(): Promise<WaseetMetadataPackageSize[]> {
    const { data, error } = await supabaseAdmin
      .from('waseet_package_sizes')
      .select('id,name,active,fetched_at')
      .eq('active', true)
      .order('id');
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      active: Boolean(row.active),
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : undefined,
    }));
  },

  async listStatuses(): Promise<WaseetMetadataStatus[]> {
    const { data, error } = await supabaseAdmin
      .from('waseet_status_catalog')
      .select('id,name,active,fetched_at')
      .eq('active', true)
      .order('id');
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      active: Boolean(row.active),
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : undefined,
    }));
  },

  async getAll() {
    const [cities, regions, packageSizes, statuses] = await Promise.all([
      this.listCities(),
      this.listRegions(),
      this.listPackageSizes(),
      this.listStatuses(),
    ]);
    return { cities, regions, packageSizes, statuses };
  },

  async ensureAvailable() {
    const existing = await this.getAll();
    const { data: latestRun, error: runError } = await supabaseAdmin
      .from('waseet_metadata_runs')
      .select('fetched_at')
      .eq('success', true)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runError) throw runError;

    const complete = existing.cities.length > 0
      && existing.regions.length > 0
      && existing.packageSizes.length > 0
      && existing.statuses.length > 0;
    const lastSuccessfulRefresh = latestRun?.fetched_at
      ? new Date(String(latestRun.fetched_at)).getTime()
      : 0;
    const stale = !lastSuccessfulRefresh || Date.now() - lastSuccessfulRefresh > METADATA_MAX_AGE_MS;

    if (!complete || stale) {
      try {
        return await this.refreshAll();
      } catch (error) {
        // A complete older snapshot is safer than a partially refreshed catalog.
        if (!complete) throw error;
      }
    }
    return existing;
  },

  async refreshAll() {
    const fetchedAt = new Date().toISOString();
    try {
      const [citiesApi, packageSizesApi, statusesApi] = await Promise.all([
        waseetClient.getCities(),
        waseetClient.getPackageSizes(),
        waseetClient.getStatuses(),
      ]);

      const cities = citiesApi.map(city => ({
        id: numericId(city.id, 'المحافظة'),
        name: String(city.city_name || '').trim(),
      })).filter(city => city.name);

      const packageSizes = packageSizesApi.map(size => ({
        id: numericId(size.id, 'حجم الطرد'),
        name: String(size.size || '').trim(),
      })).filter(size => size.name);

      const statuses = statusesApi.map(status => ({
        id: status.id === undefined || status.id === null ? '' : String(status.id).trim(),
        name: String(status.status || '').trim(),
      })).filter(status => status.id && status.name);

      if (cities.length === 0) throw new Error('لم يُرجع الوسيط أي محافظة صالحة. لم تتغير القوائم المحلية.');
      if (packageSizes.length === 0) throw new Error('لم يُرجع الوسيط أي حجم طرد صالح. لم تتغير القوائم المحلية.');
      if (statuses.length === 0) throw new Error('لم يُرجع الوسيط أي حالة صالحة. لم تتغير القوائم المحلية.');

      // Fetch the complete remote snapshot before mutating the local catalog. This
      // prevents a mid-refresh network failure from deactivating valid old data.
      const allRegions: Array<{
        id: number;
        city_id: number;
        name: string;
      }> = [];

      for (let index = 0; index < cities.length; index += 1) {
        const city = cities[index];
        const regionsApi = await waseetClient.getRegions(city.id);
        for (const region of regionsApi) {
          const name = String(region.region_name || '').trim();
          if (!name) continue;
          allRegions.push({
            id: numericId(region.id, 'المنطقة'),
            city_id: city.id,
            name,
          });
        }
      }

      if (allRegions.length === 0) {
        throw new Error('لم يُرجع الوسيط أي منطقة صالحة. لم تتغير القوائم المحلية.');
      }

      const { error: snapshotError } = await supabaseAdmin.rpc('replace_waseet_metadata_snapshot', {
        p_cities: cities,
        p_regions: allRegions,
        p_package_sizes: packageSizes,
        p_statuses: statuses,
        p_fetched_at: fetchedAt,
      });
      if (snapshotError) {
        if (/replace_waseet_metadata_snapshot/i.test(snapshotError.message || '')) {
          throw new Error(
            'قاعدة البيانات غير محدثة. طبّق Supabase-Waseet-V2.3-Rate-Limit.sql قبل مزامنة القوائم.',
          );
        }
        throw snapshotError;
      }

      return this.getAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل تحديث بيانات الوسيط.';
      const { error: runError } = await supabaseAdmin.from('waseet_metadata_runs').insert({
        fetched_at: fetchedAt,
        cities_count: 0,
        regions_count: 0,
        package_sizes_count: 0,
        statuses_count: 0,
        success: false,
        error_message: message.slice(0, 2_000),
      });
      if (runError) console.error('Waseet metadata failure log failed:', runError.message);
      throw error;
    }
  },

  async resolveSelection(cityId: number, regionId: number, packageSizeId: number) {
    const [{ data: city, error: cityError }, { data: region, error: regionError }, { data: packageSize, error: packageError }] =
      await Promise.all([
        supabaseAdmin
          .from('waseet_cities')
          .select('id,name')
          .eq('id', cityId)
          .eq('active', true)
          .maybeSingle(),
        supabaseAdmin
          .from('waseet_regions')
          .select('id,city_id,name')
          .eq('id', regionId)
          .eq('active', true)
          .maybeSingle(),
        supabaseAdmin
          .from('waseet_package_sizes')
          .select('id,name')
          .eq('id', packageSizeId)
          .eq('active', true)
          .maybeSingle(),
      ]);

    if (cityError) throw cityError;
    if (regionError) throw regionError;
    if (packageError) throw packageError;
    if (!city) throw new Error('المحافظة المختارة غير موجودة في بيانات الوسيط الحالية. حدّث القوائم وأعد الاختيار.');
    if (!region) throw new Error('المنطقة المختارة غير موجودة في بيانات الوسيط الحالية. حدّث القوائم وأعد الاختيار.');
    if (Number(region.city_id) !== Number(city.id)) {
      throw new Error('المنطقة المختارة لا تتبع المحافظة المختارة في قوائم الوسيط.');
    }
    if (!packageSize) throw new Error('حجم الطرد المختار غير موجود في بيانات الوسيط الحالية.');

    return {
      city: { id: Number(city.id), name: String(city.name) },
      region: { id: Number(region.id), cityId: Number(region.city_id), name: String(region.name) },
      packageSize: { id: Number(packageSize.id), name: String(packageSize.name) },
    };
  },
};
