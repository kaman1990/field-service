import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { SimplePicker } from '../../../../components/SimplePicker';
import { assetService } from '../../../../services/assets';
import { lookupService } from '../../../../services/lookups';
import { getTableName } from '../../../../lib/powersync-queries';
import type { Asset } from '../../../../types/database';

export default function EditAssetScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Partial<Asset>>({
    name: '',
    internal_id: '',
    enabled: true,
  });

  const assetsTable = getTableName('assets');
  const { data: assetResults = [] } = useQuery<Asset>(
    `SELECT * FROM ${assetsTable} WHERE id = ?`,
    [assetId]
  );
  const asset = assetResults?.[0] || null;
  const assetLoading = !asset && assetResults.length === 0;

  const siteIdForQueries = formData.site_id || asset?.site_id;

  const { data: sites = [] } = useReactQuery({
    queryKey: ['sites'],
    queryFn: () => lookupService.getSites(),
  });

  const { data: areas = [] } = useReactQuery({
    queryKey: ['areas', siteIdForQueries],
    queryFn: () => lookupService.getAreas(siteIdForQueries),
  });

  const { data: assetTypes = [] } = useReactQuery({
    queryKey: ['assetTypes'],
    queryFn: () => lookupService.getAssetTypes(),
  });



  const { data: gateways = [] } = useReactQuery({
    queryKey: ['gateways', siteIdForQueries],
    queryFn: () => lookupService.getGateways(siteIdForQueries),
  });

  useEffect(() => {
    if (asset) {
      const initialFormData: Partial<Asset> = {
        ...asset,
        description: asset.description ?? '',
      };
      setFormData(initialFormData);
    }
  }, [asset]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => assetService.updateAsset(assetId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update machine');
    },
  });

  const handleSave = () => {
    if (!formData.name) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }
    updateMutation.mutate(formData);
  };

  if (assetLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isLoading = updateMutation.isPending;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="Machine name"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Internal ID</Text>
        <Text style={styles.readOnlyValue}>{formData.internal_id || '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description || ''}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="Description"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Site</Text>
        <Text style={styles.readOnlyValue}>
          {formData.site_id ? sites.find(s => s.id === formData.site_id)?.name || '—' : '—'}
        </Text>
      </View>

      {formData.site_id && (
        <View style={styles.section}>
          <Text style={styles.label}>Area</Text>
          <SimplePicker
            value={formData.area_id || null}
            options={areas.map((area) => ({ label: area.name, value: area.id }))}
            onValueChange={(value) => setFormData({ ...formData, area_id: value || undefined })}
            placeholder="Select Area"
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Type</Text>
        <SimplePicker
          value={formData.type || null}
          options={assetTypes.map((type) => ({ label: type.type || 'Unknown', value: type.type || null }))}
          onValueChange={(value) => setFormData({ ...formData, type: value || undefined })}
          placeholder="Select Type"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Manufacturer</Text>
        <TextInput
          style={styles.input}
          value={formData.manufacturer}
          onChangeText={(text) => setFormData({ ...formData, manufacturer: text })}
          placeholder="Manufacturer"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Model</Text>
        <TextInput
          style={styles.input}
          value={formData.model}
          onChangeText={(text) => setFormData({ ...formData, model: text })}
          placeholder="Model"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Serial No</Text>
        <TextInput
          style={styles.input}
          value={formData.serial_no}
          onChangeText={(text) => setFormData({ ...formData, serial_no: text })}
          placeholder="Serial Number"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Gateway</Text>
        <SimplePicker
          value={formData.gateway_id || null}
          options={gateways.map((gateway) => ({ label: gateway.code || 'Unnamed', value: gateway.id }))}
          onValueChange={(value) => setFormData({ ...formData, gateway_id: value || undefined })}
          placeholder="Select Gateway"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Notes"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>VFD</Text>
          <Switch
            value={formData.vfd || false}
            onValueChange={(value) => setFormData({ ...formData, vfd: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Gearbox</Text>
          <Switch
            value={formData.gearbox || false}
            onValueChange={(value) => setFormData({ ...formData, gearbox: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>ATEX Area</Text>
          <Switch
            value={formData.atex_area || false}
            onValueChange={(value) => setFormData({ ...formData, atex_area: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Install Approved</Text>
          <Switch
            value={formData.install_approved || false}
            onValueChange={(value) => setFormData({ ...formData, install_approved: value })}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Update</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  readOnlyValue: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

