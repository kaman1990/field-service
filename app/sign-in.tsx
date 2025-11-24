import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { connectPowerSync } from '../lib/powersync';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const setFeedbackMessage = (
    type: 'success' | 'error' | 'info',
    message: string
  ) => {
    setFeedback({ type, message });
  };

  const clearFeedback = () => setFeedback(null);

  const handleSignIn = async () => {
    if (loading) {
      return;
    }

    clearFeedback();

    if (!email || !password) {
      setFeedbackMessage('error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setFeedbackMessage('error', error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        try {
          await connectPowerSync();
        } catch (psError) {
          // PowerSync connection failed, but continue with sign in
        }
        
        setFeedbackMessage('success', 'Welcome back! Redirecting you now...');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      setFeedbackMessage(
        'error',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (loading) {
      return;
    }

    clearFeedback();

    if (!email || !password) {
      setFeedbackMessage('error', 'Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      setFeedbackMessage('error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setFeedbackMessage('error', error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        setFeedbackMessage(
          'success',
          'Account created! Check your inbox for the verification email, then sign in once verified.'
        );
        setIsSignUp(false);
      }
    } catch (error: any) {
      setFeedbackMessage(
        'error',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (loading) {
      return;
    }

    if (isSignUp) {
      handleSignUp();
    } else {
      handleSignIn();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Field Asset Management</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create an account' : 'Sign in to continue'}
          </Text>

          {feedback && (
            <View
              style={[
                styles.feedbackContainer,
                feedback.type === 'success' && styles.feedbackSuccess,
                feedback.type === 'error' && styles.feedbackError,
                feedback.type === 'info' && styles.feedbackInfo,
              ]}
            >
              <Text style={styles.feedbackText}>{feedback.message}</Text>
            </View>
          )}

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
              returnKeyType="next"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              returnKeyType={isSignUp ? 'send' : 'go'}
              onSubmitEditing={handleSubmit}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                clearFeedback();
                setIsSignUp(!isSignUp);
              }}
              disabled={loading}
            >
              <Text style={styles.switchButtonText}>
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  feedbackContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  feedbackText: {
    color: '#222',
    fontSize: 14,
    textAlign: 'center',
  },
  feedbackSuccess: {
    backgroundColor: '#e7f7ec',
    borderWidth: 1,
    borderColor: '#c4ebd2',
  },
  feedbackError: {
    backgroundColor: '#fdeaea',
    borderWidth: 1,
    borderColor: '#f5c2c0',
  },
  feedbackInfo: {
    backgroundColor: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#c3d5fd',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
});
