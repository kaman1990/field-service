import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OrientationVisualizerProps {
  orientation: string | null | undefined;
}

const ORIENTATION_MAPPINGS: Record<string, { x: string; y: string; z: string; description: string }> = {
  AVH: { x: 'A', y: 'V', z: 'H', description: 'X→Axial, Y→Vertical, Z→Horizontal' },
  AHV: { x: 'A', y: 'H', z: 'V', description: 'X→Axial, Y→Horizontal, Z→Vertical' },
  VAH: { x: 'V', y: 'A', z: 'H', description: 'X→Vertical, Y→Axial, Z→Horizontal' },
  VHA: { x: 'V', y: 'H', z: 'A', description: 'X→Vertical, Y→Horizontal, Z→Axial' },
  HAV: { x: 'H', y: 'A', z: 'V', description: 'X→Horizontal, Y→Axial, Z→Vertical' },
  HVA: { x: 'H', y: 'V', z: 'A', description: 'X→Horizontal, Y→Vertical, Z→Axial' },
};

export const OrientationVisualizer: React.FC<OrientationVisualizerProps> = ({ orientation }) => {
  const [showModal, setShowModal] = useState(false);

  if (!orientation || !ORIENTATION_MAPPINGS[orientation]) {
    return null;
  }

  const mapping = ORIENTATION_MAPPINGS[orientation];

  const getAxisColor = (plane: string) => {
    switch (plane) {
      case 'A': return '#FF6B6B'; // Red for Axial
      case 'V': return '#4ECDC4'; // Teal for Vertical
      case 'H': return '#95E1D3'; // Light green for Horizontal
      default: return '#999';
    }
  };

  const getPlaneName = (plane: string) => {
    switch (plane) {
      case 'A': return 'Axial';
      case 'V': return 'Vertical';
      case 'H': return 'Horizontal';
      default: return '';
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
      >
        <View style={styles.visualization}>
          <View style={styles.axisRow}>
            <View style={styles.axisLabel}>
              <Text style={styles.axisText}>X</Text>
            </View>
            <View style={[styles.arrowContainer, { backgroundColor: getAxisColor(mapping.x) + '20' }]}>
              <Ionicons name="arrow-forward" size={16} color={getAxisColor(mapping.x)} />
            </View>
            <View style={[styles.planeLabel, { backgroundColor: getAxisColor(mapping.x) }]}>
              <Text style={styles.planeText}>{mapping.x}</Text>
            </View>
            <Text style={styles.planeName}>{getPlaneName(mapping.x)}</Text>
          </View>
          
          <View style={styles.axisRow}>
            <View style={styles.axisLabel}>
              <Text style={styles.axisText}>Y</Text>
            </View>
            <View style={[styles.arrowContainer, { backgroundColor: getAxisColor(mapping.y) + '20' }]}>
              <Ionicons name="arrow-forward" size={16} color={getAxisColor(mapping.y)} />
            </View>
            <View style={[styles.planeLabel, { backgroundColor: getAxisColor(mapping.y) }]}>
              <Text style={styles.planeText}>{mapping.y}</Text>
            </View>
            <Text style={styles.planeName}>{getPlaneName(mapping.y)}</Text>
          </View>
          
          <View style={styles.axisRow}>
            <View style={styles.axisLabel}>
              <Text style={styles.axisText}>Z</Text>
            </View>
            <View style={[styles.arrowContainer, { backgroundColor: getAxisColor(mapping.z) + '20' }]}>
              <Ionicons name="arrow-forward" size={16} color={getAxisColor(mapping.z)} />
            </View>
            <View style={[styles.planeLabel, { backgroundColor: getAxisColor(mapping.z) }]}>
              <Text style={styles.planeText}>{mapping.z}</Text>
            </View>
            <Text style={styles.planeName}>{getPlaneName(mapping.z)}</Text>
          </View>
        </View>
        <Ionicons name="information-circle-outline" size={18} color="#007AFF" style={styles.infoIcon} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Orientation Mapping Guide</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Legend:</Text>
                <View style={styles.legendRow}>
                  <View style={[styles.legendColor, { backgroundColor: '#FF6B6B' }]} />
                  <Text style={styles.legendText}>A = Axial (along rotation axis)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendColor, { backgroundColor: '#4ECDC4' }]} />
                  <Text style={styles.legendText}>V = Vertical (up/down)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendColor, { backgroundColor: '#95E1D3' }]} />
                  <Text style={styles.legendText}>H = Horizontal (side to side)</Text>
                </View>
              </View>

              <View style={styles.mappingSection}>
                <Text style={styles.mappingTitle}>Current Mapping ({orientation}):</Text>
                <View style={styles.mappingVisualization}>
                  <View style={styles.mappingRow}>
                    <Text style={styles.mappingLabel}>Sensor X →</Text>
                    <View style={[styles.mappingBadge, { backgroundColor: getAxisColor(mapping.x) }]}>
                      <Text style={styles.mappingBadgeText}>{mapping.x} ({getPlaneName(mapping.x)})</Text>
                    </View>
                  </View>
                  <View style={styles.mappingRow}>
                    <Text style={styles.mappingLabel}>Sensor Y →</Text>
                    <View style={[styles.mappingBadge, { backgroundColor: getAxisColor(mapping.y) }]}>
                      <Text style={styles.mappingBadgeText}>{mapping.y} ({getPlaneName(mapping.y)})</Text>
                    </View>
                  </View>
                  <View style={styles.mappingRow}>
                    <Text style={styles.mappingLabel}>Sensor Z →</Text>
                    <View style={[styles.mappingBadge, { backgroundColor: getAxisColor(mapping.z) }]}>
                      <Text style={styles.mappingBadgeText}>{mapping.z} ({getPlaneName(mapping.z)})</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.allMappings}>
                <Text style={styles.allMappingsTitle}>All Orientations:</Text>
                {Object.entries(ORIENTATION_MAPPINGS).map(([code, map]) => (
                  <View key={code} style={styles.allMappingRow}>
                    <Text style={styles.allMappingCode}>{code}:</Text>
                    <Text style={styles.allMappingDesc}>{map.description}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  visualization: {
    flex: 1,
  },
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  axisLabel: {
    width: 24,
    alignItems: 'center',
  },
  axisText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  arrowContainer: {
    marginHorizontal: 8,
    padding: 4,
    borderRadius: 4,
  },
  planeLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  planeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  planeName: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoIcon: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalScrollView: {
    maxHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  legend: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  mappingSection: {
    marginBottom: 24,
  },
  mappingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  mappingVisualization: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mappingLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginRight: 12,
    minWidth: 80,
  },
  mappingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mappingBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  allMappings: {
    maxHeight: 200,
  },
  allMappingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  allMappingRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  allMappingCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    minWidth: 50,
  },
  allMappingDesc: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
});

