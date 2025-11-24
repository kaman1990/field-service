import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, TextInput } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onBarcodeScanned, onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [manualSerial, setManualSerial] = useState('');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    // Reset scanned state when component mounts
    setScanned(false);
    setError(null);
    
    // On web, ensure camera is ready for barcode scanning
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data, type }: BarcodeScanningResult) => {
    if (!scanned && data) {
      setScanned(true);
      onBarcodeScanned(data);
      onClose();
    }
  };

  const handleMountError = (error: any) => {
    setError('Failed to access camera. Please ensure camera permissions are granted.');
  };

  const handleManualSubmit = () => {
    if (manualSerial.trim()) {
      onBarcodeScanned(manualSerial.trim());
      onClose();
    }
  };

  // On web, only QR codes are supported
  const barcodeTypes = Platform.OS === 'web' 
    ? ['qr'] 
    : ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'codabar', 'upc_a', 'upc_e'];

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {Platform.OS === 'web' && (
            <Text style={styles.infoText}>
              Note: On web, only QR codes are supported. Other barcode types require a native app.
            </Text>
          )}
          <TouchableOpacity style={styles.button} onPress={() => { setError(null); setScanned(false); }}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (manualEntryMode) {
    return (
      <View style={styles.container}>
        <View style={styles.manualContainer}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.manualContent}>
            <Text style={styles.manualTitle}>Enter Serial Number</Text>
            <TextInput
              style={styles.manualInput}
              value={manualSerial}
              onChangeText={setManualSerial}
              placeholder="Enter serial number..."
              placeholderTextColor="#999"
              autoFocus
              onSubmitEditing={handleManualSubmit}
              returnKeyType="done"
            />
            <View style={styles.manualButtons}>
              <TouchableOpacity
                style={[styles.button, styles.switchButton]}
                onPress={() => setManualEntryMode(false)}
              >
                <Text style={styles.buttonText}>Scan Instead</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, !manualSerial.trim() && styles.buttonDisabled]}
                onPress={handleManualSubmit}
                disabled={!manualSerial.trim()}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes,
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        onMountError={handleMountError}
        enableTorch={false}
      />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
          <Text style={styles.instructionText}>
            {Platform.OS === 'web' 
              ? 'Position QR code within the frame' 
              : 'Position barcode/QR code within the frame'}
          </Text>
        </View>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setManualEntryMode(true)}
          >
            <Text style={styles.manualButtonText}>Enter Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  manualButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  manualContent: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  manualTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff',
    marginBottom: 24,
  },
  manualButtons: {
    gap: 12,
  },
  switchButton: {
    backgroundColor: '#666',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

