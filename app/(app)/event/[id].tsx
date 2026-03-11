import { Fragment, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EventWithMeta, Importance } from '@/contracts/types';
import { IMPORTANCE } from '@/contracts/types';
import { useAuth } from '@/hooks/useAuth';
import { useGroup } from '@/hooks/useGroup';
import { useEvents } from '@/hooks/useEvents';

function formatTime(startTime: string | null): string {
  if (!startTime) return 'All day';
  const [h, m] = startTime.split(':').map(Number);
  if (h === 0 && m === 0) return '12:00 am';
  if (h === 12) return `12:${String(m).padStart(2, '0')} pm`;
  if (h > 12) return `${h - 12}:${String(m).padStart(2, '0')} pm`;
  return `${h}:${String(m).padStart(2, '0')} am`;
}

function formatDuration(mins: number | null): string {
  if (mins == null || mins <= 0) return '';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * VCH-24 / REQ-19, REQ-16: Event detail screen.
 * Shows title, description, importance, date/time/duration, location, creator.
 * Guest list (attending / declined). RSVP buttons; disabled if event has passed.
 * Edit/delete only if user is creator or group admin.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroup, isAdmin } = useGroup();
  const groupId = activeGroup?.id ?? null;
  const { getEvent, upsertRSVP, deleteEvent, error } = useEvents(groupId);

  const [event, setEvent] = useState<EventWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const hasPassed = event ? event.event_date < today : false;
  const canEdit =
    !!event &&
    !!user &&
    (user.id === event.created_by || isAdmin);
  const myRsvp = event && user ? event.rsvps.find((r) => r.user_id === user.id) : null;

  useEffect(() => {
    if (!id || !groupId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getEvent(id)
      .then((e) => {
        if (!cancelled) setEvent(e);
      })
      .catch(() => {
        if (!cancelled) setEvent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, groupId, getEvent]);

  const handleRSVP = async (status: 'attending' | 'declined') => {
    if (!id || hasPassed || rsvping) return;
    setRsvping(true);
    try {
      await upsertRSVP(id, status);
      const updated = await getEvent(id);
      setEvent(updated ?? null);
    } finally {
      setRsvping(false);
    }
  };

  const handleDelete = () => {
    if (!event || !canEdit) return;
    Alert.alert(
      'Delete event',
      `Delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(event.id);
              router.back();
            } catch {
              // error shown by hook
            }
          },
        },
      ]
    );
  };

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Select a group to view this event.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500">Loading event…</Text>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Event not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-slate-700 font-medium">Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const config = IMPORTANCE[event.importance as Importance];
  const timeStr = formatTime(event.start_time);
  const durationStr = formatDuration(event.duration_mins);
  const timeAndDuration = durationStr ? `${timeStr} · ${durationStr}` : timeStr;
  const attending = event.rsvps.filter((r) => r.status === 'attending');
  const declined = event.rsvps.filter((r) => r.status === 'declined');

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView className="flex-1" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 pt-4 pb-2 border-b border-slate-200">
          <TouchableOpacity onPress={() => router.back()} className="mb-2">
            <Text className="text-slate-500 text-base">Back</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <View className="px-4 pt-4">
          <Text className="text-2xl font-semibold text-slate-900">{event.title}</Text>
          <View
            className="mt-2 px-3 py-1 rounded-full self-start"
            style={{ backgroundColor: config ? `${config.colour}20` : '#f1f5f9' }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: config?.colour ?? '#64748b' }}
            >
              {config?.label ?? event.importance}
            </Text>
          </View>

          {event.description ? (
            <Text className="text-slate-600 mt-3 text-base">{event.description}</Text>
          ) : null}

          <Text className="text-slate-500 text-sm mt-4">{formatDate(event.event_date)}</Text>
          <Text className="text-slate-700 text-base mt-1">{timeAndDuration}</Text>
          <Text className="text-slate-500 text-sm mt-2">
            {event.location ?? 'No location set'}
          </Text>
          <Text className="text-slate-400 text-sm mt-2">
            Created by {event.creator?.display_name ?? 'Unknown'}
          </Text>

          {hasPassed ? (
            <View className="mt-4 py-2">
              <Text className="text-slate-500 text-sm">This event has passed</Text>
            </View>
          ) : (
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => handleRSVP('attending')}
                disabled={rsvping}
                className="flex-1 py-3 rounded-xl items-center border border-slate-200"
                style={{
                  backgroundColor: myRsvp?.status === 'attending' ? '#22c55e' : 'transparent',
                }}
              >
                <Text
                  className="font-medium"
                  style={{ color: myRsvp?.status === 'attending' ? '#fff' : '#475569' }}
                >
                  Attending
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRSVP('declined')}
                disabled={rsvping}
                className="flex-1 py-3 rounded-xl items-center border border-slate-200"
                style={{
                  backgroundColor: myRsvp?.status === 'declined' ? '#ef4444' : 'transparent',
                }}
              >
                <Text
                  className="font-medium"
                  style={{ color: myRsvp?.status === 'declined' ? '#fff' : '#475569' }}
                >
                  Declining
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="mt-6">
            <Text className="text-slate-600 font-medium text-sm mb-2">Attending</Text>
            {attending.length === 0 ? (
              <Text className="text-slate-400 text-sm">No one yet</Text>
            ) : (
              <Fragment>
                {attending.map((r) => (
                  <Text key={r.id} className="text-slate-700 text-sm py-0.5">
                    {r.user?.display_name ?? 'Unknown'}
                  </Text>
                ))}
              </Fragment>
            )}
          </View>
          <View className="mt-3">
            <Text className="text-slate-600 font-medium text-sm mb-2">Declined</Text>
            {declined.length === 0 ? (
              <Text className="text-slate-400 text-sm">No one</Text>
            ) : (
              <Fragment>
                {declined.map((r) => (
                  <Text key={r.id} className="text-slate-700 text-sm py-0.5">
                    {r.user?.display_name ?? 'Unknown'}
                  </Text>
                ))}
              </Fragment>
            )}
          </View>

          {canEdit ? (
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => router.push(`/event/edit/${event.id}`)}
                className="flex-1 py-3 rounded-xl items-center bg-slate-200"
              >
                <Text className="font-medium text-slate-700">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                className="flex-1 py-3 rounded-xl items-center bg-red-100"
              >
                <Text className="font-medium text-red-700">Delete</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
