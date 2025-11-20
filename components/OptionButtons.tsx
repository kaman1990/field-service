import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Option {
  label: string;
  value: string | null | undefined;
}

interface OptionButtonsProps {
  value: string | null | undefined;
  options: Option[];
  onValueChange: (value: string | null) => void;
}

export const OptionButtons: React.FC<OptionButtonsProps> = ({
  value,
  options,
  onValueChange,
}) => {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.button, isSelected && styles.buttonSelected]}
            onPress={() => onValueChange(option.value)}
          >
            <Text style={[styles.buttonText, isSelected && styles.buttonTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  buttonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});

