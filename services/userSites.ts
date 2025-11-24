import { getInitializedPowerSync } from '../lib/powersync';
import type { UserSite, RetoolUser } from '../types/database';

export const userSitesService = {
  /**
   * Get all users (for admin management)
   */
  async getAllUsers(): Promise<RetoolUser[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<RetoolUser>(
      'SELECT * FROM retool_users WHERE enabled = ? ORDER BY name, email',
      [true]
    );
  },

  /**
   * Get all site assignments for a specific user
   */
  async getUserSites(userId: string): Promise<UserSite[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<UserSite>(
      'SELECT * FROM user_sites WHERE user_id = ? AND (deleted_at IS NULL OR deleted_at = ?) ORDER BY site_id',
      [userId, '']
    );
  },

  /**
   * Assign a user to a site
   */
  async assignUserToSite(userId: string, siteId: string): Promise<UserSite> {
    const powerSync = await getInitializedPowerSync();
    const now = new Date().toISOString();

    // Check if assignment already exists using getAll to avoid "Result set is empty" error
    let existing: UserSite | null = null;
    try {
      const existingRecords = await powerSync.getAll<UserSite>(
        'SELECT * FROM user_sites WHERE user_id = ? AND site_id = ?',
        [userId, siteId]
      );
      existing = existingRecords.length > 0 ? existingRecords[0] : null;
    } catch (error: any) {
      // If getAll fails, assume record doesn't exist
      console.log('Error checking for existing record:', error.message);
      existing = null;
    }

    if (existing) {
      // Update existing assignment to enable it
      await powerSync.execute(
        'UPDATE user_sites SET enabled = ?, updated_at = ?, deleted_at = ?, deleted_by = ? WHERE user_id = ? AND site_id = ?',
        [true, now, null, null, userId, siteId]
      );

      // Return the existing record with updated values (don't try to fetch it back)
      return { ...existing, enabled: true, updated_at: now, deleted_at: null, deleted_by: null };
    } else {
      // Create new assignment
      const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      await powerSync.execute(
        'INSERT INTO user_sites (id, user_id, site_id, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, siteId, true, now, now]
      );

      // Return a constructed record (don't try to fetch it back immediately)
      return {
        id,
        user_id: userId,
        site_id: siteId,
        enabled: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        deleted_by: null,
      } as UserSite;
    }
  },

  /**
   * Remove a user from a site (soft delete)
   */
  async removeUserFromSite(userId: string, siteId: string): Promise<void> {
    const powerSync = await getInitializedPowerSync();
    const now = new Date().toISOString();

    await powerSync.execute(
      'UPDATE user_sites SET enabled = ?, deleted_at = ?, updated_at = ? WHERE user_id = ? AND site_id = ?',
      [false, now, now, userId, siteId]
    );
  },

  /**
   * Get all site assignments for all users (for admin view)
   */
  async getAllUserSites(): Promise<UserSite[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<UserSite>(
      'SELECT * FROM user_sites WHERE (deleted_at IS NULL OR deleted_at = ?) ORDER BY user_id, site_id',
      ['']
    );
  },

  /**
   * Get all users assigned to a specific site
   */
  async getSiteUsers(siteId: string): Promise<UserSite[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<UserSite>(
      'SELECT * FROM user_sites WHERE site_id = ? AND enabled = ? AND (deleted_at IS NULL OR deleted_at = ?) ORDER BY user_id',
      [siteId, true, '']
    );
  },
};

