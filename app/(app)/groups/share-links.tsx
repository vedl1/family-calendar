import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/hooks/useGroup';
import { useShareLinks } from '@/hooks/useShareLinks';

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return 'No expiry';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateToken(token: string, len = 8): string {
  if (token.length <= len) return token;
  return `${token.slice(0, len)}…`;
}

/**
 * VCH-29, VCH-34: Share link generation and revocation UI.
 * useShareLinks(groupId); list non-revoked links; generate (optional expiry); revoke with confirm.
 */
export default function ShareLinksScreen() {
  const router = useRouter();
  const { activeGroup, isAdmin } = useGroup();
  const groupId = activeGroup?.id ?? null;
  const { links, isLoading, error, generate, revoke } = useShareLinks(groupId);

  const [setExpiry, setSetExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeLinks = links.filter((l) => !l.revoked);
  const expiryValid = !setExpiry || /^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim());

  const handleGenerate = async () => {
    if (!groupId) return;
    setGenerating(true);
    try {
      if (setExpiry && expiryDate.trim()) {
        const iso = new Date(expiryDate.trim() + 'T23:59:59').toISOString();
        await generate(iso);
      } else {
        await generate();
      }
      setExpiryDate('');
      setSetExpiry(false);
    } catch {
      // error from hook
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = (linkId: string) => {
    Alert.alert(
      'Revoke link',
      'This link will stop working. Anyone with the link will no longer be able to join. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevokingId(linkId);
            try {
              await revoke(linkId);
            } finally {
              setRevokingId(null);
            }
          },
        },
      ],
    );
  };

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Select a group to manage share links.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 pt-4 pb-2 border-b border-slate-200">
          <TouchableOpacity onPress={() => router.back()} className="mb-2">
            <Text className="text-slate-500 text-base">Back</Text>
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-slate-900">Share links</Text>
        </View>

        {error ? (
          <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <View className="px-4 pt-4">
          {isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" className="text-slate-600" />
              <Text className="mt-3 text-slate-500 text-sm">Loading share links…</Text>
            </View>
          ) : activeLinks.length === 0 ? (
            <View className="py-8">
              <Text className="text-slate-500 text-center">No active share links</Text>
            </View>
          ) : (
            <View>
              {activeLinks.map((link) => (
                <View
                  key={link.id}
                  className="border border-slate-200 rounded-xl p-4 mb-4"
                >
                  <View className="flex-row items-center justify-between flex-wrap gap-2">
                    <View className="flex-1 min-w-0">
                      <Text className="text-slate-700 font-medium">
                        {truncateToken(link.token)}
                      </Text>
                      <Text className="text-slate-500 text-sm mt-0.5">
                        Expires: {formatExpiry(link.expires_at)}
                      </Text>
                    </View>
                    {isAdmin ? (
                      <TouchableOpacity
                        onPress={() => handleRevoke(link.id)}
                        disabled={!!revokingId}
                        className="px-4 py-2 rounded-lg bg-red-100"
                      >
                        {revokingId === link.id ? (
                          <ActivityIndicator size="small" color="#b91c1c" />
                        ) : (
                          <Text className="text-red-700 font-medium text-sm">Revoke</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text className="text-slate-400 text-xs mt-2" selectable>
                    family-calendar://groups/join?token={link.token}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {isAdmin ? (
            <View className="mt-6 pt-4 border-t border-slate-200">
              <TouchableOpacity
                onPress={() => setSetExpiry((v) => !v)}
                className="flex-row items-center mb-3"
              >
                <View
                  className="w-5 h-5 rounded border border-slate-300 mr-2 items-center justify-center"
                  style={{ backgroundColor: setExpiry ? '#0f172a' : 'transparent' }}
                >
                  {setExpiry ? (
                    <Text className="text-white text-xs">✓</Text>
                  ) : null}
                </View>
                <Text className="text-slate-600 text-sm">Set expiry</Text>
              </TouchableOpacity>
              {setExpiry ? (
                <TextInput
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  className="h-10 border border-slate-200 rounded-lg px-3 text-slate-900 text-sm mb-4"
                />
              ) : null}
              <TouchableOpacity
                onPress={handleGenerate}
                disabled={generating || (setExpiry && !expiryValid)}
                className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 disabled:opacity-50"
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-medium text-base">Generate link</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
