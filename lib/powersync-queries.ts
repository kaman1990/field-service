import { QueryParam } from '@powersync/react-native';
import { getPowerSync } from './powersync';

// Cache for table name mappings (to avoid repeated queries)
let tableNameCache: Map<string, string> = new Map();

/**
 * Initialize table name cache by checking what tables actually exist
 * Call this once when the app starts or when PowerSync connects
 */
export async function initializeTableNames(): Promise<void> {
  try {
    const powerSync = getPowerSync();
    const allTables = await powerSync.getAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'ps_%' ORDER BY name"
    );
    
    const tableNames = allTables.map(t => t.name);
    
    // Map table names (prioritize schema-defined names)
    const assetsTable = tableNames.find(t => t === 'assets' || t === 'public_assets' || t === 'public.assets');
    if (assetsTable) tableNameCache.set('assets', assetsTable);
    
    const gatewaysTable = tableNames.find(t => t === 'gateways' || t === 'public_gateways' || t === 'public.gateways');
    if (gatewaysTable) tableNameCache.set('gateways', gatewaysTable);
    
    const pointsTable = tableNames.find(t => t === 'points' || t === 'public_points' || t === 'public.points');
    if (pointsTable) tableNameCache.set('points', pointsTable);

    const imagesTable = tableNames.find(t => t === 'images' || t === 'public_images' || t === 'public.images');
    if (imagesTable) tableNameCache.set('images', imagesTable);
    
    // Map lookup tables
    const lookupTables = ['sites', 'areas', 'asset_health_status', 'asset_iot_status', 'point_iot_status', 'asset_types', 'gateway_status'];
    for (const tableName of lookupTables) {
      const found = tableNames.find(t => t === tableName);
      if (found) tableNameCache.set(tableName, found);
    }
  } catch (error) {
    // Error initializing table names
  }
}

/**
 * Get the actual table name for a base table name
 * Exported so it can be used in direct queries
 */
export function getTableName(baseName: string): string {
  return tableNameCache.get(baseName) || baseName;
}

/**
 * Helper function to build SQL query with filters for assets
 */
export function buildAssetsQuery(filters?: {
  search?: string;
  areaId?: string;
  type?: string;
  iotStatusId?: string;
  gatewayId?: string;
}): { sql: string; params: QueryParam[] } {
  const tableName = getTableName('assets');
  let sql = `SELECT * FROM ${tableName} WHERE enabled = ?`;
  const params: QueryParam[] = [true];
  
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
  
  return { sql, params };
}

/**
 * Helper function to build SQL query with filters for gateways
 */
export function buildGatewaysQuery(filters?: {
  search?: string;
  areaId?: string;
  statusId?: string;
  iotStatusId?: string;
  connectionType?: string;
}): { sql: string; params: QueryParam[] } {
  const tableName = getTableName('gateways');
  let sql = `SELECT * FROM ${tableName} WHERE enabled = ?`;
  const params: QueryParam[] = [true];
  
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
  
  if (filters?.iotStatusId) {
    sql += ' AND iot_status_id = ?';
    params.push(filters.iotStatusId);
  }
  
  if (filters?.connectionType) {
    sql += ' AND connection_type = ?';
    params.push(filters.connectionType);
  }
  
  sql += ' ORDER BY code';
  
  return { sql, params };
}

/**
 * Helper function to build SQL query with filters for points
 */
export function buildPointsQuery(assetId: string, filters?: {
  search?: string;
  gatewayId?: string;
  iotStatusId?: string;
}): { sql: string; params: QueryParam[] } {
  const tableName = getTableName('points');
  let sql = `SELECT * FROM ${tableName} WHERE asset_id = ? AND enabled = ?`;
  const params: QueryParam[] = [assetId, true];
  
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
  
  return { sql, params };
}

export function buildImagesQuery(
  entityType: 'asset' | 'point' | 'gateway',
  entityId: string
): { sql: string; params: QueryParam[] } {
  const tableName = getTableName('images');
  const columnMap = {
    asset: 'asset_id',
    point: 'point_id',
    gateway: 'gateway_id',
  } as const;
  const column = columnMap[entityType];
  const sql = `SELECT * FROM ${tableName} WHERE ${column} = ? AND enabled = ? ORDER BY created_at DESC`;
  const params: QueryParam[] = [entityId, true];
  return { sql, params };
}

