import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function RootIndex() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      // Enforce onboarding before entering the authenticated app shell.
      if (!user || !user.display_name) {
        router.replace('/onboarding');
        return;
      }
      router.replace('/calendar/week');
    } else {
      router.replace('/sign-in');
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#475569" />
    </View>
  );
}
