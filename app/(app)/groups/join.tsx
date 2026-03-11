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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJoinGroup } from '@/hooks/useJoinGroup';

/**
 * Extract token from pasted value: full link (…?token=abc123) or raw token (abc123).
 * If input contains "token=", take the value after it (up to next & or end).
 */
function parseToken(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('token=')) {
    const after = trimmed.split('token=')[1] ?? '';
    return (after.split('&')[0] ?? '').trim();
  }
  return trimmed;
}

/**
 * Join group via invite link screen (VCH-50).
 * Reached via deep link (token in URL) or from empty state CTA (no token).
 */
export default function JoinGroupScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { join, isLoading, error } = useJoinGroup();

  const [input, setInput] = useState('');

  useEffect(() => {
    if (tokenParam && typeof tokenParam === 'string') {
      setInput(tokenParam);
    }
  }, [tokenParam]);

  const token = parseToken(input);
  const canSubmit = token.length > 0 && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await join(token);
      router.replace('/');
    } catch {
      // error set by useJoinGroup
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
          style={{ flex: 1 }}
        >
          <View className="flex-1 px-6 pt-12 pb-8 justify-center max-w-md w-full self-center">
            <TouchableOpacity onPress={() => router.back()} className="mb-6">
              <Text className="text-slate-500 text-base">Back</Text>
            </TouchableOpacity>

            <Text className="text-2xl font-semibold text-slate-900 mb-1">
              Join a group
            </Text>
            <Text className="text-slate-500 text-base mb-8">
              Enter the invite token or paste the full invite link.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Paste invite link or token"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-6"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 disabled:opacity-50"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium text-base">
                  Join group
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
