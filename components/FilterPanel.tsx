import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterPanelProps {
  label: string;
  options: FilterOption[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ label, options, selectedId, onSelect }) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedId && styles.filterChipActive]}
            onPress={() => onSelect(undefined)}
          >
            <Text style={[styles.filterText, !selectedId && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.filterChip, selectedId === option.id && styles.filterChipActive]}
              onPress={() => onSelect(option.id)}
            >
              <Text style={[styles.filterText, selectedId === option.id && styles.filterTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
    minWidth: 60,
  },
  scrollView: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterText: {
    fontSize: 12,
    color: '#333',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

