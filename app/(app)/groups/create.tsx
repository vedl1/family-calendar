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

/**
 * VCH-12: Create group screen.
 * Form: name (required), description (optional).
 * On submit: createGroup() from useGroup, then navigate to the group (groups index).
 */
export default function CreateGroupScreen() {
  const router = useRouter();
  const { createGroup, error } = useGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameTrimmed = name.trim();
  const canSubmit = nameTrimmed.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createGroup({
        name: nameTrimmed,
        ...(description.trim() && { description: description.trim() }),
      });
      router.replace('/groups');
    } finally {
      setSubmitting(false);
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
          <View className="flex-1 px-6 pt-12 pb-8 max-w-md w-full self-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-6"
            >
              <Text className="text-slate-500 text-base">Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-semibold text-slate-900 mb-1">
              Create group
            </Text>
            <Text className="text-slate-500 text-base mb-8">
              Add a name and optional description.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <Text className="text-slate-600 text-sm mb-2">Group name (required)</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Smith Family"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
            />

            <Text className="text-slate-600 text-sm mb-2">Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Family events and holidays"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
              editable={!submitting}
              className="min-h-12 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base mb-6"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 disabled:opacity-50"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium text-base">
                  Create group
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
