import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders correctly', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={() => {}} />
    );
    
    expect(getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('calls onChangeText when text is entered', () => {
    const mockOnChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={mockOnChangeText} />
    );
    
    const input = getByPlaceholderText('Search...');
    fireEvent.changeText(input, 'test query');
    
    expect(mockOnChangeText).toHaveBeenCalledWith('test query');
  });

  it('shows clear button when value is not empty', () => {
    const { getByText } = render(
      <SearchBar value="test" onChangeText={() => {}} />
    );
    
    expect(getByText('✕')).toBeTruthy();
  });

  it('calls onChangeText with empty string when clear button is pressed', () => {
    const mockOnChangeText = jest.fn();
    const { getByText } = render(
      <SearchBar value="test" onChangeText={mockOnChangeText} />
    );
    
    const clearButton = getByText('✕');
    fireEvent.press(clearButton);
    
    expect(mockOnChangeText).toHaveBeenCalledWith('');
  });

  it('uses custom placeholder when provided', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={() => {}} placeholder="Custom placeholder" />
    );
    
    expect(getByPlaceholderText('Custom placeholder')).toBeTruthy();
  });
});

