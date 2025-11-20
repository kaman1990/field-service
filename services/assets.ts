import { getInitializedPowerSync } from '../lib/powersync';
import type { Asset, AssetAdditionalDetail, AssetHistory } from '../types/database';

export const assetService = {
  async getAssets(filters?: {
    search?: string;
    areaId?: string;
    type?: string;
    iotStatusId?: string;
    gatewayId?: string;
  }): Promise<Asset[]> {
    const powerSync = await getInitializedPowerSync();
    let sql = 'SELECT * FROM assets WHERE enabled = ?';
    const params: any[] = [true];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      sql += ' AND (name LIKE ? OR internal_id LIKE ? OR serial_no LIKE ? OR description LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters?.areaId) {
      sql += ' AND area_id = ?';
      params.push(filters.areaId);
    }
    
    if (filters?.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }
    
    if (filters?.iotStatusId) {
      sql += ' AND iot_status_id = ?';
      params.push(filters.iotStatusId);
    }
    
    if (filters?.gatewayId) {
      sql += ' AND gateway_id = ?';
      params.push(filters.gatewayId);
    }
    
    sql += ' ORDER BY name';
    
    return await powerSync.getAll<Asset>(sql, params);
  },

  async getAssetById(id: string): Promise<Asset | null> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getOptional<Asset>(
      'SELECT * FROM assets WHERE id = ?',
      [id]
    );
  },

  async createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
    const powerSync = await getInitializedPowerSync();
    const now = new Date().toISOString();
    // Generate UUID - using a simple method compatible with React Native
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    await powerSync.execute(
      `INSERT INTO assets (id, name, internal_id, serial_no, description, site_id, area_id, type, health_status_id, iot_status_id, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        asset.name,
        asset.internal_id || null,
        asset.serial_no || null,
        asset.description || null,
        asset.site_id || null,
        asset.area_id || null,
        asset.type || null,
        asset.health_status_id || null,
        asset.iot_status_id || null,
        asset.enabled ?? true,
        now,
        now
      ]
    );
    
    const result = await powerSync.get<Asset>(
      'SELECT * FROM assets WHERE id = ?',
      [id]
    );
    return result;
  },

  async updateAsset(id: string, asset: Partial<Asset>): Promise<Asset> {
    const powerSync = await getInitializedPowerSync();
    if (!powerSync || !powerSync.execute) {
      throw new Error('PowerSync is not initialized. Please ensure the app is connected.');
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    // Build dynamic update query for all possible fields
    const fields: (keyof Asset)[] = [
      'name',
      'internal_id',
      'description',
      'type',
      'manufacturer',
      'model',
      'serial_no',
      'notes',
      'install_notes',
      'action_notes',
      'image_url',
      'ei_machine_id',
      'area_id',
      'iot_status_id',
      'site_id',
      'health_status_id',
      'gateway_id',
      'survey_gateway_id',
      'orientation',
      'motor_type',
      'duty_cycle',
      'criticality',
      'expected_gateway',
      'vfd',
      'gearbox',
      'atex_area',
      'ambient_temp',
      'wash_down',
      'loto',
      'guard_removal',
      'guard_mod',
      'height_work',
      'confined_space',
      'restricted_access',
      'nameplate_missing',
      'install_approved',
      'fins',
      'sensors_m',
      'sensors_gb',
      'sensors_e',
      'enabled',
    ];
    
    for (const field of fields) {
      // Include field if it's explicitly set (even if null or empty string)
      // This ensures we can clear fields by setting them to null/empty
      if (asset[field] !== undefined) {
        updates.push(`${field} = ?`);
        // Convert boolean to integer for SQLite
        const value = asset[field];
        if (typeof value === 'boolean') {
          params.push(value ? 1 : 0);
        } else if (value === null) {
          params.push(null);
        } else if (value === '') {
          // Keep empty strings as empty strings, don't convert to null
          // This allows PowerSync to track the change properly
          params.push('');
        } else {
          params.push(value);
        }
      }
    }
    
    if (updates.length === 0) {
      // No updates to make, just return the current asset
      const result = await powerSync.get<Asset>(
        'SELECT * FROM assets WHERE id = ?',
        [id]
      );
      if (!result) {
        throw new Error('Asset not found');
      }
      return result;
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    await powerSync.execute(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const result = await powerSync.get<Asset>(
      'SELECT * FROM assets WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve updated asset');
    }
    return result;
  },

  async deleteAsset(id: string): Promise<void> {
    const powerSync = await getInitializedPowerSync();
    await powerSync.execute(
      'UPDATE assets SET enabled = ? WHERE id = ?',
      [false, id]
    );
  },

  async getAssetAdditionalDetails(assetId: string): Promise<AssetAdditionalDetail[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<AssetAdditionalDetail>(
      'SELECT * FROM asset_additional_details WHERE asset_id = ? AND enabled = ? ORDER BY field',
      [assetId, true]
    );
  },

  async getAssetHistory(assetId: string): Promise<AssetHistory[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<AssetHistory>(
      'SELECT * FROM asset_history WHERE asset_id = ? AND enabled = ? ORDER BY created_at DESC',
      [assetId, true]
    );
  },
};

