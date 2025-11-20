import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { retoolUserService } from '../../../services/retoolUser';
import { lookupService } from '../../../services/lookups';
import { SimplePicker } from '../../../components/SimplePicker';
import { syncService, type SyncStatus } from '../../../services/sync';
import { UploadStatus } from '../../../components/UploadStatus';
import type { Site, RetoolUser } from '../../../types/database';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retoolUser, setRetoolUser] = useState<RetoolUser | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [authId, setAuthId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshingSync, setRefreshingSync] = useState(false);

  useEffect(() => {
    loadData();
    loadSyncStatus();
    
    const interval = setInterval(() => {
      loadSyncStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }
      
      const userId = session.user.id;
      setAuthId(userId);

      const [sitesData, userData] = await Promise.all([
        lookupService.getSites(),
        retoolUserService.getRetoolUserByAuthId(userId),
      ]);

      setSites(sitesData);
      setRetoolUser(userData);
    } catch (error: any) {
      console.error('[Settings] Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDefaultSiteChange = async (siteId: string | null) => {
    if (!authId) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    try {
      setSaving(true);
      const updated = await retoolUserService.updateDefaultSiteId(authId, siteId);
      setRetoolUser(updated);
    } catch (error: any) {
      console.error('[Settings] Error updating default site:', error);
      Alert.alert('Error', error.message || 'Failed to update default site');
    } finally {
      setSaving(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      setRefreshingSync(true);
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error: any) {
      console.error('[Settings] Error loading sync status:', error);
    } finally {
      setRefreshingSync(false);
    }
  };

  const handleForceSync = async () => {
    try {
      setSyncing(true);
      await syncService.forceSync();
      Alert.alert('Success', 'Sync triggered. Pending items will be synced shortly.');
      setTimeout(() => {
        loadSyncStatus();
      }, 1000);
    } catch (error: any) {
      console.error('[Settings] Error forcing sync:', error);
      Alert.alert('Error', error.message || 'Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const performSignOut = async () => {
    console.log('[Settings] User confirmed sign out - performing sign out...');
    try {
      console.log('[Settings] Starting sign out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Settings] Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out: ' + error.message);
        return;
      }
      console.log('[Settings] ✅ Sign out successful, waiting for navigation...');
      // Navigation will be handled by auth state change listener in _layout.tsx
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error('[Settings] Unexpected sign out error:', error);
      Alert.alert('Error', 'An unexpected error occurred during sign out');
    }
  };

  const handleSignOut = async () => {
    console.log('[Settings] handleSignOut called - button was clicked!');
    console.log('[Settings] Platform:', Platform.OS);
    
    // On web, use browser's confirm dialog as Alert.alert may not work reliably
    if (Platform.OS === 'web') {
      console.log('[Settings] Using browser confirm dialog (web platform)');
      if (typeof window !== 'undefined' && window.confirm) {
        const confirmed = window.confirm('Are you sure you want to sign out?');
        if (confirmed) {
          console.log('[Settings] User confirmed via browser confirm');
          await performSignOut();
        } else {
          console.log('[Settings] Sign out cancelled by user (browser confirm)');
        }
      } else {
        // Fallback: directly sign out if confirm is not available
        console.log('[Settings] window.confirm not available, signing out directly');
        await performSignOut();
      }
      return;
    }
    
    // On native platforms, use Alert.alert
    console.log('[Settings] Showing Alert dialog (native platform)...');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel', 
          onPress: () => {
            console.log('[Settings] Sign out cancelled by user');
          }
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('[Settings] User confirmed sign out - alert button pressed!');
            await performSignOut();
          },
        },
      ],
      { cancelable: true, onDismiss: () => console.log('[Settings] Alert dismissed without action') }
    );
    console.log('[Settings] Alert.alert called (this should appear immediately after)');
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const siteOptions = sites.map(site => ({
    label: site.name || site.id,
    value: site.id,
  }));

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={true}
    >
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Site</Text>
        <Text style={styles.sectionDescription}>
          Select your default site for new records
        </Text>
        {saving ? (
          <View style={styles.pickerContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        ) : (
          <SimplePicker
            value={retoolUser?.default_site_id || null}
            options={siteOptions}
            onValueChange={handleDefaultSiteChange}
            placeholder="Select default site..."
          />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sync Status</Text>
          {refreshingSync && (
            <ActivityIndicator size="small" color="#007AFF" style={styles.refreshIndicator} />
          )}
        </View>
        <Text style={styles.sectionDescription}>
          Current status of pending uploads and downloads
        </Text>

        {/* Upload Status Component - Shows detailed list of pending uploads */}
        <UploadStatus refreshInterval={2000} />
        
        {syncStatus ? (
          <View style={styles.syncStatusContainer}>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncStatusLabel}>Pending Uploads:</Text>
              <Text style={[styles.syncStatusValue, syncStatus.pendingUploads > 0 && styles.syncStatusPending]}>
                {syncStatus.pendingUploads}
              </Text>
            </View>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncStatusLabel}>Pending Downloads:</Text>
              <Text style={[styles.syncStatusValue, syncStatus.pendingDownloads > 0 && styles.syncStatusPending]}>
                {syncStatus.pendingDownloads}
              </Text>
            </View>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncStatusLabel}>Queued for Sync:</Text>
              <Text style={[styles.syncStatusValue, syncStatus.pendingSync > 0 && styles.syncStatusPending]}>
                {syncStatus.pendingSync}
              </Text>
            </View>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncStatusLabel}>Synced:</Text>
              <Text style={styles.syncStatusValue}>{syncStatus.synced}</Text>
            </View>
            {syncStatus.powerSyncQueueCount > 0 && (
              <View style={styles.syncStatusRow}>
                <Text style={styles.syncStatusLabel}>PowerSync Queue:</Text>
                <Text style={[styles.syncStatusValue, styles.syncStatusPending]}>
                  {syncStatus.powerSyncQueueCount} items
                  {syncStatus.powerSyncQueueSize && ` (${formatBytes(syncStatus.powerSyncQueueSize)})`}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.syncStatusLoading}>Loading sync status...</Text>
        )}

        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={handleForceSync}
          disabled={syncing}
        >
          {syncing ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={styles.syncButtonSpinner} />
              <Text style={styles.syncButtonText}>Syncing...</Text>
            </>
          ) : (
            <Text style={styles.syncButtonText}>🔄 Force Sync Now</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/settings/debug')}
      >
        <Text style={styles.menuItemText}>🔍 Database Debug</Text>
        <Text style={styles.menuItemArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() => {
          console.log('[Settings] Sign out button pressed!');
          handleSignOut();
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemArrow: {
    fontSize: 20,
    color: '#999',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  signOutButton: {
    backgroundColor: '#ff3b30',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  refreshIndicator: {
    marginLeft: 8,
  },
  syncStatusContainer: {
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  syncStatusLabel: {
    fontSize: 14,
    color: '#666',
  },
  syncStatusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  syncStatusPending: {
    color: '#ff9500',
  },
  syncStatusLoading: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonSpinner: {
    marginRight: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
