import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

/**
 * Derives initials from display name (e.g. "Jane Doe" -> "JD").
 */
function getInitials(displayName: string | null): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Profile screen: display name, avatar, edit and change photo, save, sign out.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, updateProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
  }, [user?.display_name]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" style={{ flex: 1 }}>
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const avatarUri = pendingAvatarUri ?? user.avatar_url;
  const initials = getInitials(displayName.trim() || user.display_name);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library access is required to change your photo.');
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
      setPendingAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatarAndGetUrl = async (): Promise<string | null> => {
    if (!pendingAvatarUri) return user.avatar_url;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return user.avatar_url;
      const path = `${authUser.id}/avatar-${Date.now()}.jpg`;
      const response = await fetch(pendingAvatarUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) return user.avatar_url;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return user.avatar_url;
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const avatarUrl = await uploadAvatarAndGetUrl();
      const nameToSave = displayName.trim() || (user.display_name ?? '');
      await updateProfile({
        display_name: nameToSave,
        ...(avatarUrl != null && avatarUrl !== '' && { avatar_url: avatarUrl }),
      });
      setPendingAvatarUri(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
      router.replace('/sign-in');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign out');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-8 max-w-md w-full self-center">
        <Text className="text-2xl font-semibold text-slate-900 mb-6">Profile</Text>

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
              <Text className="text-slate-600 text-2xl font-medium">{initials}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} className="mt-3">
            <Text className="text-slate-500 text-sm">Change photo</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-slate-600 text-sm mb-2">Edit display name</Text>
        <TextInput
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            setError(null);
          }}
          placeholder="Display name"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saving}
          className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-6"
        />

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 disabled:opacity-50 mb-6"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-medium text-base">Save</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          disabled={saving}
          className="h-12 border border-slate-300 rounded-xl items-center justify-center"
        >
          <Text className="text-slate-700 font-medium text-base">Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
