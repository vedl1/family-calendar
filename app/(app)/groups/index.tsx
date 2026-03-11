import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/hooks/useGroup';
import GroupSelector from '@/components/GroupSelector';
import EmptyStateScreen from './empty';

/**
 * Groups home: empty state (VCH-11) or list with create/invite/members and selector (VCH-15).
 */
export default function GroupsIndexScreen() {
  const router = useRouter();
  const { groups, isLoading, error, activeGroup, isAdmin } = useGroup();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading groups…</Text>
      </SafeAreaView>
    );
  }

  if (groups.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <EmptyStateScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View className="px-4 pt-4 pb-2 border-b border-slate-200">
        <GroupSelector />
      </View>
      <View className="flex-1 px-6 pt-8">
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}
        <Text className="text-slate-500 text-sm mb-4">
          {activeGroup?.name ?? 'Select a group'}
        </Text>
        {activeGroup ? (
          <TouchableOpacity
            onPress={() => router.push('/calendar/week')}
            className="h-12 bg-slate-900 rounded-xl items-center justify-center mb-3"
          >
            <Text className="text-white font-medium text-base">
              View calendar
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => router.push('/groups/create')}
          className="h-12 border border-slate-300 rounded-xl items-center justify-center mb-3"
        >
          <Text className="text-slate-700 font-medium text-base">
            Create another group
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/groups/invite')}
          className="h-12 border border-slate-300 rounded-xl items-center justify-center mb-3"
        >
          <Text className="text-slate-700 font-medium text-base">
            Invite member
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/groups/members')}
          className="h-12 border border-slate-300 rounded-xl items-center justify-center mb-3"
        >
          <Text className="text-slate-700 font-medium text-base">
            Manage members
          </Text>
        </TouchableOpacity>
        {isAdmin ? (
          <TouchableOpacity
            onPress={() => router.push('/groups/share-links')}
            className="h-12 border border-slate-300 rounded-xl items-center justify-center"
          >
            <Text className="text-slate-700 font-medium text-base">
              Share links
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
