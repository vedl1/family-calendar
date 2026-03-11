import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EventWithMeta, Importance } from '@/contracts/types';
import { IMPORTANCE } from '@/contracts/types';
import { useGroup } from '@/hooks/useGroup';
import { useEvents } from '@/hooks/useEvents';
import { ImportanceShape } from '@/components/ImportanceShape';
import { ImportanceLegend } from '@/components/ImportanceLegend';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday 00:00 of the week containing the given date. */
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format start_time "HH:MM:SS" as "H:MM am/pm" or "HH:MM". */
function formatTime(startTime: string | null): string {
  if (!startTime) return 'All day';
  const [h, m] = startTime.split(':').map(Number);
  if (h === 0 && m === 0) return '12:00 am';
  if (h === 12) return `12:${String(m).padStart(2, '0')} pm`;
  if (h > 12) return `${h - 12}:${String(m).padStart(2, '0')} pm`;
  return `${h}:${String(m).padStart(2, '0')} am`;
}

/**
 * VCH-20: Week view calendar.
 * 7-day grid (Mon–Sun), current week by default; event cards with title, time, importance.
 * Uses useEvents(activeGroup.id) and useGroup(); no direct Supabase.
 */
export default function WeekViewScreen() {
  const router = useRouter();
  const { activeGroup } = useGroup();
  const groupId = activeGroup?.id ?? null;
  const { events, isLoading, error } = useEvents(groupId);

  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = getWeekStart(new Date());
    const mon = new Date(base);
    mon.setDate(mon.getDate() + weekOffset * 7);
    return mon;
  }, [weekOffset]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekStartStr = toISODate(weekDates[0]!);
  const weekEndStr = toISODate(weekDates[6]!);

  const eventsInWeek = useMemo(() => {
    return events.filter(
      (e) => e.event_date >= weekStartStr && e.event_date <= weekEndStr,
    );
  }, [events, weekStartStr, weekEndStr]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventWithMeta[]> = {};
    weekDates.forEach((d) => {
      map[toISODate(d)] = [];
    });
    eventsInWeek.forEach((evt) => {
      const key = evt.event_date;
      if (map[key]) map[key].push(evt);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    );
    return map;
  }, [weekDates, eventsInWeek]);

  const goPrev = () => setWeekOffset((o) => o - 1);
  const goNext = () => setWeekOffset((o) => o + 1);

  const weekTitle =
    weekOffset === 0
      ? 'This week'
      : weekOffset === -1
        ? 'Last week'
        : weekOffset === 1
          ? 'Next week'
          : `${weekStartStr} – ${weekEndStr}`;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading events…</Text>
      </SafeAreaView>
    );
  }

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">
          Select a group to view the calendar.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-1" style={{ position: 'relative' }}>
      <View className="px-4 pt-4 pb-2 border-b border-slate-200">
        <View className="flex-row bg-slate-100 rounded-xl p-1 mx-4 mb-3">
          <TouchableOpacity
            onPress={() => {}}
            className="flex-1 py-1.5 rounded-lg items-center bg-slate-900"
          >
            <Text className="text-white font-medium text-sm">Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/calendar/agenda')}
            className="flex-1 py-1.5 rounded-lg items-center"
          >
            <Text className="text-slate-500 font-medium text-sm">Agenda</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={goPrev}
            className="w-10 h-10 items-center justify-center rounded-lg bg-slate-100"
          >
            <Text className="text-slate-700 text-lg font-medium">‹</Text>
          </TouchableOpacity>
          <Text className="text-slate-900 font-semibold text-base" numberOfLines={1}>
            {weekTitle}
          </Text>
          <TouchableOpacity
            onPress={goNext}
            className="w-10 h-10 items-center justify-center rounded-lg bg-slate-100"
          >
            <Text className="text-slate-700 text-lg font-medium">›</Text>
          </TouchableOpacity>
        </View>
        <View className="pb-2">
          <ImportanceLegend />
        </View>
      </View>

      {error ? (
        <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        horizontal
        showsHorizontalScrollIndicator={true}
      >
        {weekDates.map((day) => {
          const dateStr = toISODate(day);
          const dayEvents = eventsByDay[dateStr] ?? [];
          const dayNum = day.getDate();
          const isToday = toISODate(new Date()) === dateStr;

          return (
            <View
              key={dateStr}
              className="w-28 flex-shrink-0 pt-3 px-1 border-r border-slate-100"
            >
              <View className="items-center mb-2">
                <Text className="text-slate-400 text-xs font-medium">
                  {WEEKDAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                </Text>
                <View
                  className={`mt-1 w-8 h-8 rounded-full items-center justify-center ${
                    isToday ? 'bg-slate-900' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isToday ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </Text>
                </View>
              </View>
              {dayEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() =>
                    router.push(`/event/${event.id}`)
                  }
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        onPress={() => router.push('/event/create')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-slate-900 rounded-full items-center justify-center shadow-lg"
      >
        <Text className="text-white text-3xl font-light">+</Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function EventCard({
  event,
  onPress,
}: {
  event: EventWithMeta;
  onPress: () => void;
}) {
  const config = IMPORTANCE[event.importance as Importance];

  const handleLongPress = () => {
    const lines: string[] = [config?.label ?? event.importance];
    if (event.description) lines.push(event.description);
    if (event.location) lines.push(`📍 ${event.location}`);
    Alert.alert(event.title, lines.join('\n\n'));
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
      className="mb-2 p-2 rounded-lg border border-slate-200 bg-white"
    >
      <View className="flex-row items-center gap-1 mb-0.5">
        <ImportanceShape importance={event.importance as Importance} size={14} />
        <Text className="text-slate-500 text-xs flex-1" numberOfLines={1}>
          {formatTime(event.start_time)}
        </Text>
      </View>
      <Text className="text-slate-900 text-sm font-medium" numberOfLines={2}>
        {event.title}
      </Text>
    </TouchableOpacity>
  );
}
