import { getInitializedPowerSync } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import type { RetoolUser, UserSite } from '../types/database';

export const retoolUserService = {
  async getRetoolUserByAuthId(authId: string): Promise<RetoolUser | null> {
    const powerSync = await getInitializedPowerSync();
    const result = await powerSync.get<RetoolUser>(
      'SELECT * FROM retool_users WHERE auth_id = ?',
      [authId]
    );
    return result || null;
  },

  /**
   * Get accessible site IDs for the current user (for dropdowns/pickers)
   * Returns null if user is admin (meaning all sites are accessible)
   * Returns array of site IDs if user is not admin
   */
  async getAccessibleSiteIds(): Promise<string[] | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return [];
    }

    const user = await this.getRetoolUserByAuthId(session.user.id);
    if (!user) {
      return [];
    }

    // If user is admin, return null to indicate all sites are accessible
    if (user.is_admin) {
      return null;
    }

    // Get site IDs from user_sites table
    const powerSync = await getInitializedPowerSync();
    const userSites = await powerSync.getAll<UserSite>(
      'SELECT site_id FROM user_sites WHERE user_id = ? AND enabled = ?',
      [user.id, true]
    );

    return userSites.map(us => us.site_id);
  },

  /**
   * Get the current user's default site ID
   * Returns null if user is admin or has no default site
   */
  async getDefaultSiteId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return null;
    }

    const user = await this.getRetoolUserByAuthId(session.user.id);
    if (!user) {
      return null;
    }

    // If user is admin, return null (they see all sites)
    if (user.is_admin) {
      return null;
    }

    return user.default_site_id || null;
  },

  async updateDefaultSiteId(authId: string, defaultSiteId: string | null): Promise<RetoolUser> {
    const powerSync = await getInitializedPowerSync();
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

  /**
   * Create a new retool_users record (after Supabase user is created)
   */
  async createRetoolUser(data: {
    auth_id: string;
    email?: string;
    name?: string;
    is_admin?: boolean;
    enabled?: boolean;
  }): Promise<RetoolUser> {
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
      `INSERT INTO retool_users (
        id, auth_id, email, name, is_admin, enabled, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.auth_id,
        data.email || null,
        data.name || null,
        data.is_admin ? 1 : 0,
        data.enabled !== false ? 1 : 0,
        now,
        now,
        session?.user?.id || null,
      ]
    );

    const result = await powerSync.get<RetoolUser>(
      'SELECT * FROM retool_users WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve created retool_users record');
    }
    return result;
  },

  /**
   * Update a retool_users record
   */
  async updateRetoolUser(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      is_admin?: boolean;
      enabled?: boolean;
      default_site_id?: string | null;
      default_company_id?: string | null;
    }
  ): Promise<RetoolUser> {
    const powerSync = await getInitializedPowerSync();
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name || null);
    }
    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updates.email || null);
    }
    if (updates.is_admin !== undefined) {
      updateFields.push('is_admin = ?');
      updateValues.push(updates.is_admin ? 1 : 0);
    }
    if (updates.enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(updates.enabled ? 1 : 0);
    }
    if (updates.default_site_id !== undefined) {
      updateFields.push('default_site_id = ?');
      updateValues.push(updates.default_site_id || null);
    }
    if (updates.default_company_id !== undefined) {
      updateFields.push('default_company_id = ?');
      updateValues.push(updates.default_company_id || null);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = ?');
    updateValues.push(now);

    if (session?.user?.id) {
      updateFields.push('updated_by = ?');
      updateValues.push(session.user.id);
    }

    updateValues.push(userId);

    await powerSync.execute(
      `UPDATE retool_users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const result = await powerSync.get<RetoolUser>(
      'SELECT * FROM retool_users WHERE id = ?',
      [userId]
    );
    if (!result) {
      throw new Error('Failed to retrieve updated retool_users record');
    }
    return result;
  },

  /**
   * Get a retool_users record by ID
   */
  async getRetoolUserById(userId: string): Promise<RetoolUser | null> {
    const powerSync = await getInitializedPowerSync();
    const result = await powerSync.get<RetoolUser>(
      'SELECT * FROM retool_users WHERE id = ?',
      [userId]
    );
    return result || null;
  },
};

