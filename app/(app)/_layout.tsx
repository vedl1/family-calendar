import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

/**
 * Layout for authenticated app: bottom tab bar (Calendar, Groups, Profile).
 * Event routes are hidden from the tab bar so sub-screens push on top.
 * Auth guard: redirect to sign-in or onboarding when not authenticated or no profile.
 */
export default function AppLayout() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in');
    else if (!user) router.replace('/onboarding');
  }, [isLoading, isAuthenticated, user, router]);

  if (!isLoading && (!isAuthenticated || !user)) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
        },
        tabBarActiveTintColor: '#0f172a',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          href: '/calendar/week',
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          href: '/groups',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: '/profile',
        }}
      />
      <Tabs.Screen
        name="event"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
