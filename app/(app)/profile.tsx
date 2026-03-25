import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';

/**
 * Profile screen — display name edit, sign out.
 * REQ-03: User can update their display name and sign out.
 */
export default function ProfileScreen() {
  const { user, isLoading, updateProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.display_name) {
      setDisplayName(user.display_name);
    }
  }, [user?.display_name]);

  const handleSave = async () => {
    const name = displayName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ display_name: name });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" style={{ flex: 1 }}>
        <ActivityIndicator size="large" color="#475569" />
      </SafeAreaView>
    );
  }

  const initials = (user?.display_name ?? '')
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 pt-8 max-w-md w-full self-center">
          <Text className="text-2xl font-semibold text-slate-900 mb-1">Profile</Text>
          <Text className="text-slate-500 text-base mb-8">Manage your account details.</Text>

          {/* Avatar */}
          <View className="items-center mb-8">
            <View
              className="w-20 h-20 rounded-full bg-slate-200 items-center justify-center"
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 28, fontWeight: '600', color: '#475569' }}>
                {initials || '?'}
              </Text>
            </View>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          ) : null}

          {saved ? (
            <View className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-green-700 text-sm">Profile updated.</Text>
            </View>
          ) : null}

          <Text className="text-slate-600 text-sm mb-2">Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={(t) => { setDisplayName(t); setSaved(false); }}
            placeholder="Your name"
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
            editable={!saving}
            style={{ height: 48, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#0f172a', marginBottom: 16, backgroundColor: '#fff' }}
          />

          <Text className="text-slate-600 text-sm mb-2">
            {user?.phone ? 'Phone' : 'Email'}
          </Text>
          <View style={{ height: 48, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 24, backgroundColor: '#f8fafc' }}>
            <Text style={{ fontSize: 16, color: '#94a3b8' }}>
              {user?.phone ?? user?.email ?? '—'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!displayName.trim() || saving}
            style={{
              height: 48,
              backgroundColor: !displayName.trim() || saving ? '#94a3b8' : '#0f172a',
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Save changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              height: 48,
              borderWidth: 1,
              borderColor: '#fca5a5',
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 16 }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
