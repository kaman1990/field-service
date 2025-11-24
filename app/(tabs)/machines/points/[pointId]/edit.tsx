import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { SimplePicker } from '../../../../../components/SimplePicker';
import { OptionButtons } from '../../../../../components/OptionButtons';
import { OrientationVisualizer } from '../../../../../components/OrientationVisualizer';
import { pointService } from '../../../../../services/points';
import { lookupService } from '../../../../../services/lookups';
import { getTableName } from '../../../../../lib/powersync-queries';
import type { Point, Gateway } from '../../../../../types/database';

export default function EditPointScreen() {
  const { pointId, assetId } = useLocalSearchParams<{ pointId: string; assetId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Partial<Point>>({
    name: '',
    asset_id: assetId,
    enabled: true,
  });

  const pointsTable = getTableName('points');
  const { data: pointResults = [] } = useQuery<Point>(
    `SELECT * FROM ${pointsTable} WHERE id = ?`,
    [pointId]
  );
  const point = pointResults?.[0] || null;
  const pointLoading = !point && pointResults.length === 0;

  const { data: gateways = [] } = useReactQuery<Gateway[]>({
    queryKey: ['gateways'],
    queryFn: () => lookupService.getGateways(),
  });

  const { data: sites = [] } = useReactQuery({
    queryKey: ['sites'],
    queryFn: () => lookupService.getSites(),
  });

  useEffect(() => {
    if (point) {
      const initialFormData: Partial<Point> = {
        ...point,
        description: point.description ?? '',
      };
      setFormData(initialFormData);
    } else if (assetId && !formData.asset_id) {
      setFormData({ ...formData, asset_id: assetId });
    }
  }, [point, assetId]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Point>) => pointService.updatePoint(pointId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      queryClient.invalidateQueries({ queryKey: ['point', pointId] });
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update point');
    },
  });

  const handleSave = () => {
    if (!formData.asset_id) {
      Alert.alert('Validation Error', 'Asset ID is required');
      return;
    }

    updateMutation.mutate(formData);
  };

  if (pointLoading) {
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
        <Text style={styles.label}>Name</Text>
        <Text style={styles.readOnlyValue}>{formData.name || '—'}</Text>
      </View>

      {formData.internal_id && (
        <View style={styles.section}>
          <Text style={styles.label}>Internal ID</Text>
          <Text style={styles.readOnlyValue}>{formData.internal_id}</Text>
        </View>
      )}

      {formData.site_id && (
        <View style={styles.section}>
          <Text style={styles.label}>Site</Text>
          <Text style={styles.readOnlyValue}>
            {sites.find(s => s.id === formData.site_id)?.name || '—'}
          </Text>
        </View>
      )}

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

