import { Stack } from 'expo-router';

/**
 * Layout for (auth) route group — sign-in, sign-up, etc.
 * Stack with no header for a clean auth screen experience.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
