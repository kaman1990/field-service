import { getInitializedPowerSync } from '../lib/powersync';
import type { Site, Area, AssetHealthStatus, AssetIotStatus, PointIotStatus, AssetType, GatewayStatus, GatewayIotStatus, Gateway } from '../types/database';

export const lookupService = {
  async getSites(): Promise<Site[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<Site>(
      'SELECT * FROM sites WHERE enabled = ? ORDER BY name',
      [true]
    );
  },

  async getAreas(siteId?: string): Promise<Area[]> {
    const powerSync = await getInitializedPowerSync();
    if (siteId) {
      return await powerSync.getAll<Area>(
        'SELECT * FROM areas WHERE enabled = ? AND site_id = ? ORDER BY name',
        [true, siteId]
      );
    } else {
      return await powerSync.getAll<Area>(
        'SELECT * FROM areas WHERE enabled = ? ORDER BY name',
        [true]
      );
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
    if (siteId) {
      return await powerSync.getAll<Gateway>(
        'SELECT * FROM gateways WHERE enabled = ? AND site_id = ? ORDER BY code',
        [true, siteId]
      );
    } else {
      return await powerSync.getAll<Gateway>(
        'SELECT * FROM gateways WHERE enabled = ? ORDER BY code',
        [true]
      );
    }
  },
};

