import { useState } from 'react';
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
import { useGroup } from '@/hooks/useGroup';

type InviteStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * VCH-13: Member invite flow.
 * Input: email or phone (E.164 hint). On submit: inviteMember(emailOrPhone) from useGroup.
 * Shows pending/success/error states.
 */
export default function InviteScreen() {
  const router = useRouter();
  const { activeGroup, inviteMember, error } = useGroup();

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [status, setStatus] = useState<InviteStatus>('idle');

  const trimmed = emailOrPhone.trim();
  const canSubmit = trimmed.length > 0 && status !== 'pending';

  const handleSubmit = async () => {
    if (!canSubmit || !activeGroup) return;
    setStatus('pending');
    try {
      await inviteMember(trimmed);
      setStatus('success');
      setEmailOrPhone('');
    } catch {
      setStatus('error');
    }
  };

  if (!activeGroup) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Select a group first.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-slate-700 font-medium">Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
          <View className="flex-1 px-6 pt-12 pb-8 max-w-md w-full self-center">
            <TouchableOpacity onPress={() => router.back()} className="mb-6">
              <Text className="text-slate-500 text-base">Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-semibold text-slate-900 mb-1">
              Invite member
            </Text>
            <Text className="text-slate-500 text-base mb-8">
              Enter their email or phone (E.164, e.g. +14155551234). They must already have an account.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            {status === 'success' ? (
              <View className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-green-800 text-sm">Invite sent. They can accept from their account.</Text>
              </View>
            ) : null}

            <Text className="text-slate-600 text-sm mb-2">Email or phone</Text>
            <TextInput
              value={emailOrPhone}
              onChangeText={(t) => {
                setEmailOrPhone(t);
                setStatus('idle');
              }}
              placeholder="email@example.com or +14155551234"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={status !== 'pending'}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 disabled:opacity-50 mb-3"
            >
              {status === 'pending' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium text-base">
                  Send invite
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              className="py-2"
            >
              <Text className="text-slate-500 text-sm text-center">Back to groups</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
