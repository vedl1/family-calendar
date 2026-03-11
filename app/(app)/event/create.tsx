import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Importance } from '@/contracts/types';
import { IMPORTANCE } from '@/contracts/types';
import { useGroup } from '@/hooks/useGroup';
import { useEvents } from '@/hooks/useEvents';

const IMPORTANCE_KEYS: Importance[] = ['fyi', 'recommend', 'important', 'critical'];
const MAX_DESCRIPTION_LENGTH = 120;

/**
 * VCH-23 / REQ-14: Create event form.
 * Fields: title (required), description (required, max 120), importance,
 * date, start time, duration mins, location (optional).
 * On submit: createEvent() from useEvents; navigate back on success.
 */
export default function CreateEventScreen() {
  const router = useRouter();
  const { activeGroup } = useGroup();
  const groupId = activeGroup?.id ?? null;
  const { createEvent, error } = useEvents(groupId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState<Importance>('fyi');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMins, setDurationMins] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const titleTrimmed = title.trim();
  const descriptionTrimmed = description.trim();
  const descValid =
    descriptionTrimmed.length > 0 && descriptionTrimmed.length <= MAX_DESCRIPTION_LENGTH;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
  const timeValid = /^([01]?\d|2[0-3]):[0-5]\d$/.test(startTime.trim());
  const durationNum = parseInt(durationMins.trim(), 10);
  const durationValid = !isNaN(durationNum) && durationNum > 0;
  const canSubmit =
    !!groupId &&
    titleTrimmed.length > 0 &&
    descValid &&
    dateValid &&
    timeValid &&
    durationValid &&
    !submitting;

  const buildStartEnd = (): { start_at: string; end_at: string } => {
    const start = new Date(`${date.trim()}T${startTime.trim()}:00`);
    const end = new Date(start.getTime() + durationNum * 60_000);
    return { start_at: start.toISOString(), end_at: end.toISOString() };
  };

  const handleSubmit = async () => {
    if (!canSubmit || !groupId) return;
    setSubmitting(true);
    try {
      const { start_at, end_at } = buildStartEnd();
      await createEvent({
        group_id: groupId,
        title: titleTrimmed,
        description: descriptionTrimmed,
        importance,
        start_at,
        end_at,
        ...(location.trim() && { location: location.trim() }),
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Select a group to create an event.</Text>
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
            <Text className="text-2xl font-semibold text-slate-900 mb-1">Create event</Text>
            <Text className="text-slate-500 text-base mb-6">
              Add event details. Title and description are required.
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
                <Text className="text-white font-medium text-base">Create event</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
