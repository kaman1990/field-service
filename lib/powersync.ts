import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Platform-specific PowerSync imports
// Metro config will handle platform-specific resolution, but we use require() to be safe
let PowerSyncDatabaseNative: any;
let PowerSyncDatabaseWeb: any;
let SQLJSOpenFactory: any;
let WASQLiteOpenFactory: any;
let Schema: any;
let UpdateType: any;
let column: any;
let Table: any;
let PowerSyncBackendConnector: any;
let AbstractPowerSyncDatabase: any;

// Import AttachmentTable from @powersync/attachments
let AttachmentTable: any;
try {
  const attachmentsLib = require('@powersync/attachments');
  AttachmentTable = attachmentsLib.AttachmentTable;
} catch (error) {
  // Attachment library not available
}

const IS_WEB = Platform.OS === 'web';

if (IS_WEB) {
  // Web platform - use web SDK
  try {
    const webSDK = require('@powersync/web');
    PowerSyncDatabaseWeb = webSDK.PowerSyncDatabase;
    WASQLiteOpenFactory = webSDK.WASQLiteOpenFactory;
    // Import common types from web SDK
    Schema = webSDK.Schema;
    UpdateType = webSDK.UpdateType;
    column = webSDK.column;
    Table = webSDK.Table;
    PowerSyncBackendConnector = webSDK.PowerSyncBackendConnector;
    AbstractPowerSyncDatabase = webSDK.AbstractPowerSyncDatabase;
  } catch (error) {
    // Web SDK not available
  }
} else {
  // Native platform - use React Native SDK
  try {
    const nativeSDK = require('@powersync/react-native');
    PowerSyncDatabaseNative = nativeSDK.PowerSyncDatabase;
    Schema = nativeSDK.Schema;
    UpdateType = nativeSDK.UpdateType;
    column = nativeSDK.column;
    Table = nativeSDK.Table;
    PowerSyncBackendConnector = nativeSDK.PowerSyncBackendConnector;
    AbstractPowerSyncDatabase = nativeSDK.AbstractPowerSyncDatabase;
    const sqljsAdapter = require('@powersync/adapter-sql-js');
    SQLJSOpenFactory = sqljsAdapter.SQLJSOpenFactory;
  } catch (error) {
    // Native SDK not available
  }
}

// PowerSync configuration
const POWER_SYNC_URL = Constants.expoConfig?.extra?.powersyncUrl || process.env.EXPO_PUBLIC_POWERSYNC_URL || '';

// Define the database schema
// PowerSync uses this schema to create typed views of the synced data
// Note: PowerSync automatically creates an 'id' primary key column, so we don't need to define it

const assets = new Table({
  name: column.text,
  internal_id: column.text,
  description: column.text,
  type: column.text,
  manufacturer: column.text,
  model: column.text,
  serial_no: column.text,
  notes: column.text,
  install_notes: column.text,
  action_notes: column.text,
  image_url: column.text,
  ei_machine_id: column.integer,
  area_id: column.text,
  iot_status_id: column.text,
  site_id: column.text,
  health_status_id: column.text,
  gateway_id: column.text,
  survey_gateway_id: column.text,
  orientation: column.text,
  motor_type: column.text,
  duty_cycle: column.text,
  criticality: column.text,
  expected_gateway: column.text,
  vfd: column.integer, // boolean as integer
  gearbox: column.integer,
  atex_area: column.integer,
  ambient_temp: column.integer,
  wash_down: column.integer,
  loto: column.integer,
  guard_removal: column.integer,
  guard_mod: column.integer,
  height_work: column.integer,
  confined_space: column.integer,
  restricted_access: column.integer,
  nameplate_missing: column.integer,
  install_approved: column.integer,
  fins: column.integer,
  sensors_m: column.integer,
  sensors_gb: column.integer,
  sensors_e: column.integer,
  image_count: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    site: ['site_id'],
    area: ['area_id'],
    iot_status: ['iot_status_id'],
    health_status: ['health_status_id'],
  }
});

const points = new Table({
  name: column.text,
  description: column.text,
  serial_no: column.integer,
  full_serial_no: column.text,
  notes: column.text,
  bearing: column.text,
  sensor_orientation: column.text,
  asset_part: column.text,
  position: column.text,
  asset_id: column.text,
  gateway_id: column.text,
  pref_gateway_id: column.text,
  site_id: column.text,
  iot_status_id: column.text,
  mean_x: column.real,
  mean_y: column.real,
  mean_z: column.real,
  sd_x: column.real,
  sd_y: column.real,
  sd_z: column.real,
  calc_satisfactory: column.real,
  calc_warning: column.real,
  calc_alarm: column.real,
  temp_satisfactory: column.real,
  temp_warning: column.real,
  temp_alarm: column.real,
  iso_warning: column.real,
  iso_alarm: column.real,
  satisfactory: column.real,
  warning: column.real,
  alarm: column.real,
  iso_satisfactory: column.real,
  speed: column.real,
  readings_last_day: column.integer,
  waveform_last_day: column.integer,
  last_reading: column.text,
  internal_id: column.text,
  image_count: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    asset: ['asset_id'],
    gateway: ['gateway_id'],
    iot_status: ['iot_status_id'],
  }
});

