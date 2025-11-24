import { getInitializedPowerSync } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import type { Site } from '../types/database';

export const sitesService = {
  /**
   * Get all sites (for admin management)
   */
  async getAllSites(): Promise<Site[]> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getAll<Site>(
      'SELECT * FROM sites WHERE enabled = ? ORDER BY company_id, name',
      [true]
    );
  },

  /**
   * Get site by ID
   */
  async getSiteById(id: string): Promise<Site | null> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getOptional<Site>(
      'SELECT * FROM sites WHERE id = ?',
      [id]
    );
  },

  /**
   * Create a new site
   */
  async createSite(site: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> {
    const powerSync = await getInitializedPowerSync();
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();
    
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    await powerSync.execute(
      `INSERT INTO sites (
        id, name, description, location, company_id,
        survey_engineers, survey_date, install_engineers, install_date,
        enabled, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        site.name || null,
        site.description || null,
        site.location || null,
        site.company_id || null,
        site.survey_engineers || null,
        site.survey_date || null,
        site.install_engineers || null,
        site.install_date || null,
        site.enabled ? 1 : 0,
        now,
        now,
        session?.user?.id || null,
      ]
    );

    const result = await powerSync.get<Site>(
      'SELECT * FROM sites WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve created site');
    }
    return result;
  },

  /**
   * Update a site
   */
  async updateSite(id: string, site: Partial<Site>): Promise<Site> {
    const powerSync = await getInitializedPowerSync();
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();

    const updates: string[] = [];
    const params: any[] = [];

    // Build dynamic update query
    const fields: (keyof Site)[] = [
      'name',
      'description',
      'location',
      'company_id',
      'survey_engineers',
      'survey_date',
      'install_engineers',
      'install_date',
      'enabled',
    ];

    for (const field of fields) {
      if (site[field] !== undefined) {
        updates.push(`${field} = ?`);
        const value = site[field];
        if (typeof value === 'boolean') {
          params.push(value ? 1 : 0);
        } else {
          params.push(value ?? null);
        }
      }
    }

    if (updates.length === 0) {
      // No updates, just return current site
      const current = await this.getSiteById(id);
      if (!current) {
        throw new Error('Site not found');
      }
      return current;
    }

    updates.push('updated_at = ?');
    updates.push('updated_by = ?');
    params.push(now, session?.user?.id || null);
    params.push(id);

    await powerSync.execute(
      `UPDATE sites SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const result = await powerSync.get<Site>(
      'SELECT * FROM sites WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Failed to retrieve updated site');
    }
    return result;
  },

  /**
   * Delete a site (soft delete)
   */
  async deleteSite(id: string): Promise<void> {
    const powerSync = await getInitializedPowerSync();
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();

    await powerSync.execute(
      'UPDATE sites SET enabled = ?, deleted_at = ?, updated_at = ?, deleted_by = ? WHERE id = ?',
      [false, now, now, session?.user?.id || null, id]
    );
  },
};

