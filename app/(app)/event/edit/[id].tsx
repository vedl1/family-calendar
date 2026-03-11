import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Importance } from '@/contracts/types';
import { IMPORTANCE } from '@/contracts/types';
import { useAuth } from '@/hooks/useAuth';
import { useGroup } from '@/hooks/useGroup';
import { useEvents } from '@/hooks/useEvents';

const IMPORTANCE_KEYS: Importance[] = ['fyi', 'recommend', 'important', 'critical'];
const MAX_DESCRIPTION_LENGTH = 120;

/**
 * VCH-27: Edit event form. Same fields as create; pre-filled from getEvent(id).
 * updateEvent(id, params) with DB columns; guard: canEdit (creator or admin).
 */
export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroup, isAdmin } = useGroup();
  const groupId = activeGroup?.id ?? null;
  const { getEvent, updateEvent, error } = useEvents(groupId);

  const [event, setEvent] = useState<Awaited<ReturnType<typeof getEvent>>>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState<Importance>('fyi');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMins, setDurationMins] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit =
    !!event &&
    !!user &&
    (user.id === event.created_by || isAdmin);

  useEffect(() => {
    if (!id || !groupId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getEvent(id)
      .then((e) => {
        if (!cancelled && e) {
          setEvent(e);
          setTitle(e.title);
          setDescription(e.description ?? '');
          setImportance(e.importance);
          setDate(e.event_date);
          setStartTime(e.start_time ? e.start_time.slice(0, 5) : '');
          setDurationMins(e.duration_mins != null ? String(e.duration_mins) : '');
          setLocation(e.location ?? '');
        } else if (!cancelled) {
          setEvent(null);
        }
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

  const titleTrimmed = title.trim();
  const descriptionTrimmed = description.trim();
  const descValid =
    descriptionTrimmed.length > 0 && descriptionTrimmed.length <= MAX_DESCRIPTION_LENGTH;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
  const timeValid = /^([01]?\d|2[0-3]):[0-5]\d$/.test(startTime.trim());
  const durationNum = parseInt(durationMins.trim(), 10);
  const durationValid = !isNaN(durationNum) && durationNum > 0;
  const canSubmit =
    !!id &&
    !!event &&
    canEdit &&
    titleTrimmed.length > 0 &&
    descValid &&
    dateValid &&
    timeValid &&
    durationValid &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !id) return;
    setSubmitting(true);
    try {
      await updateEvent(id, {
        title: titleTrimmed,
        description: descriptionTrimmed,
        importance,
        event_date: date.trim(),
        start_time: `${startTime.trim()}:00`,
        duration_mins: durationNum,
        location: location.trim() || null,
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Select a group to edit events.</Text>
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

  if (!canEdit) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center mb-4">
          You don&apos;t have permission to edit this event.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-slate-700 font-medium">Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
          style={{ flex: 1 }}
        >
          <View className="px-6 pt-6 pb-8 max-w-md w-full self-center">
            <TouchableOpacity onPress={() => router.back()} className="mb-6">
              <Text className="text-slate-500 text-base">Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-semibold text-slate-900 mb-1">Edit event</Text>
            <Text className="text-slate-500 text-base mb-6">
              Update event details. Title and description are required.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <Text className="text-slate-600 text-sm mb-2">Title (required)</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              placeholderTextColor="#94a3b8"
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
            />

            <Text className="text-slate-600 text-sm mb-2">
              Description (required, max {MAX_DESCRIPTION_LENGTH} chars)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Short description"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={MAX_DESCRIPTION_LENGTH + 1}
              editable={!submitting}
              className="min-h-12 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base mb-1"
            />
            <Text className="text-slate-400 text-xs mb-4">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>

            <Text className="text-slate-600 text-sm mb-2">Importance</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {IMPORTANCE_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setImportance(key)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-slate-200"
                  style={{
                    backgroundColor: importance === key ? IMPORTANCE[key].colour : 'transparent',
                    borderColor: importance === key ? IMPORTANCE[key].colour : '#e2e8f0',
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: importance === key ? '#fff' : '#475569' }}
                  >
                    {IMPORTANCE[key].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-slate-600 text-sm mb-2">Date (YYYY-MM-DD)</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2026-03-15"
              placeholderTextColor="#94a3b8"
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
            />

            <Text className="text-slate-600 text-sm mb-2">Start time (HH:MM)</Text>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="14:30"
              placeholderTextColor="#94a3b8"
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
            />

            <Text className="text-slate-600 text-sm mb-2">Duration (minutes)</Text>
            <TextInput
              value={durationMins}
              onChangeText={setDurationMins}
              placeholder="60"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-4"
            />

            <Text className="text-slate-600 text-sm mb-2">Location (optional)</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Home"
              placeholderTextColor="#94a3b8"
              editable={!submitting}
              className="h-12 border border-slate-200 rounded-xl px-4 text-slate-900 text-base mb-6"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className="h-12 bg-slate-900 rounded-xl items-center justify-center flex-row active:opacity-80 disabled:opacity-50"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium text-base">Save changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
