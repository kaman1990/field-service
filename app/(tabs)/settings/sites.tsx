import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery as useReactQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { retoolUserService } from '../../../services/retoolUser';
import { sitesService } from '../../../services/sites';
import { userSitesService } from '../../../services/userSites';
import { lookupService } from '../../../services/lookups';
import { SimplePicker } from '../../../components/SimplePicker';
import { SearchBar } from '../../../components/SearchBar';
import { FilterPanel } from '../../../components/FilterPanel';
import type { Site, RetoolUser, UserSite, Company } from '../../../types/database';

export default function SitesManagementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : Platform.OS === 'android' ? 56 : 64;
  const fabBottom = 20 + tabBarHeight + (Platform.OS !== 'web' ? insets.bottom : 0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<RetoolUser | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [companyForm, setCompanyForm] = useState<{ name: string; enabled: boolean }>({
    name: '',
    enabled: true,
  });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>();

  // Form state for site
  const [siteForm, setSiteForm] = useState<Partial<Site>>({
    name: '',
    description: '',
    company_id: '',
    enabled: true,
  });

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

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch all sites
  const { data: sites = [], isLoading: sitesLoading } = useReactQuery<Site[]>({
    queryKey: ['allSitesAdmin'],
    queryFn: () => sitesService.getAllSites(),
    enabled: !!currentUser?.is_admin,
  });

  // Fetch companies from PowerSync for filter
  const { data: companiesData = [] } = useReactQuery({
    queryKey: ['companies'],
    queryFn: () => lookupService.getCompanies(),
    enabled: !!currentUser?.is_admin,
  });

  // Create company names map
  const companyNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    // First, populate from companiesData (from PowerSync)
    companiesData.forEach(company => {
      if (company.name && company.id) {
        map.set(company.id, company.name);
      }
    });
    // Then, for any site.company_id that's not in the map, add it as a fallback
    // This handles cases where company table might not be synced yet or company_id doesn't match
    sites.forEach(site => {
      if (site.company_id && !map.has(site.company_id)) {
        // Use company_id as the display name if no company record found
        map.set(site.company_id, site.company_id);
      }
    });
    return map;
  }, [companiesData, sites]);

  // Fetch all users
  const { data: users = [] } = useReactQuery<RetoolUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => userSitesService.getAllUsers(),
    enabled: !!currentUser?.is_admin,
  });

  // Fetch all user-site assignments
  const { data: allUserSites = [] } = useReactQuery<UserSite[]>({
    queryKey: ['allUserSites'],
    queryFn: () => userSitesService.getAllUserSites(),
    enabled: !!currentUser?.is_admin,
  });

  // Create site mutation
  const createSiteMutation = useMutation({
    mutationFn: (data: Partial<Site>) => sitesService.createSite(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSitesAdmin'] });
      setShowSiteModal(false);
      setSiteForm({ name: '', description: '', company_id: '', enabled: true });
      setEditingSite(null);
      Alert.alert('Success', 'Site created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create site');
    },
  });

  // Update site mutation
  const updateSiteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Site> }) => sitesService.updateSite(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSitesAdmin'] });
      setShowSiteModal(false);
      setSiteForm({ name: '', description: '', company_id: '', enabled: true });
      setEditingSite(null);
      Alert.alert('Success', 'Site updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update site');
    },
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: (data: { name: string; enabled: boolean }) => lookupService.createCompany(data),
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowCompanyModal(false);
      setCompanyForm({ name: '', enabled: true });
      // Automatically select the newly created company in the site form
      setSiteForm({ ...siteForm, company_id: newCompany.id });
      Alert.alert('Success', 'Company created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create company');
    },
  });

  // Filter and sort sites
  const filteredAndSortedSites = useMemo(() => {
    let filtered = [...sites];

    // Apply search filter
    if (debouncedSearchText.trim()) {
      const searchLower = debouncedSearchText.toLowerCase();
      filtered = filtered.filter(site => {
        const name = (site.name || '').toLowerCase();
        const companyName = site.company_id ? (companyNamesMap.get(site.company_id) || site.company_id).toLowerCase() : '';
        const description = (site.description || '').toLowerCase();
        return name.includes(searchLower) || 
               companyName.includes(searchLower) ||
               description.includes(searchLower);
      });
    }

    // Apply company filter
    if (selectedCompanyId) {
      filtered = filtered.filter(site => site.company_id === selectedCompanyId);
    }


    // Sort by company_id, then name
    return filtered.sort((a, b) => {
      const companyA = (a.company_id || '').toLowerCase();
      const companyB = (b.company_id || '').toLowerCase();
      if (companyA !== companyB) {
        return companyA.localeCompare(companyB);
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [sites, debouncedSearchText, selectedCompanyId, companyNamesMap]);

  // Count sites by company
  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sites.forEach(site => {
      if (site.company_id) {
        counts.set(site.company_id, (counts.get(site.company_id) || 0) + 1);
      }
    });
    return counts;
  }, [sites]);


  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  // Get users assigned to a site
  const getSiteUsers = (siteId: string): RetoolUser[] => {
    const assignments = allUserSites.filter(us => us.site_id === siteId && us.enabled && !us.deleted_at);
    return users.filter(u => assignments.some(a => a.user_id === u.id));
  };

  // Open site form for editing
  const openEditSite = (site: Site) => {
    setEditingSite(site);
    setSiteForm({
      name: site.name || '',
      description: site.description || '',
      company_id: site.company_id || '',
      enabled: site.enabled,
    });
    setShowSiteModal(true);
  };

  // Open site form for new site
  const openNewSite = () => {
    setEditingSite(null);
    setSiteForm({ name: '', description: '', location: '', company_id: '', enabled: true });
    setShowSiteModal(true);
  };

  // Handle save site
  const handleSaveSite = () => {
    if (!siteForm.name?.trim()) {
      Alert.alert('Validation Error', 'Site name is required');
      return;
    }

    if (editingSite) {
      updateSiteMutation.mutate({ id: editingSite.id, data: siteForm });
    } else {
      createSiteMutation.mutate(siteForm);
    }
  };

  // Toggle user assignment to site
  const toggleUserAssignment = async (userId: string, siteId: string) => {
    try {
      const assignments = allUserSites.filter(us => us.site_id === siteId && us.user_id === userId);
      const isAssigned = assignments.some(a => a.enabled && !a.deleted_at);

      if (isAssigned) {
        await userSitesService.removeUserFromSite(userId, siteId);
      } else {
        await userSitesService.assignUserToSite(userId, siteId);
      }

      await queryClient.invalidateQueries({ queryKey: ['allUserSites'] });
      await queryClient.invalidateQueries({ queryKey: ['accessibleSiteIds'] });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user assignment');
    }
  };

  if (loading || sitesLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar value={searchText} onChangeText={handleSearchChange} placeholder="Search sites..." />
      
      <View style={styles.filtersContainer}>
        <TouchableOpacity 
          style={styles.filtersHeader}
          onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.filtersHeaderText}>Filters</Text>
          <Text style={styles.chevron}>{isFiltersExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {isFiltersExpanded && (
          <View>
            <FilterPanel
              label="Company"
              options={companiesData.map(c => {
                const count = companyCounts.get(c.id) || 0;
                return { 
                  id: c.id, 
                  label: `${c.name || c.id} (${count})` 
                };
              })}
              selectedId={selectedCompanyId}
              onSelect={setSelectedCompanyId}
            />
          </View>
        )}
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={openNewSite}
        >
          <Text style={styles.actionButtonText}>+ New Site</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredAndSortedSites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: fabBottom + 20 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sites found</Text>
          </View>
        }
        renderItem={({ item: site }) => {
          const siteUsers = getSiteUsers(site.id);
          const isExpanded = selectedSiteId === site.id;
          return (
            <TouchableOpacity
              style={styles.siteCard}
              onPress={() => setSelectedSiteId(isExpanded ? null : site.id)}
              activeOpacity={0.7}
            >
                <View style={styles.siteHeader}>
                  <View style={styles.siteInfo}>
                    <Text style={styles.siteName}>{site.name || 'Unnamed Site'}</Text>
                    <View style={styles.siteMeta}>
                      {site.company_id && (
                        <Text style={styles.siteCompany}>
                          {companyNamesMap.get(site.company_id) || site.company_id}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.siteActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditSite(site);
                      }}
                      style={styles.editButton}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <Text style={styles.expandButtonText}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </View>
                </View>

                {isExpanded && (
                  <View style={styles.siteDetails}>
                    {site.description && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Description:</Text>
                        <Text style={styles.detailValue}>{site.description}</Text>
                      </View>
                    )}
                    
                    <View style={styles.usersSection}>
                      <Text style={styles.usersSectionTitle}>Assigned Users ({siteUsers.length})</Text>
                      <TouchableOpacity
                        style={styles.manageUsersButton}
                        onPress={() => {
                          setSelectedSiteId(site.id);
                          setShowUsersModal(true);
                        }}
                      >
                        <Text style={styles.manageUsersButtonText}>Manage Users</Text>
                      </TouchableOpacity>
                      {siteUsers.length > 0 && (
                        <View style={styles.usersList}>
                          {siteUsers.map((user) => (
                            <Text key={user.id} style={styles.userName}>
                              {user.name || user.email}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
      />

      {/* Site Form Modal */}
      <Modal
        visible={showSiteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSiteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSite ? 'Edit Site' : 'New Site'}
            </Text>

            <ScrollView>
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={siteForm.name}
                  onChangeText={(text) => setSiteForm({ ...siteForm, name: text })}
                  placeholder="Site name"
                />
              </View>

              <View style={styles.formSection}>
                <View style={styles.formLabelRow}>
                  <Text style={styles.formLabel}>Company</Text>
                  <TouchableOpacity
                    style={styles.addCompanyButtonSmall}
                    onPress={() => setShowCompanyModal(true)}
                  >
                    <Text style={styles.addCompanyButtonTextSmall}>+ New</Text>
                  </TouchableOpacity>
                </View>
                <SimplePicker
                  value={siteForm.company_id || null}
                  options={companiesData.map(c => ({ label: c.name || c.id, value: c.id }))}
                  onValueChange={(value) => setSiteForm({ ...siteForm, company_id: value || '' })}
                  placeholder="Select company"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={siteForm.description}
                  onChangeText={(text) => setSiteForm({ ...siteForm, description: text })}
                  placeholder="Description"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.formSection}>
                <View style={styles.switchRow}>
                  <Text style={styles.formLabel}>Enabled</Text>
                  <Switch
                    value={siteForm.enabled}
                    onValueChange={(value) => setSiteForm({ ...siteForm, enabled: value })}
                    trackColor={{ false: '#ddd', true: '#007AFF' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowSiteModal(false);
                  setEditingSite(null);
                  setSiteForm({ name: '', description: '', company_id: '', enabled: true });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveSite}
                disabled={createSiteMutation.isPending || updateSiteMutation.isPending}
              >
                {createSiteMutation.isPending || updateSiteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Users Assignment Modal */}
      <Modal
        visible={showUsersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUsersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Assign Users to {sites.find(s => s.id === selectedSiteId)?.name || 'Site'}
            </Text>

            <ScrollView style={styles.usersModalScroll}>
              {users
                .filter(u => !u.is_admin)
                .map((user) => {
                  const assignments = allUserSites.filter(
                    us => us.site_id === selectedSiteId && us.user_id === user.id
                  );
                  const isAssigned = assignments.some(a => a.enabled && !a.deleted_at);
                  
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.userRow}
                      onPress={() => toggleUserAssignment(user.id, selectedSiteId!)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.userInfo}>
                        <Text style={styles.userNameText}>{user.name || user.email}</Text>
                        <Text style={styles.userEmailText}>{user.email}</Text>
                      </View>
                      <View onStartShouldSetResponder={() => true}>
                        <Switch
                          value={isAssigned}
                          onValueChange={() => toggleUserAssignment(user.id, selectedSiteId!)}
                          trackColor={{ false: '#e0e0e0', true: '#4caf50' }}
                          thumbColor="#fff"
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setShowUsersModal(false)}
              >
                <Text style={styles.saveButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Company Creation Modal */}
      <Modal
        visible={showCompanyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Company</Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Company Name *</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.name}
                onChangeText={(text) => setCompanyForm({ ...companyForm, name: text })}
                placeholder="Company name"
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCompanyModal(false);
                  setCompanyForm({ name: '', enabled: true });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  if (!companyForm.name?.trim()) {
                    Alert.alert('Validation Error', 'Company name is required');
                    return;
                  }
                  createCompanyMutation.mutate(companyForm);
                }}
                disabled={createCompanyMutation.isPending}
              >
                {createCompanyMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Company Creation Modal */}
      <Modal
        visible={showCompanyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Company</Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Company Name *</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.name}
                onChangeText={(text) => setCompanyForm({ ...companyForm, name: text })}
                placeholder="Company name"
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCompanyModal(false);
                  setCompanyForm({ name: '', enabled: true });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  if (!companyForm.name?.trim()) {
                    Alert.alert('Validation Error', 'Company name is required');
                    return;
                  }
                  createCompanyMutation.mutate(companyForm);
                }}
                disabled={createCompanyMutation.isPending}
              >
                {createCompanyMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
  },
  filtersHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chevron: {
    fontSize: 14,
    color: '#666',
  },
  actionsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
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
  siteCard: {
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
  siteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
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
  siteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  expandButtonText: {
    fontSize: 16,
    color: '#666',
  },
  siteDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#333',
  },
  usersSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  usersSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  manageUsersButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 4,
    marginBottom: 8,
  },
  manageUsersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  usersList: {
    marginTop: 8,
  },
  userName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
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
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  usersModalScroll: {
    maxHeight: 400,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flex: 1,
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  userEmailText: {
    fontSize: 13,
    color: '#666',
  },
  formLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addCompanyButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  addCompanyButtonTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

