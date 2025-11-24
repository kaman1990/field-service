import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';

interface UpdateBannerProps {
  onUpdate?: () => void;
}

export function UpdateBanner({ onUpdate }: UpdateBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [registration, setRegistration] = useState<any>(null);

  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let isMounted = true;

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        if (isMounted) {
          setRegistration(registration);
        }

        // Check for updates immediately
        await registration.update();

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is installed and waiting
              if (isMounted) {
                setShowBanner(true);
              }
            }
          });
        });

        // Listen for controller change (when update is activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (isMounted) {
            setShowBanner(false);
            // Reload the page to get the new version
            window.location.reload();
          }
        });

        // Periodic update check (every 5 minutes)
        const updateInterval = setInterval(async () => {
          try {
            await registration.update();
          } catch (error) {
            // Error checking for updates
          }
        }, 5 * 60 * 1000); // 5 minutes

        return () => {
          clearInterval(updateInterval);
        };
      } catch (error) {
        // Service worker registration failed
      }
    };

    registerSW();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdate = async () => {
    if (!registration || !registration.waiting) {
      return;
    }

    setIsUpdating(true);

    // Tell the waiting service worker to skip waiting and activate
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // The controllerchange event will handle the reload
    // But if it doesn't fire, reload after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (!showBanner || Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.text}>New version available</Text>
        <TouchableOpacity
          style={[styles.button, isUpdating && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={isUpdating}
        >
          <Text style={styles.buttonText}>
            {isUpdating ? 'Updating...' : 'Tap to update'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
    }),
  },
  banner: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

