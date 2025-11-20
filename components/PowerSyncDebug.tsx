import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useStatus } from '@powersync/react';
import { getPowerSync } from '../lib/powersync';

interface TableInfo {
  name: string;
  rowCount: number;
  sampleData?: any[];
}

/**
 * Debug component to show PowerSync database status and table information
 */
export const PowerSyncDebug: React.FC = () => {
  const status = useStatus();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const checkDatabase = async () => {
    setLoading(true);
    try {
      const powerSync = getPowerSync();
      
      // Get list of tables using getAll - check all tables including those with schema prefixes
      const tableNames = await powerSync.getAll<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      
      
      const tableInfos: TableInfo[] = [];
      
      for (const row of tableNames) {
        const tableName = row.name;
        try {
          // Get row count
          const countResult = await powerSync.getAll<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
          const rowCount = countResult[0]?.count || 0;
          
          // Get sample data (first 3 rows)
          let sampleData: any[] = [];
          if (rowCount > 0) {
            const sampleResult = await powerSync.getAll(`SELECT * FROM ${tableName} LIMIT 3`);
            sampleData = sampleResult || [];
          }
          
          tableInfos.push({
            name: tableName,
            rowCount,
            sampleData
          });
          
        } catch (error: any) {
          console.error(`[PowerSyncDebug] Error checking table ${tableName}:`, error);
          tableInfos.push({
            name: tableName,
            rowCount: -1, // Error indicator
          });
        }
      }
      
      setTables(tableInfos);
    } catch (error: any) {
      console.error('[PowerSyncDebug] Error checking database:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDatabase();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Database Debug</Text>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <Text style={styles.statusText}>
            Connected: {status.connected ? '✅ Yes' : '❌ No'}
          </Text>
          <Text style={styles.statusText}>
            Uploading: {status.uploading ? '🟡 Yes' : '⚪ No'}
          </Text>
          <Text style={styles.statusText}>
            Downloading: {status.downloading ? '🟡 Yes' : '⚪ No'}
          </Text>
          {status.lastSyncedAt && (
            <Text style={styles.statusText}>
              Last Sync: {new Date(status.lastSyncedAt).toLocaleString()}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Database Tables</Text>
            <TouchableOpacity onPress={checkDatabase} disabled={loading}>
              <Text style={styles.refreshButton}>{loading ? '⏳' : '🔄'}</Text>
            </TouchableOpacity>
          </View>
          
          {tables.length === 0 ? (
            <Text style={styles.emptyText}>No tables found or not checked yet</Text>
          ) : (
            tables.map((table) => (
              <View key={table.name} style={styles.tableInfo}>
                <Text style={styles.tableName}>{table.name}</Text>
                <Text style={styles.tableCount}>
                  Rows: {table.rowCount === -1 ? 'Error' : table.rowCount}
                </Text>
                {table.sampleData && table.sampleData.length > 0 && (
                  <View style={styles.sampleContainer}>
                    <Text style={styles.sampleTitle}>Sample (first row):</Text>
                    <Text style={styles.sampleData} numberOfLines={3}>
                      {JSON.stringify(table.sampleData[0], null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <Text style={styles.troubleshootText}>
            • If tables are empty, check PowerSync dashboard sync rules{'\n'}
            • Ensure tables are included in your sync configuration{'\n'}
            • Check that data exists in Supabase{'\n'}
            • Verify connection status above
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  refreshButton: {
    fontSize: 18,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tableInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  tableName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tableCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  sampleContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  sampleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sampleData: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  troubleshootText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});

