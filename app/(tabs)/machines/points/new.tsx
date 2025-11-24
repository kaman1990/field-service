import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SimplePicker } from '../../../../components/SimplePicker';
import { OptionButtons } from '../../../../components/OptionButtons';
import { OrientationVisualizer } from '../../../../components/OrientationVisualizer';
import { pointService } from '../../../../services/points';
import { lookupService } from '../../../../services/lookups';
import type { Point, Gateway, PointIotStatus } from '../../../../types/database';

export default function NewPointScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Point>>({
    name: '',
    asset_id: assetId,
    enabled: true,
  });

  const { data: gateways = [] } = useReactQuery<Gateway[]>({
    queryKey: ['gateways'],
    queryFn: () => lookupService.getGateways(),
  });

  const { data: iotStatuses = [] } = useReactQuery<PointIotStatus[]>({
    queryKey: ['pointIotStatuses'],
    queryFn: () => lookupService.getPointIotStatuses(),
  });

  useEffect(() => {
    if (assetId && !formData.asset_id) {
      setFormData({ ...formData, asset_id: assetId });
    }
  }, [assetId]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Point>) => pointService.createPoint(data as any),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      queryClient.invalidateQueries({ queryKey: ['assetPoints'] });
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create point');
    },
  });

  const handleSave = () => {
    if (!formData.name) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }

    if (!formData.asset_id) {
      Alert.alert('Validation Error', 'Asset ID is required');
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
          placeholder="Point name"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="Description"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Serial No</Text>
        <TextInput
          style={styles.input}
          value={formData.serial_no?.toString()}
          onChangeText={(text) => setFormData({ ...formData, serial_no: text ? parseInt(text) : undefined })}
          placeholder="Serial Number"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Full Serial No</Text>
        <TextInput
          style={styles.input}
          value={formData.full_serial_no}
          onChangeText={(text) => setFormData({ ...formData, full_serial_no: text })}
          placeholder="Full Serial Number"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Position</Text>
        <OptionButtons
          value={formData.position || null}
          options={[
            { label: 'Non-Drive End', value: 'Non-Drive End' },
            { label: 'Drive End', value: 'Drive End' },
          ]}
          onValueChange={(value) => setFormData({ ...formData, position: value || undefined })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Asset Part</Text>
        <OptionButtons
          value={formData.asset_part || null}
          options={[
            { label: 'Motor', value: 'Motor' },
            { label: 'Gearbox', value: 'Gearbox' },
            { label: 'Equipment', value: 'Equipment' },
          ]}
          onValueChange={(value) => setFormData({ ...formData, asset_part: value || undefined })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Bearing</Text>
        <TextInput
          style={styles.input}
          value={formData.bearing}
          onChangeText={(text) => setFormData({ ...formData, bearing: text })}
          placeholder="Bearing"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Sensor Orientation</Text>
        {formData.sensor_orientation && (
          <OrientationVisualizer orientation={formData.sensor_orientation} />
        )}
        <OptionButtons
          value={formData.sensor_orientation || null}
          options={[
            { label: 'AVH', value: 'AVH' },
            { label: 'AHV', value: 'AHV' },
            { label: 'VAH', value: 'VAH' },
            { label: 'VHA', value: 'VHA' },
            { label: 'HAV', value: 'HAV' },
            { label: 'HVA', value: 'HVA' },
          ]}
          onValueChange={(value) => setFormData({ ...formData, sensor_orientation: value || undefined })}
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
        <Text style={styles.label}>Preferred Gateway</Text>
        <SimplePicker
          value={formData.pref_gateway_id || null}
          options={gateways.map((gateway) => ({ label: gateway.code || 'Unnamed', value: gateway.id }))}
          onValueChange={(value) => setFormData({ ...formData, pref_gateway_id: value || undefined })}
          placeholder="Select Preferred Gateway"
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

