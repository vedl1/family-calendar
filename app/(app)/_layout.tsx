import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

/**
 * Layout for authenticated app screens — groups, calendar, etc.
 * Auth guard: redirect to sign-in when not authenticated.
 */
export default function AppLayout() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/sign-in');
      return;
    }
    // Guard direct deep-links into (app) before onboarding completion.
    if (!user || !user.display_name) {
      router.replace('/onboarding');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (!isLoading && (!isAuthenticated || !user || !user.display_name)) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
