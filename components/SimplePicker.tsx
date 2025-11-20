import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';

interface Option {
  label: string;
  value: string | null | undefined;
}

interface SimplePickerProps {
  value: string | null | undefined;
  options: Option[];
  onValueChange: (value: string | null) => void;
  placeholder?: string;
}

export const SimplePicker: React.FC<SimplePickerProps> = ({
  value,
  options,
  onValueChange,
  placeholder = 'Select...',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedOption = options.find(opt => {
    if (opt.value === null || opt.value === undefined) {
      return value === null || value === undefined;
    }
    return opt.value === value;
  });

  return (
    <View>
      <TouchableOpacity
        style={styles.picker}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.pickerText, !value && styles.placeholder]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Option</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
            >
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  onValueChange(null);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.optionText}>None</Text>
              </TouchableOpacity>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, value === option.value && styles.optionSelected]}
                  onPress={() => {
                    onValueChange(option.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, value === option.value && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholder: {
    color: '#999',
  },
  arrow: {
    fontSize: 12,
    color: '#666',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollView: {
    maxHeight: 400,
  },
  option: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  optionSelected: {
    backgroundColor: '#e3f2fd',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#1976d2',
    fontWeight: '600',
  },
});

