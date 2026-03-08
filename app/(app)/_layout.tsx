import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

/**
 * Layout for authenticated app screens — groups, calendar, etc.
 * Auth guard: redirect to sign-in when not authenticated.
 */
export default function AppLayout() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/sign-in');
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
