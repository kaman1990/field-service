import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../lib/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = React.memo(({ value, onChangeText, placeholder = 'Search...' }) => {
  const { colors } = useTheme();
  
  const handleClear = () => {
    onChangeText('');
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      padding: 10,
      backgroundColor: colors.background,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
    },
    searchIcon: {
      fontSize: 16,
      marginRight: 8,
      color: colors.textSecondary,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
    },
    clearIcon: {
      fontSize: 18,
      color: colors.textSecondary,
      fontWeight: 'bold',
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.inputContainer}>
        <Text style={dynamicStyles.searchIcon}>🔍</Text>
        <TextInput
          style={dynamicStyles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Search input"
          accessibilityRole="searchbox"
          accessibilityHint="Enter text to search"
        />
        {value.length > 0 && (
          <TouchableOpacity 
            onPress={handleClear} 
            style={styles.clearButton} 
            activeOpacity={0.7}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            accessibilityHint="Clears the search input"
          >
            <Text style={dynamicStyles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});

