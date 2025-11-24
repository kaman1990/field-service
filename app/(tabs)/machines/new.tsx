import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery as useReactQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SimplePicker } from '../../../components/SimplePicker';
import { assetService } from '../../../services/assets';
import { lookupService } from '../../../services/lookups';
import type { Asset } from '../../../types/database';

export default function NewAssetScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Asset>>({
    name: '',
    internal_id: '',
    enabled: true,
  });

  const { data: sites = [] } = useReactQuery({
    queryKey: ['sites'],
    queryFn: () => lookupService.getSites(),
  });

  const { data: areas = [] } = useReactQuery({
    queryKey: ['areas', formData.site_id],
    queryFn: () => lookupService.getAreas(formData.site_id),
  });

  const { data: assetTypes = [] } = useReactQuery({
    queryKey: ['assetTypes'],
    queryFn: () => lookupService.getAssetTypes(),
  });

  const { data: healthStatuses = [] } = useReactQuery({
    queryKey: ['assetHealthStatuses'],
    queryFn: () => lookupService.getAssetHealthStatuses(),
  });

  const { data: iotStatuses = [] } = useReactQuery({
    queryKey: ['assetIotStatuses'],
    queryFn: () => lookupService.getAssetIotStatuses(),
  });

  const { data: gateways = [] } = useReactQuery({
    queryKey: ['gateways', formData.site_id],
    queryFn: () => lookupService.getGateways(formData.site_id),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => assetService.createAsset(data as any),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      router.replace(`/machines/${data.id}`);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create machine');
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.internal_id) {
      Alert.alert('Validation Error', 'Name and Internal ID are required');
      return;
    }
    createMutation.mutate(formData);
  };

  const isLoading = createMutation.isPending;

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
        <Text style={styles.label}>Internal ID *</Text>
        <TextInput
          style={styles.input}
          value={formData.internal_id}
          onChangeText={(text) => setFormData({ ...formData, internal_id: text })}
          placeholder="Internal ID"
          placeholderTextColor="#999"
        />
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
        <SimplePicker
          value={formData.site_id || null}
          options={sites.map((site) => ({ label: site.name || 'Unnamed', value: site.id }))}
          onValueChange={(value) => setFormData({ ...formData, site_id: value || undefined })}
          placeholder="Select Site"
        />
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
        <Text style={styles.label}>Health Status</Text>
        <SimplePicker
          value={formData.health_status_id || null}
          options={healthStatuses.map((status) => ({ label: status.status || 'Unknown', value: status.id }))}
          onValueChange={(value) => setFormData({ ...formData, health_status_id: value || undefined })}
          placeholder="Select Health Status"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>IoT Status</Text>
        <SimplePicker
          value={formData.iot_status_id || null}
          options={iotStatuses.map((status) => ({ label: status.status || 'Unknown', value: status.id }))}
          onValueChange={(value) => setFormData({ ...formData, iot_status_id: value || undefined })}
          placeholder="Select IoT Status"
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
          <Text style={styles.saveButtonText}>Create</Text>
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
