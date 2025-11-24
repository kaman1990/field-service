import { getInitializedPowerSync } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import { retoolUserService } from './retoolUser';
import type { Site, Area, AssetHealthStatus, AssetIotStatus, PointIotStatus, AssetType, GatewayStatus, GatewayIotStatus, Gateway, Company } from '../types/database';

export const lookupService = {
  async getSites(): Promise<Site[]> {
    const powerSync = await getInitializedPowerSync();
    
    // Get accessible site IDs for current user
    const accessibleSiteIds = await retoolUserService.getAccessibleSiteIds();
    
    // If user is admin (accessibleSiteIds is null), return all sites
    if (accessibleSiteIds === null) {
      return await powerSync.getAll<Site>(
        'SELECT * FROM sites WHERE enabled = ? ORDER BY name',
        [true]
      );
    }
    
    // If user has no accessible sites, return empty array
    if (accessibleSiteIds.length === 0) {
      return [];
    }
    
    // Filter sites by accessible site IDs
    const placeholders = accessibleSiteIds.map(() => '?').join(',');
    return await powerSync.getAll<Site>(
      `SELECT * FROM sites WHERE enabled = ? AND id IN (${placeholders}) ORDER BY name`,
      [true, ...accessibleSiteIds]
    );
  },

  /**
   * Get all sites without filtering by user access (for admin use)
   */
  async getAllSites(): Promise<Site[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<Site>(
      'SELECT * FROM sites WHERE enabled = ? ORDER BY name',
      [true]
    );
  },

  async getAreas(siteId?: string): Promise<Area[]> {
    const powerSync = await getInitializedPowerSync();
    
    // Get accessible site IDs for current user
    const accessibleSiteIds = await retoolUserService.getAccessibleSiteIds();
    
    if (siteId) {
      // If filtering by specific site, check if user has access
      if (accessibleSiteIds !== null && !accessibleSiteIds.includes(siteId)) {
        return [];
      }
      return await powerSync.getAll<Area>(
        'SELECT * FROM areas WHERE enabled = ? AND site_id = ? ORDER BY name',
        [true, siteId]
      );
    } else {
      // Filter areas by accessible sites
      if (accessibleSiteIds === null) {
        // Admin - all sites accessible
        return await powerSync.getAll<Area>(
          'SELECT * FROM areas WHERE enabled = ? ORDER BY name',
          [true]
        );
      } else if (accessibleSiteIds.length === 0) {
        // No accessible sites
        return [];
      } else {
        const placeholders = accessibleSiteIds.map(() => '?').join(',');
        return await powerSync.getAll<Area>(
          `SELECT * FROM areas WHERE enabled = ? AND site_id IN (${placeholders}) ORDER BY name`,
          [true, ...accessibleSiteIds]
        );
      }
    }
  },

  async getAssetHealthStatuses(): Promise<AssetHealthStatus[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<AssetHealthStatus>(
      'SELECT * FROM asset_health_status WHERE enabled = ? ORDER BY sort',
      [true]
    );
  },

  async getAssetIotStatuses(): Promise<AssetIotStatus[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<AssetIotStatus>(
      'SELECT * FROM asset_iot_status WHERE enabled = ? ORDER BY sort_order',
      [true]
    );
  },

  async getPointIotStatuses(): Promise<PointIotStatus[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<PointIotStatus>(
      'SELECT * FROM point_iot_status WHERE enabled = ? ORDER BY sort',
      [true]
    );
  },

  async getAssetTypes(): Promise<AssetType[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<AssetType>(
      'SELECT * FROM asset_types WHERE enabled = ? ORDER BY type',
      [true]
    );
  },

  async getGatewayStatuses(): Promise<GatewayStatus[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<GatewayStatus>(
      'SELECT * FROM gateway_status WHERE enabled = ? ORDER BY status',
      [true]
    );
  },

  async getGatewayIotStatuses(): Promise<GatewayIotStatus[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<GatewayIotStatus>(
      'SELECT * FROM gateway_iot_status WHERE enabled = ? ORDER BY sort_order',
      [true]
    );
  },

  async getGateways(siteId?: string): Promise<Gateway[]> {
    const powerSync = await getInitializedPowerSync();
    
    // Get accessible site IDs for current user
    const accessibleSiteIds = await retoolUserService.getAccessibleSiteIds();
    
    if (siteId) {
      // If filtering by specific site, check if user has access
      if (accessibleSiteIds !== null && !accessibleSiteIds.includes(siteId)) {
        return [];
      }
      return await powerSync.getAll<Gateway>(
        'SELECT * FROM gateways WHERE enabled = ? AND site_id = ? ORDER BY code',
        [true, siteId]
      );
    } else {
      // Filter gateways by accessible sites
      if (accessibleSiteIds === null) {
        // Admin - all sites accessible
        return await powerSync.getAll<Gateway>(
          'SELECT * FROM gateways WHERE enabled = ? ORDER BY code',
          [true]
        );
      } else if (accessibleSiteIds.length === 0) {
        // No accessible sites
        return [];
      } else {
        const placeholders = accessibleSiteIds.map(() => '?').join(',');
        return await powerSync.getAll<Gateway>(
          `SELECT * FROM gateways WHERE enabled = ? AND site_id IN (${placeholders}) ORDER BY code`,
          [true, ...accessibleSiteIds]
        );
      }
    }
  },

  /**
   * Get all companies
   */
  async getCompanies(): Promise<Company[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<Company>(
      'SELECT * FROM company WHERE enabled = ? ORDER BY name',
      [true]
    );
  },

  /**
   * Get company name by company_id
   */
  async getCompanyName(companyId: string | null | undefined): Promise<string | null> {
    if (!companyId) return null;
    
    try {
      const powerSync = await getInitializedPowerSync();
      const company = await powerSync.get<Company>(
        'SELECT * FROM company WHERE id = ? AND enabled = ?',
        [companyId, true]
      );
      
      if (company?.name) {
        return company.name;
      }
    } catch (error) {
      // If query fails, fall through
    }
    
    // Fallback: return company_id as the name (if it's stored as the name itself)
    return companyId;
  },

  /**
   * Create a new company
   */
  async createCompany(company: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<Company> {
    const powerSync = await getInitializedPowerSync();
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();
    
    // Generate UUID
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    await powerSync.execute(
      `INSERT INTO company (
        id, name, enabled, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        company.name || null,
        company.enabled ? 1 : 0,
        now,
        now,
        session?.user?.id || null,
      ]
    );

    const result = await powerSync.get<Company>(
      'SELECT * FROM company WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve created company');
    }
    return result;
  },
};

