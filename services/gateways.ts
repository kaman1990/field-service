import { getInitializedPowerSync } from '../lib/powersync';
import type { Gateway, Point } from '../types/database';

export const gatewayService = {
  async getGateways(filters?: {
    search?: string;
    areaId?: string;
    statusId?: string;
    connectionType?: string;
  }): Promise<Gateway[]> {
    const powerSync = await getInitializedPowerSync();
    let sql = 'SELECT * FROM gateways WHERE enabled = ?';
    const params: any[] = [true];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      sql += ' AND (code LIKE ? OR description LIKE ? OR serial_no LIKE ? OR mac_address LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters?.areaId) {
      sql += ' AND area_id = ?';
      params.push(filters.areaId);
    }
    
    if (filters?.statusId) {
      sql += ' AND status_id = ?';
      params.push(filters.statusId);
    }
    
    if (filters?.connectionType) {
      sql += ' AND connection_type = ?';
      params.push(filters.connectionType);
    }
    
    sql += ' ORDER BY code';
    
    return await powerSync.getAll<Gateway>(sql, params);
  },

  async getGatewayById(id: string): Promise<Gateway | null> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getOptional<Gateway>(
      'SELECT * FROM gateways WHERE id = ?',
      [id]
    );
  },

  async createGateway(gateway: Omit<Gateway, 'id' | 'created_at' | 'updated_at'>): Promise<Gateway> {
    const powerSync = await getInitializedPowerSync();
    const now = new Date().toISOString();
    // Generate UUID - using a simple method compatible with React Native
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    await powerSync.execute(
      `INSERT INTO gateways (id, code, description, serial_no, mac_address, ip_address, location, router, version, notes, action_notes, connection_type, mount_type, power_type, site_id, area_id, status_id, online, power_required, poe_required, router_required, flex_required, atex_area, install_approved, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        gateway.code || null,
        gateway.description || null,
        gateway.serial_no || null,
        gateway.mac_address || null,
        gateway.ip_address || null,
        gateway.location || null,
        gateway.router || null,
        gateway.version || null,
        gateway.notes || null,
        gateway.action_notes || null,
        gateway.connection_type || null,
        gateway.mount_type || null,
        gateway.power_type || null,
        gateway.site_id || null,
        gateway.area_id || null,
        gateway.status_id || null,
        gateway.online ?? null,
        gateway.power_required ?? null,
        gateway.poe_required ?? null,
        gateway.router_required ?? null,
        gateway.flex_required ?? null,
        gateway.atex_area ?? null,
        gateway.install_approved ?? false,
        gateway.enabled ?? true,
        now,
        now
      ]
    );
    
    const result = await powerSync.get<Gateway>(
      'SELECT * FROM gateways WHERE id = ?',
      [id]
    );
    return result;
  },

  async updateGateway(id: string, gateway: Partial<Gateway>): Promise<Gateway> {
    const powerSync = await getInitializedPowerSync();
    if (!powerSync || !powerSync.execute) {
      throw new Error('PowerSync is not initialized. Please ensure the app is connected.');
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    // Build dynamic update query for all possible fields
    const fields: (keyof Gateway)[] = [
      'code',
      'description',
      'serial_no',
      'mac_address',
      'ip_address',
      'location',
      'router',
      'version',
      'notes',
      'action_notes',
      'connection_type',
      'mount_type',
      'power_type',
      'site_id',
      'area_id',
      'status_id',
      'online',
      'power_required',
      'poe_required',
      'router_required',
      'flex_required',
      'atex_area',
      'install_approved',
      'enabled',
    ];
    
    for (const field of fields) {
      // Include field if it's explicitly set (even if null or empty string)
      // This ensures we can clear fields by setting them to null/empty
      if (gateway[field] !== undefined) {
        updates.push(`${field} = ?`);
        // Convert boolean to integer for SQLite
        const value = gateway[field];
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
      // No updates to make, just return the current gateway
      const result = await powerSync.get<Gateway>(
        'SELECT * FROM gateways WHERE id = ?',
        [id]
      );
      if (!result) {
        throw new Error('Gateway not found');
      }
      return result;
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    await powerSync.execute(
      `UPDATE gateways SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const result = await powerSync.get<Gateway>(
      'SELECT * FROM gateways WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve updated gateway');
    }
    return result;
  },

  async deleteGateway(id: string): Promise<void> {
    const powerSync = await getInitializedPowerSync();
    await powerSync.execute(
      'UPDATE gateways SET enabled = ? WHERE id = ?',
      [false, id]
    );
  },

  async getGatewayPoints(gatewayId: string): Promise<Point[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<Point>(
      'SELECT * FROM points WHERE gateway_id = ? AND enabled = ? ORDER BY name',
      [gatewayId, true]
    );
  },
};
