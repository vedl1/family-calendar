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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

/**
 * Derives initials from display name (e.g. "Jane Doe" -> "JD", "Alice" -> "AL").
 */
function getInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0]! + parts[parts.length - 1]![0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * First-time onboarding (VCH-8, REQ-03): set display name and optional profile photo.
 * Uses updateProfile() from useAuth; on success navigates to '/'.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/sign-in');
    }
  }, [isAuthenticated, isLoading, router]);

  const displayNameTrimmed = displayName.trim();
  const canSubmit = displayNameTrimmed.length > 0 && !submitting;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library access is required to add a profile photo.');
      return;
    }
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatarAndGetUrl = async (): Promise<string | undefined> => {
    if (!avatarUri) return undefined;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return undefined;
      const path = `${authUser.id}/avatar-${Date.now()}.jpg`;
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) return undefined;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return undefined;
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarUri) {
        avatarUrl = await uploadAvatarAndGetUrl();
        // Fall back to initials on upload failure (avatar_url left undefined)
      }
      await updateProfile({
        display_name: displayNameTrimmed,
        ...(avatarUrl && { avatar_url: avatarUrl }),
      });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const initials = getInitials(displayNameTrimmed || 'User');

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
            <Text className="text-2xl font-semibold text-slate-900 mb-1">
              Welcome
            </Text>
            <Text className="text-slate-500 text-base mb-8">
              Set your display name and optional profile photo.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <View className="items-center mb-8">
              <TouchableOpacity
                onPress={pickImage}
                className="w-24 h-24 rounded-full bg-slate-200 items-center justify-center overflow-hidden"
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-slate-600 text-2xl font-medium">
                    {initials}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} className="mt-3">
                <Text className="text-slate-500 text-sm">
                  {avatarUri ? 'Change photo' : 'Add photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-slate-600 text-sm mb-2">Display name (required)</Text>
            <TextInput
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t);
                setError(null);
              }}
              placeholder="How should we call you?"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-6"
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
                  Continue
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
