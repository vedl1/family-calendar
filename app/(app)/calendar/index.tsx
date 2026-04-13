import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Calendar segment default: redirect to week view so the Calendar tab lands on /calendar/week.
 */
export default function CalendarIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/calendar/week');
  }, [router]);
  return null;
}
