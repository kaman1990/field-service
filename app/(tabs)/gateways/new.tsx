import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery as useReactQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SimplePicker } from '../../../components/SimplePicker';
import { gatewayService } from '../../../services/gateways';
import { lookupService } from '../../../services/lookups';
import type { Gateway } from '../../../types/database';

export default function NewGatewayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Gateway>>({
    enabled: true,
    install_approved: false,
  });

  const { data: sites = [] } = useReactQuery({
    queryKey: ['sites'],
    queryFn: () => lookupService.getSites(),
  });

  const { data: areas = [] } = useReactQuery({
    queryKey: ['areas', formData.site_id],
    queryFn: () => lookupService.getAreas(formData.site_id),
  });

  const { data: statuses = [] } = useReactQuery({
    queryKey: ['gatewayStatuses'],
    queryFn: () => lookupService.getGatewayStatuses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Gateway>) => gatewayService.createGateway(data as any),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gateways'] });
      router.replace(`/gateways/${data.id}`);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create gateway');
    },
  });

  const handleSave = () => {
    if (!formData.code) {
      Alert.alert('Validation Error', 'Code is required');
      return;
    }
    createMutation.mutate(formData);
  };

  const isLoading = createMutation.isPending;
  const connectionTypes = ['Ethernet', 'WiFi', 'Cellular', 'LoRa', 'Other'];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Code *</Text>
        <TextInput
          style={styles.input}
          value={formData.code}
          onChangeText={(text) => setFormData({ ...formData, code: text })}
          placeholder="Gateway code"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="Description"
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
        <Text style={styles.label}>Status</Text>
        <SimplePicker
          value={formData.status_id || null}
          options={statuses.map((status) => ({ label: status.status || 'Unknown', value: status.id }))}
          onValueChange={(value) => setFormData({ ...formData, status_id: value || undefined })}
          placeholder="Select Status"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Connection Type</Text>
        <SimplePicker
          value={formData.connection_type || null}
          options={connectionTypes.map((ct) => ({ label: ct, value: ct }))}
          onValueChange={(value) => setFormData({ ...formData, connection_type: value || undefined })}
          placeholder="Select Connection Type"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Serial No</Text>
        <TextInput
          style={styles.input}
          value={formData.serial_no?.toString()}
          onChangeText={(text) => setFormData({ ...formData, serial_no: text ? parseInt(text) : undefined })}
          placeholder="Serial Number"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>MAC Address</Text>
        <TextInput
          style={styles.input}
          value={formData.mac_address}
          onChangeText={(text) => setFormData({ ...formData, mac_address: text })}
          placeholder="MAC Address"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>IP Address</Text>
        <TextInput
          style={styles.input}
          value={formData.ip_address}
          onChangeText={(text) => setFormData({ ...formData, ip_address: text })}
          placeholder="IP Address"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(text) => setFormData({ ...formData, location: text })}
          placeholder="Location"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Mount Type</Text>
        <TextInput
          style={styles.input}
          value={formData.mount_type}
          onChangeText={(text) => setFormData({ ...formData, mount_type: text })}
          placeholder="Mount Type"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Power Type</Text>
        <TextInput
          style={styles.input}
          value={formData.power_type}
          onChangeText={(text) => setFormData({ ...formData, power_type: text })}
          placeholder="Power Type"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Router</Text>
        <TextInput
          style={styles.input}
          value={formData.router}
          onChangeText={(text) => setFormData({ ...formData, router: text })}
          placeholder="Router"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Version</Text>
        <TextInput
          style={styles.input}
          value={formData.version}
          onChangeText={(text) => setFormData({ ...formData, version: text })}
          placeholder="Version"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Notes"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Online</Text>
          <Switch
            value={formData.online || false}
            onValueChange={(value) => setFormData({ ...formData, online: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Power Required</Text>
          <Switch
            value={formData.power_required || false}
            onValueChange={(value) => setFormData({ ...formData, power_required: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>PoE Required</Text>
          <Switch
            value={formData.poe_required || false}
            onValueChange={(value) => setFormData({ ...formData, poe_required: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Router Required</Text>
          <Switch
            value={formData.router_required || false}
            onValueChange={(value) => setFormData({ ...formData, router_required: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Flex Required</Text>
          <Switch
            value={formData.flex_required || false}
            onValueChange={(value) => setFormData({ ...formData, flex_required: value })}
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