const gateways = new Table({
  code: column.text,
  description: column.text,
  serial_no: column.integer,
  mac_address: column.text,
  ip_address: column.text,
  location: column.text,
  router: column.text,
  version: column.text,
  notes: column.text,
  action_notes: column.text,
  connection_type: column.text,
  mount_type: column.text,
  power_type: column.text,
  site_id: column.text,
  area_id: column.text,
  status_id: column.text,
  iot_status_id: column.text,
  internal_id: column.text,
  online: column.integer,
  power_required: column.integer,
  poe_required: column.integer,
  router_required: column.integer,
  flex_required: column.integer,
  atex_area: column.integer,
  install_approved: column.integer,
  image_count: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    site: ['site_id'],
    area: ['area_id'],
    status: ['status_id'],
    iot_status: ['iot_status_id'],
  }
});

const sites = new Table({
  name: column.text,
  description: column.text,
  location: column.text,
  company_id: column.text,
  survey_engineers: column.text,
  survey_date: column.text,
  install_engineers: column.text,
  install_date: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const areas = new Table({
  name: column.text,
  description: column.text,
  location: column.text,
  site_id: column.text,
  ei_area_id: column.integer,
  atex_area: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    site: ['site_id'],
  }
});

const asset_health_status = new Table({
  status: column.text,
  sort: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const asset_iot_status = new Table({
  status: column.text,
  code: column.text,
  sort_order: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const point_iot_status = new Table({
  status: column.text,
  code: column.text,
  sort: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const asset_types = new Table({
  type: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const gateway_status = new Table({
  status: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const gateway_iot_status = new Table({
  status: column.text,
  code: column.text,
  sort_order: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

const images = new Table({
  image_url: column.text,
  image_id: column.text, // Storage bucket filename
  asset_id: column.text,
  point_id: column.text,
  gateway_id: column.text,
  site_id: column.text,
  default: column.integer,
  valid: column.integer,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    asset: ['asset_id'],
    point: ['point_id'],
    gateway: ['gateway_id'],
  }
});

const asset_additional_details = new Table({
  asset_id: column.text,
  field: column.text,
  value: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    asset: ['asset_id'],
  }
});

const asset_history = new Table({
  asset_id: column.text,
  description: column.text,
  details: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    asset: ['asset_id'],
  }
});

const retool_users = new Table({
  created_at: column.text,
  email: column.text,
  default_site_id: column.text,
  name: column.text,
  is_admin: column.integer,
  image_url: column.text,
  default_company_id: column.text,
  show_search: column.integer,
  app_mode: column.text,
  updated_at: column.text,
  enabled: column.integer,
  created_by: column.text,
  updated_by: column.text,
  auth_id: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    auth_id: ['auth_id'],
  }
});

const user_sites = new Table({
  user_id: column.text,
  site_id: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
}, {
  indexes: {
    user_id: ['user_id'],
    site_id: ['site_id'],
  }
});

const company = new Table({
  name: column.text,
  enabled: column.integer,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  deleted_by: column.text,
});

// Create attachments table if AttachmentTable is available
const attachments = AttachmentTable ? new AttachmentTable({
  name: 'attachments',
}) : null;

// Create the schema with all tables
const AppSchema = new Schema({
  assets,
  points,
  gateways,
  sites,
  areas,
  asset_health_status,
  asset_iot_status,
  point_iot_status,
  asset_types,
  gateway_status,
  gateway_iot_status,
  images,
  asset_additional_details,
  asset_history,
  retool_users,
  user_sites,
  company,
  ...(attachments ? { attachments } : {}),
});

// Export types for use in the app
export type Database = (typeof AppSchema)['types'];

// Create PowerSync connector
class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    if (!POWER_SYNC_URL) {
      throw new Error('PowerSync URL is not configured. Please set powersyncUrl in app.json');
    }
    
    // Get the current Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw error;
    }
    
    if (!session) {
      return null; // Return null if user is not signed in - PowerSync will retry
    }

    if (!session.access_token) {
      throw new Error('Supabase session has no access token');
    }

    const credentials = {
      endpoint: POWER_SYNC_URL,
      token: session.access_token,
    };
    
    return credentials;
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    let transaction = await database.getNextCrudTransaction();
    
    while (transaction) {
      try {
        // Group operations by table and type to batch them more efficiently
        const operationsByTable = new Map<string, Array<{ op: any; opType: any; opData: any; id?: string }>>();
        
        for (const op of transaction.crud) {
          const table = op.table;
          const key = `${table}_${op.op}`;
          
          if (!operationsByTable.has(key)) {
            operationsByTable.set(key, []);
          }
          
          operationsByTable.get(key)!.push({
            op,
            opType: op.op,
            opData: op.opData || {},
            id: op.id,
          });
        }
        
        // Process operations in batches, grouped by table and operation type
        for (const [key, operations] of operationsByTable.entries()) {
          // Split by last underscore since table names can contain underscores
          const lastUnderscoreIndex = key.lastIndexOf('_');
          const table = key.substring(0, lastUnderscoreIndex);
          const opType = key.substring(lastUnderscoreIndex + 1);
          
          if (opType === UpdateType.PUT) {
            // Batch upserts - Supabase supports batch upserts
            const dataToUpsert = operations.map(op => op.opData);
            const { error } = await supabase.from(table).upsert(dataToUpsert);
            if (error) throw error;
          } else if (opType === UpdateType.PATCH) {
            // Process updates individually (Supabase doesn't support batch updates easily)
            // But limit concurrency to avoid overwhelming connections
            const BATCH_SIZE = 10;
            for (let i = 0; i < operations.length; i += BATCH_SIZE) {
              const batch = operations.slice(i, i + BATCH_SIZE);
              await Promise.all(
                batch.map(async (op) => {
                  const { error } = await supabase.from(table).update(op.opData).eq('id', op.id);
                  if (error) throw error;
                })
              );
            }
          } else if (opType === UpdateType.DELETE) {
            // Batch deletes - collect all IDs and delete in one query
            const idsToDelete = operations.map(op => op.id).filter(Boolean);
            if (idsToDelete.length > 0) {
              const { error } = await supabase.from(table).delete().in('id', idsToDelete);
              if (error) throw error;
            }
          }
        }
        
        await transaction.complete();
      } catch (error) {
        // Don't throw immediately - allow transaction to complete or rollback properly
        // This prevents leaving connections open
        await transaction.complete().catch(() => {
          // Ignore completion errors if transaction is already failed
        });
        throw error;
      }
      
      transaction = await database.getNextCrudTransaction();
    }
  }
}

// Initialize PowerSync database
let powerSyncInstance: any = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Get PowerSync instance, ensuring it's initialized
 */
export const getInitializedPowerSync = async (): Promise<any> => {
  const instance = getPowerSync();
  
  if (initializationPromise) {
    await initializationPromise;
  }
  
  if (!instance) {
    throw new Error('PowerSync instance is null');
  }
  
  if (!instance.execute) {
    // Try to wait a bit more in case initialization is still in progress
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!instance.execute) {
      throw new Error('PowerSync instance does not have execute method after initialization');
    }
  }
  
  return instance;
};

export const getPowerSync = (): any => {
  if (!powerSyncInstance) {
    try {
      const connector = new SupabaseConnector();
      
      if (IS_WEB) {
        // Web platform - use PowerSyncDatabaseWeb with WASQLite
        if (!PowerSyncDatabaseWeb || !WASQLiteOpenFactory) {
          throw new Error('PowerSync Web SDK not available');
        }
        
        const factory = new WASQLiteOpenFactory({
          dbFilename: 'field_asset_management.db',
          worker: '/@powersync/worker/WASQLiteDB.umd.js'
        });
        
        powerSyncInstance = new PowerSyncDatabaseWeb({
          schema: AppSchema,
          database: factory,
          connector,
          sync: {
            worker: '/@powersync/worker/SharedSyncImplementation.umd.js'
          }
        });
      } else {
        // Native platform - use PowerSyncDatabaseNative with SQL.js
        if (!PowerSyncDatabaseNative || !SQLJSOpenFactory) {
          throw new Error('PowerSync React Native SDK not available');
        }
        
        powerSyncInstance = new PowerSyncDatabaseNative({
          database: new SQLJSOpenFactory({
            dbFilename: 'field_asset_management.db',
          }),
          schema: AppSchema,
          connector,
        });
      }
      
      initializationPromise = powerSyncInstance.initialize()
        .catch((error) => {
          // Don't throw - allow app to continue even if PowerSync fails
        });
    } catch (error) {
      throw error;
    }
  }
  
  return powerSyncInstance;
};

// Don't export powerSync as a constant - let app/_layout.tsx handle initialization
// export const powerSync = getPowerSync();

/**
 * Helper function to manually trigger PowerSync connection
 * Useful if authentication happens after app initialization
 * This function ensures initialization is complete before attempting to connect
 */
export const connectPowerSync = async (): Promise<void> => {
  const instance = getPowerSync();
  if (!instance) {
    return;
  }

  const connector = new SupabaseConnector();
  
  if (!POWER_SYNC_URL) {
    throw new Error('PowerSync URL is not configured. Please set powersyncUrl in app.json');
  }
  
  try {
    if (initializationPromise) {
      await initializationPromise;
    }
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session || !session.access_token) {
      throw new Error('No valid Supabase session found');
    }
    
    await instance.connect(connector);
    
    // Initialize table name mappings
    try {
      const { initializeTableNames } = await import('./powersync-queries');
      await initializeTableNames();
    } catch (error) {
      // Silent fail - table names will be discovered on first query
    }

    // Initialize AttachmentQueue after PowerSync is connected
    try {
      const { initializeAttachmentQueue } = await import('./attachment-queue-init');
      await initializeAttachmentQueue();
    } catch (error) {
      // Don't throw - attachments are optional
    }
  } catch (error: any) {
    throw error;
  }
};

