import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sign-in screen (VCH-6): Google OAuth + phone OTP.
 * REQ-01: Google sign-in; REQ-02: Phone OTP.
 * Design reference: Cron / Notion Calendar — clean, minimal.
 */
export default function SignInScreen() {
  const router = useRouter();
  const {
    isLoading,
    isAuthenticated,
    signInWithGoogle,
    sendOTP,
    verifyOTP,
  } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start 30s countdown when entering OTP step.
  useEffect(() => {
    if (!otpSent) return;
    setResendCountdown(30);
  }, [otpSent]);

  // Decrement countdown every second.
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = globalThis.setInterval(
      () => setResendCountdown((c) => (c <= 1 ? 0 : c - 1)),
      1000,
    );
    return () => globalThis.clearInterval(id);
  }, [resendCountdown]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoadingGoogle(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSendOTP = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Enter your phone number (E.164, e.g. +14155551234)');
      return;
    }
    setError(null);
    setLoadingPhone(true);
    try {
      await sendOTP(trimmed);
      setOtpSent(true);
      setOtp('');
      setResendCountdown(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleVerifyOTP = async () => {
    const trimmedPhone = phone.trim();
    const trimmedOtp = otp.trim();
    if (!trimmedPhone || !trimmedOtp) {
      setError('Enter the code you received');
      return;
    }
    setError(null);
    setLoadingPhone(true);
    try {
      await verifyOTP(trimmedPhone, trimmedOtp);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired code');
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleBackFromOtp = () => {
    setOtpSent(false);
    setOtp('');
    setError(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
          <View className="flex-1 px-6 pt-12 pb-8 justify-center max-w-md w-full self-center">
            <Text className="text-2xl font-semibold text-slate-900 mb-1">
              Sign in
            </Text>
            <Text className="text-slate-500 text-base mb-8">
              Use Google or your phone number to continue.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={loadingGoogle}
              className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80"
            >
              {loadingGoogle ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium text-base">
                  Continue with Google
                </Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center my-8">
              <View className="flex-1 h-px bg-slate-200" />
              <Text className="px-4 text-slate-400 text-sm">or</Text>
              <View className="flex-1 h-px bg-slate-200" />
            </View>

            {!otpSent ? (
              <>
                <Text className="text-slate-600 text-sm mb-2">
                  Phone number (E.164, e.g. +14155551234)
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    setError(null);
                  }}
                  placeholder="+1 415 555 1234"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  editable={!loadingPhone}
                  className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
                />
                <TouchableOpacity
                  onPress={handleSendOTP}
                  disabled={loadingPhone}
                  className="h-12 border border-slate-300 rounded-xl items-center justify-center flex-row active:opacity-80"
                >
                  {loadingPhone ? (
                    <ActivityIndicator size="small" color="#475569" />
                  ) : (
                    <Text className="text-slate-700 font-medium text-base">
                      Send code
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-slate-600 text-sm mb-2">
                  Code sent to {phone}
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={(t) => {
                    setOtp(t);
                    setError(null);
                  }}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loadingPhone}
                  className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
                />
                <TouchableOpacity
                  onPress={handleVerifyOTP}
                  disabled={loadingPhone}
                  className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 mb-3"
                >
                  {loadingPhone ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-medium text-base">
                      Verify
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleBackFromOtp}
                  disabled={loadingPhone}
                  className="py-2"
                >
                  <Text className="text-slate-500 text-sm text-center">
                    Use a different number
                  </Text>
                </TouchableOpacity>
                {resendCountdown > 0 ? (
                  <Text className="text-slate-400 text-sm text-center mt-2">
                    Resend code ({resendCountdown}s)
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={handleSendOTP}
                    disabled={loadingPhone}
                    className="py-2 mt-2"
                  >
                    <Text className="text-slate-600 text-sm text-center font-medium">
                      Resend code
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
