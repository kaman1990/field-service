import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Switch,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery as useReactQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { getPowerSync, getInitializedPowerSync } from '../../../lib/powersync';
import { retoolUserService } from '../../../services/retoolUser';
import { lookupService } from '../../../services/lookups';
import { userSitesService } from '../../../services/userSites';
import { sanitizeEmail, sanitizeTextInput } from '../../../lib/sanitize';
import type { RetoolUser, Site, UserSite } from '../../../types/database';

export default function UserSitesManagementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : Platform.OS === 'android' ? 56 : 64;
  const bottomPadding = tabBarHeight + (Platform.OS !== 'web' ? insets.bottom : 0) + 16;
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<RetoolUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<RetoolUser | null>(null);
  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    name: '',
    is_admin: false,
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    is_admin: false,
    enabled: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          Alert.alert('Error', 'Not authenticated');
          router.back();
          return;
        }

        const user = await retoolUserService.getRetoolUserByAuthId(session.user.id);
        if (!user?.is_admin) {
          Alert.alert('Access Denied', 'Only administrators can access this page.');
          router.back();
          return;
        }

        setCurrentUser(user);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to verify admin access');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  // Watch for changes to user_sites table and invalidate React Query cache
  useEffect(() => {
    try {
      const powerSync = getPowerSync();
      if (!powerSync) return;

      // Watch for changes to user_sites table
      const dispose = powerSync.onChange({
        onChange: async (event: { changedTables?: string[] }) => {
          const changedTables = event.changedTables || [];
          
          // If user_sites table changed, invalidate the React Query cache
          const hasUserSitesChange = changedTables.some((table: string) => 
            table === 'user_sites' || 
            table.includes('user_sites') ||
            table.endsWith('_user_sites') ||
            table.endsWith('.user_sites')
          );
          
          if (hasUserSitesChange) {
            queryClient.invalidateQueries({ queryKey: ['allUserSites'] });
            queryClient.invalidateQueries({ queryKey: ['accessibleSiteIds'] });
          }
        },
        onError: (error: any) => {
          // Error watching PowerSync changes
        }
      }, {
        tables: ['user_sites'],
        triggerImmediate: false
      });

      return () => {
        dispose();
      };
    } catch (error: any) {
      // Error setting up PowerSync watcher
    }
  }, [queryClient]);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useReactQuery<RetoolUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => userSitesService.getAllUsers(),
    enabled: !!currentUser?.is_admin,
  });

  // Fetch all sites (without filtering - admin needs to see all)
  const { data: sites = [] } = useReactQuery<Site[]>({
    queryKey: ['allSitesAdmin'],
    queryFn: () => lookupService.getAllSites(),
    enabled: !!currentUser?.is_admin,
  });

  // Fetch companies from PowerSync to map company_id to company name
  const { data: companiesData = [] } = useReactQuery({
    queryKey: ['companies'],
    queryFn: () => lookupService.getCompanies(),
    enabled: !!currentUser?.is_admin,
  });

  // Create a map of company_id -> company name
  const companyNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    companiesData.forEach(company => {
      if (company.name) {
        map.set(company.id, company.name);
      }
    });
    // If no companies from PowerSync, use company_id as the name (fallback)
    if (companiesData.length === 0) {
      sites.forEach(site => {
        if (site.company_id && !map.has(site.company_id)) {
          map.set(site.company_id, site.company_id);
        }
      });
    }
    return map;
  }, [companiesData, sites]);

  // Fetch all user-site assignments
  const { data: allUserSites = [], isLoading: userSitesLoading } = useReactQuery<UserSite[]>({
    queryKey: ['allUserSites'],
    queryFn: () => userSitesService.getAllUserSites(),
    enabled: !!currentUser?.is_admin,
  });

  // Create a map of user_id -> site_id[] for quick lookup
  const userSitesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allUserSites.forEach((us) => {
      if (us.enabled && !us.deleted_at) {
        if (!map.has(us.user_id)) {
          map.set(us.user_id, new Set());
        }
        map.get(us.user_id)!.add(us.site_id);
      }
    });
    return map;
  }, [allUserSites]);

  // Check if a user is assigned to a site
  const isUserAssignedToSite = (userId: string, siteId: string): boolean => {
    return userSitesMap.get(userId)?.has(siteId) ?? false;
  };

  // Get count of sites assigned to a user
  const getUserSiteCount = (userId: string): number => {
    return userSitesMap.get(userId)?.size ?? 0;
  };

  // Toggle user-site assignment
  const toggleUserSiteAssignment = async (userId: string, siteId: string) => {
    try {
      const isAssigned = isUserAssignedToSite(userId, siteId);
      
      if (isAssigned) {
        await userSitesService.removeUserFromSite(userId, siteId);
      } else {
        await userSitesService.assignUserToSite(userId, siteId);
      }

      // The PowerSync onChange watcher will automatically invalidate and refetch
      // But we can also manually invalidate to ensure immediate update
      await queryClient.invalidateQueries({ queryKey: ['allUserSites'] });
      await queryClient.refetchQueries({ queryKey: ['allUserSites'] });
      await queryClient.invalidateQueries({ queryKey: ['accessibleSiteIds'] });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user-site assignment');
    }
  };

  // Get sites for a specific user
  const getUserSites = (userId: string): string[] => {
    return Array.from(userSitesMap.get(userId) || []);
  };

  // Handle create user
  const handleCreateUser = async () => {
    if (isSubmitting) return;

    const sanitizedEmail = sanitizeEmail(createFormData.email);
    const sanitizedPassword = sanitizeTextInput(createFormData.password);
    const sanitizedName = sanitizeTextInput(createFormData.name);

    if (!sanitizedEmail) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!sanitizedPassword || sanitizedPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create user in Supabase Auth using signUp
      // NOTE: This will send a confirmation email unless email confirmation is disabled in Supabase
      // For admin-created users with auto-confirmation, set up a Supabase Edge Function with service role key
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: sanitizedPassword,
      });

      if (authError) {
        // Check if user already exists
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          // User exists - try to find existing retool_users record
          const powerSync = await getInitializedPowerSync();
          const existingUser = await powerSync.get<RetoolUser>(
            'SELECT * FROM retool_users WHERE email = ?',
            [sanitizedEmail]
          );

          if (existingUser) {
            // Update existing user
            await retoolUserService.updateRetoolUser(existingUser.id, {
              name: sanitizedName,
              email: sanitizedEmail,
              is_admin: createFormData.is_admin,
              enabled: true,
            });
            
            setCreateFormData({ email: '', password: '', name: '', is_admin: false });
            setShowCreateModal(false);
            await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            await queryClient.refetchQueries({ queryKey: ['allUsers'] });
            Alert.alert('Success', 'User record updated. Note: The user already exists in Supabase Auth.');
            setIsSubmitting(false);
            return;
          } else {
            throw new Error('User already exists in Supabase Auth but no retool_users record found. Please contact support.');
          }
        }
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user in Supabase');
      }

      // Create retool_users record
      await retoolUserService.createRetoolUser({
        auth_id: authData.user.id,
        email: sanitizedEmail,
        name: sanitizedName || undefined,
        is_admin: createFormData.is_admin,
        enabled: true,
      });

      // Reset form and close modal
      setCreateFormData({
        email: '',
        password: '',
        name: '',
        is_admin: false,
      });
      setShowCreateModal(false);

      // Refresh users list
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.refetchQueries({ queryKey: ['allUsers'] });

      Alert.alert('Success', 'User created successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (isSubmitting || !editingUser) return;

    const sanitizedEmail = editFormData.email ? sanitizeEmail(editFormData.email) : undefined;
    const sanitizedName = editFormData.name ? sanitizeTextInput(editFormData.name) : undefined;

    if (sanitizedEmail === '') {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await retoolUserService.updateRetoolUser(editingUser.id, {
        name: sanitizedName,
        email: sanitizedEmail,
        is_admin: editFormData.is_admin,
        enabled: editFormData.enabled,
      });

      // Reset form and close modal
      setEditingUser(null);
      setShowEditModal(false);
      setEditFormData({
        name: '',
        email: '',
        is_admin: false,
        enabled: true,
      });

      // Refresh users list
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.refetchQueries({ queryKey: ['allUsers'] });

      Alert.alert('Success', 'User updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal
  const openEditModal = (user: RetoolUser) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      is_admin: user.is_admin || false,
      enabled: user.enabled !== false,
    });
    setShowEditModal(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditingUser(null);
    setShowEditModal(false);
    setEditFormData({
      name: '',
      email: '',
      is_admin: false,
      enabled: true,
    });
  };

  // Sort users alphabetically by name, then email
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = (a.name || a.email || '').toLowerCase();
      const nameB = (b.name || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  // Sort sites by company name (via company_id), then name
  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => {
      const companyNameA = (companyNamesMap.get(a.company_id || '') || a.company_id || '').toLowerCase();
      const companyNameB = (companyNamesMap.get(b.company_id || '') || b.company_id || '').toLowerCase();
      if (companyNameA !== companyNameB) {
        return companyNameA.localeCompare(companyNameB);
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [sites, companyNamesMap]);

  if (loading || usersLoading || userSitesLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>User Management</Text>
          <Text style={styles.infoText}>
            Create and manage users, assign sites, and configure permissions.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.createButtonText}>+ Create New User</Text>
          </TouchableOpacity>
        </View>

        {sortedUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          sortedUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userHeaderContainer}>
                <TouchableOpacity
                  style={styles.userHeader}
                  onPress={() => setSelectedUserId(selectedUserId === user.id ? null : user.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name || user.email || 'Unknown User'}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <View style={styles.userMeta}>
                      {user.is_admin ? (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      ) : (
                        <Text style={styles.siteCountText}>
                          {getUserSiteCount(user.id)} {getUserSiteCount(user.id) === 1 ? 'site' : 'sites'}
                        </Text>
                      )}
                      {user.enabled === false && (
                        <View style={styles.disabledBadge}>
                          <Text style={styles.disabledBadgeText}>Disabled</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.expandButton}>
                    <Text style={styles.expandButtonText}>
                      {selectedUserId === user.id ? '▼' : '▶'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(user)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {selectedUserId === user.id && (
                <View style={styles.sitesContainer}>
                  {user.is_admin ? (
                    <Text style={styles.adminNote}>
                      Admins have access to all sites automatically.
                    </Text>
                  ) : sortedSites.length === 0 ? (
                    <Text style={styles.noSitesText}>No sites available</Text>
                  ) : (
                    sortedSites.map((site) => {
                      const isAssigned = isUserAssignedToSite(user.id, site.id);
                      return (
                        <TouchableOpacity
                          key={site.id}
                          style={styles.siteRow}
                          onPress={() => toggleUserSiteAssignment(user.id, site.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.siteInfo}>
                            <Text style={styles.siteName}>{site.name || 'Unnamed Site'}</Text>
                            <View style={styles.siteMeta}>
                              {site.company_id && companyNamesMap.has(site.company_id) && (
                                <Text style={styles.siteCompany}>{companyNamesMap.get(site.company_id)}</Text>
                              )}
                              {site.location && (
                                <Text style={styles.siteLocation}>{site.location}</Text>
                              )}
                            </View>
                          </View>
                          <View onStartShouldSetResponder={() => true}>
                          <Switch
                            value={isAssigned}
                            onValueChange={() => toggleUserSiteAssignment(user.id, site.id)}
                            trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
                            thumbColor="#fff"
                          />
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create User Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New User</Text>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={createFormData.email}
                  onChangeText={(text) => setCreateFormData({ ...createFormData, email: text })}
                  placeholder="user@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  value={createFormData.password}
                  onChangeText={(text) => setCreateFormData({ ...createFormData, password: text })}
                  placeholder="Minimum 6 characters"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={createFormData.name}
                  onChangeText={(text) => setCreateFormData({ ...createFormData, name: text })}
                  placeholder="Full name"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Admin User</Text>
                  <Switch
                    value={createFormData.is_admin}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, is_admin: value })}
                    trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
                    thumbColor="#fff"
                  />
                </View>
                <Text style={styles.helperText}>
                  Admins have access to all sites automatically
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateFormData({ email: '', password: '', name: '', is_admin: false });
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCreateUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit User</Text>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={editFormData.name}
                  onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                  placeholder="Full name"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={editFormData.email}
                  onChangeText={(text) => setEditFormData({ ...editFormData, email: text })}
                  placeholder="user@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Admin User</Text>
                  <Switch
                    value={editFormData.is_admin}
                    onValueChange={(value) => setEditFormData({ ...editFormData, is_admin: value })}
                    trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
                    thumbColor="#fff"
                  />
                </View>
                <Text style={styles.helperText}>
                  Admins have access to all sites automatically
                </Text>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Enabled</Text>
                  <Switch
                    value={editFormData.enabled}
                    onValueChange={(value) => setEditFormData({ ...editFormData, enabled: value })}
                    trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
                    thumbColor="#fff"
                  />
                </View>
                <Text style={styles.helperText}>
                  Disabled users cannot access the system
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeEditModal}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleEditUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  userCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  userMeta: {
    marginTop: 8,
  },
  adminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  siteCountText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  disabledBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#9E9E9E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  disabledBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalScroll: {
    maxHeight: 400,
  },
  formGroup: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  expandButton: {
    padding: 8,
  },
  expandButtonText: {
    fontSize: 16,
    color: '#666',
  },
  sitesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
  },
  adminNote: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  noSitesText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 8,
  },
  siteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  siteInfo: {
    flex: 1,
    marginRight: 16,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  siteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  siteCompany: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  siteLocation: {
    fontSize: 13,
    color: '#666',
  },
});

