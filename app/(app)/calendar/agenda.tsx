import { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EventWithMeta, Importance } from '@/contracts/types';
import { useGroup } from '@/hooks/useGroup';
import { useEvents } from '@/hooks/useEvents';
import { ImportanceShape } from '@/components/ImportanceShape';

/** Format start_time "HH:MM:SS" as "H:MM am/pm". */
function formatTime(startTime: string | null): string {
  if (!startTime) return 'All day';
  const [h, m] = startTime.split(':').map(Number);
  if (h === 0 && m === 0) return '12:00 am';
  if (h === 12) return `12:${String(m).padStart(2, '0')} pm`;
  if (h > 12) return `${h - 12}:${String(m).padStart(2, '0')} pm`;
  return `${h}:${String(m).padStart(2, '0')} am`;
}

/** Format duration_mins as "30 min" or "1 hr 30 min". */
function formatDuration(mins: number | null): string {
  if (mins == null || mins <= 0) return '';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Format event_date "YYYY-MM-DD" as "Mon, Mar 10" for section headers. */
function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * VCH-21 / REQ-24: Agenda / list view.
 * Events in chronological order (upcoming first), grouped by date.
 * useEvents(groupId) + useGroup(); no direct Supabase.
 */
export default function AgendaScreen() {
  const router = useRouter();
  const { activeGroup } = useGroup();
  const groupId = activeGroup?.id ?? null;
  const { events, isLoading, error } = useEvents(groupId);

  const eventsByDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...events]
      .filter((e) => e.event_date >= today)
      .sort((a, b) => {
      const dateCmp = a.event_date.localeCompare(b.event_date);
      if (dateCmp !== 0) return dateCmp;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    const map: Record<string, EventWithMeta[]> = {};
    sorted.forEach((evt) => {
      if (!map[evt.event_date]) map[evt.event_date] = [];
      map[evt.event_date].push(evt);
    });
    return map;
  }, [events]);

  const dateKeys = useMemo(() => Object.keys(eventsByDate).sort(), [eventsByDate]);

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">
          Select a group to view the calendar.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading events…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="px-4 pt-4 pb-2 border-b border-slate-200">
        <Text className="text-xl font-semibold text-slate-900">Agenda</Text>
      </View>

      {error ? (
        <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      ) : null}

      {dateKeys.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-slate-500 text-base text-center">
            No upcoming events
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {dateKeys.map((dateStr) => (
            <View key={dateStr} className="px-4 pt-4">
              <Text className="text-slate-500 text-sm font-medium mb-2">
                {formatDateHeader(dateStr)}
              </Text>
              {(eventsByDate[dateStr] ?? []).map((event) => (
                <AgendaRow
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AgendaRow({
  event,
  onPress,
}: {
  event: EventWithMeta;
  onPress: () => void;
}) {
  const timeStr = formatTime(event.start_time);
  const durationStr = formatDuration(event.duration_mins);
  const timeAndDuration =
    durationStr ? `${timeStr} · ${durationStr}` : timeStr;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center py-3 border-b border-slate-100"
    >
      <View className="w-6 items-center justify-center">
        <ImportanceShape importance={event.importance as Importance} size={14} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-slate-900 font-medium" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="text-slate-500 text-sm mt-0.5" numberOfLines={1}>
          {timeAndDuration}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
