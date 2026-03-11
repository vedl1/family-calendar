import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function RootIndex() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/groups');
    } else {
      router.replace('/sign-in');
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#475569" />
    </View>
  );
}
