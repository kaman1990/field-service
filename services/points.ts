import { getInitializedPowerSync } from '../lib/powersync';
import type { Point } from '../types/database';

export const pointService = {
  async getPoints(assetId: string, filters?: {
    search?: string;
    gatewayId?: string;
    iotStatusId?: string;
  }): Promise<Point[]> {
    const powerSync = await getInitializedPowerSync();
    let sql = 'SELECT * FROM points WHERE asset_id = ? AND enabled = ?';
    const params: any[] = [assetId, true];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      sql += ' AND (name LIKE ? OR serial_no LIKE ? OR full_serial_no LIKE ? OR description LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters?.gatewayId) {
      sql += ' AND gateway_id = ?';
      params.push(filters.gatewayId);
    }
    
    if (filters?.iotStatusId) {
      sql += ' AND iot_status_id = ?';
      params.push(filters.iotStatusId);
    }
    
    sql += ' ORDER BY name';
    
    return await powerSync.getAll<Point>(sql, params);
  },

  async getPointById(id: string): Promise<Point | null> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getOptional<Point>(
      'SELECT * FROM points WHERE id = ?',
      [id]
    );
  },

  async createPoint(point: Omit<Point, 'id' | 'created_at' | 'updated_at'>): Promise<Point> {
    const powerSync = await getInitializedPowerSync();
    const now = new Date().toISOString();
    // Generate UUID - using a simple method compatible with React Native
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    await powerSync.execute(
      `INSERT INTO points (id, name, description, serial_no, full_serial_no, notes, bearing, sensor_orientation, asset_part, position, asset_id, gateway_id, pref_gateway_id, site_id, iot_status_id, mean_x, mean_y, mean_z, sd_x, sd_y, sd_z, calc_satisfactory, calc_warning, calc_alarm, temp_satisfactory, temp_warning, temp_alarm, iso_warning, iso_alarm, satisfactory, warning, alarm, iso_satisfactory, speed, readings_last_day, waveform_last_day, last_reading, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        point.name,
        point.description || null,
        point.serial_no || null,
        point.full_serial_no || null,
        point.notes || null,
        point.bearing || null,
        point.sensor_orientation || null,
        point.asset_part || null,
        point.position || null,
        point.asset_id || null,
        point.gateway_id || null,
        point.pref_gateway_id || null,
        point.site_id || null,
        point.iot_status_id || null,
        point.mean_x || null,
        point.mean_y || null,
        point.mean_z || null,
        point.sd_x || null,
        point.sd_y || null,
        point.sd_z || null,
        point.calc_satisfactory || null,
        point.calc_warning || null,
        point.calc_alarm || null,
        point.temp_satisfactory || null,
        point.temp_warning || null,
        point.temp_alarm || null,
        point.iso_warning || null,
        point.iso_alarm || null,
        point.satisfactory || null,
        point.warning || null,
        point.alarm || null,
        point.iso_satisfactory || null,
        point.speed || null,
        point.readings_last_day || null,
        point.waveform_last_day || null,
        point.last_reading || null,
        point.enabled ?? true,
        now,
        now
      ]
    );
    
    const result = await powerSync.get<Point>(
      'SELECT * FROM points WHERE id = ?',
      [id]
    );
    return result;
  },

  async updatePoint(id: string, point: Partial<Point>): Promise<Point> {
    const powerSync = await getInitializedPowerSync();
    if (!powerSync || !powerSync.execute) {
      throw new Error('PowerSync is not initialized. Please ensure the app is connected.');
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    // Build dynamic update query for all possible fields
    const fields: (keyof Point)[] = [
      'name',
      'description',
      'serial_no',
      'full_serial_no',
      'notes',
      'bearing',
      'sensor_orientation',
      'asset_part',
      'position',
      'asset_id',
      'gateway_id',
      'pref_gateway_id',
      'site_id',
      'iot_status_id',
      'mean_x',
      'mean_y',
      'mean_z',
      'sd_x',
      'sd_y',
      'sd_z',
      'calc_satisfactory',
      'calc_warning',
      'calc_alarm',
      'temp_satisfactory',
      'temp_warning',
      'temp_alarm',
      'iso_warning',
      'iso_alarm',
      'satisfactory',
      'warning',
      'alarm',
      'iso_satisfactory',
      'speed',
      'readings_last_day',
      'waveform_last_day',
      'last_reading',
      'enabled',
    ];
    
    for (const field of fields) {
      // Include field if it's explicitly set (even if null or empty string)
      // This ensures we can clear fields by setting them to null/empty
      if (point[field] !== undefined) {
        updates.push(`${field} = ?`);
        // Convert boolean to integer for SQLite
        const value = point[field];
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
      // No updates to make, just return the current point
      const result = await powerSync.get<Point>(
        'SELECT * FROM points WHERE id = ?',
        [id]
      );
      if (!result) {
        throw new Error('Point not found');
      }
      return result;
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    await powerSync.execute(
      `UPDATE points SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const result = await powerSync.get<Point>(
      'SELECT * FROM points WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve updated point');
    }
    return result;
  },

  async deletePoint(id: string): Promise<void> {
    const powerSync = await getInitializedPowerSync();
    await powerSync.execute(
      'UPDATE points SET enabled = ? WHERE id = ?',
      [false, id]
    );
  },
};
