import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/hooks/useGroup';

/**
 * App home: redirect to groups list.
 */
export default function AppIndexScreen() {
  const router = useRouter();
  const { isLoading } = useGroup();

  useEffect(() => {
    if (!isLoading) {
      router.replace('/groups');
    }
  }, [isLoading, router]);

  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" className="text-slate-600" />
      <Text className="mt-3 text-slate-500 text-base">Loading…</Text>
    </SafeAreaView>
  );
}
