import { getPowerSync } from '../lib/powersync';
import type { RetoolUser } from '../types/database';

const powerSync = getPowerSync();

export const retoolUserService = {
  async getRetoolUserByAuthId(authId: string): Promise<RetoolUser | null> {
    const result = await powerSync.get<RetoolUser>(
      'SELECT * FROM retool_users WHERE auth_id = ?',
      [authId]
    );
    return result || null;
  },

  async updateDefaultSiteId(authId: string, defaultSiteId: string | null): Promise<RetoolUser> {
    const existing = await this.getRetoolUserByAuthId(authId);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing record
      await powerSync.execute(
        'UPDATE retool_users SET default_site_id = ?, updated_at = ? WHERE auth_id = ?',
        [defaultSiteId || null, now, authId]
      );

      const result = await powerSync.get<RetoolUser>(
        'SELECT * FROM retool_users WHERE auth_id = ?',
        [authId]
      );
      if (!result) {
        throw new Error('Failed to retrieve updated retool_users record');
      }
      return result;
    } else {
      // Create new record - only set minimal required fields
      const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      await powerSync.execute(
        'INSERT INTO retool_users (id, auth_id, default_site_id, created_at, updated_at, enabled) VALUES (?, ?, ?, ?, ?, ?)',
        [id, authId, defaultSiteId || null, now, now, 1]
      );

      const result = await powerSync.get<RetoolUser>(
        'SELECT * FROM retool_users WHERE auth_id = ?',
        [authId]
      );
      if (!result) {
        throw new Error('Failed to retrieve created retool_users record');
      }
      return result;
    }
  },
};

