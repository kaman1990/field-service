import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { retoolUserService } from '../../../services/retoolUser';
import { lookupService } from '../../../services/lookups';
import { SimplePicker } from '../../../components/SimplePicker';
import { syncService, type SyncStatus } from '../../../services/sync';
import { UploadStatus } from '../../../components/UploadStatus';
import type { Site, RetoolUser } from '../../../types/database';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : Platform.OS === 'android' ? 56 : 64;
  const bottomPadding = tabBarHeight + (Platform.OS !== 'web' ? insets.bottom : 0) + 16;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retoolUser, setRetoolUser] = useState<RetoolUser | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [authId, setAuthId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const hasLoadedSyncStatus = useRef(false);

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

      const [sitesData, userData, accessibleSiteIds] = await Promise.all([
        lookupService.getSites(),
        retoolUserService.getRetoolUserByAuthId(userId),
        retoolUserService.getAccessibleSiteIds(),
      ]);

      // Filter sites to only show those the user is assigned to (for non-admins)
      // Admins see all sites, regular users only see their assigned sites
      if (userData?.is_admin) {
        setSites(sitesData);
      } else {
        // Filter to only show sites the user is assigned to
        const assignedSiteIds = accessibleSiteIds || [];
        setSites(sitesData.filter(site => assignedSiteIds.includes(site.id)));
      }
      setRetoolUser(userData);
    } catch (error: any) {
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
      
      // Invalidate defaultSiteId cache to refresh data in other screens
      await queryClient.invalidateQueries({ queryKey: ['defaultSiteId'] });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update default site');
    } finally {
      setSaving(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      // Only update if status actually changed to prevent unnecessary re-renders
      setSyncStatus(prevStatus => {
        if (!prevStatus) {
          hasLoadedSyncStatus.current = true;
          return status;
        }
        // Compare all fields to see if anything changed
        if (
          prevStatus.pendingUploads !== status.pendingUploads ||
          prevStatus.pendingDownloads !== status.pendingDownloads ||
          prevStatus.pendingSync !== status.pendingSync ||
          prevStatus.synced !== status.synced ||
          prevStatus.powerSyncQueueCount !== status.powerSyncQueueCount ||
          prevStatus.powerSyncQueueSize !== status.powerSyncQueueSize
        ) {
          return status;
        }
        return prevStatus; // Return previous to prevent re-render
      });
      hasLoadedSyncStatus.current = true;
    } catch (error: any) {
      // Error loading sync status - silently fail, keep previous status
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
      Alert.alert('Error', error.message || 'Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const performSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error', 'Failed to sign out: ' + error.message);
        return;
      }
      // Navigation will be handled by auth state change listener in _layout.tsx
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      Alert.alert('Error', 'An unexpected error occurred during sign out');
    }
  };

  const handleSignOut = async () => {
    // On web, use browser's confirm dialog as Alert.alert may not work reliably
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        const confirmed = window.confirm('Are you sure you want to sign out?');
        if (confirmed) {
          await performSignOut();
        }
      } else {
        // Fallback: directly sign out if confirm is not available
        await performSignOut();
      }
      return;
    }
    
    // On native platforms, use Alert.alert
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await performSignOut();
          },
        },
      ],
      { cancelable: true }
    );
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
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
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

      {retoolUser?.is_admin && (
        <>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings/sites')}
          >
            <Text style={styles.menuItemText}>🏢 Sites Management</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings/user-sites')}
          >
            <Text style={styles.menuItemText}>👥 User Management</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sync Status</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Current status of pending uploads and downloads
        </Text>

        {/* Upload Status Component - Shows detailed list of pending uploads */}
        <UploadStatus refreshInterval={2000} />
        
        <View style={styles.syncStatusContainer}>
          {syncStatus ? (
            <>
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
            </>
          ) : (
            <Text style={styles.syncStatusLoading}>Loading sync status...</Text>
          )}
        </View>

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
        onPress={handleSignOut}
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
