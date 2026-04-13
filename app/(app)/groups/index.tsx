import { useState } from 'react';
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
  const {
    groups,
    pendingInvites,
    isLoading,
    error,
    activeGroup,
    isAdmin,
    acceptInvite,
    declineInvite,
  } = useGroup();
  const [inviteActionGroupId, setInviteActionGroupId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" style={{ flex: 1 }}>
        <ActivityIndicator size="large" className="text-slate-600" />
        <Text className="mt-3 text-slate-500 text-base">Loading groups…</Text>
      </SafeAreaView>
    );
  }

  if (groups.length === 0 && pendingInvites.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white" style={{ flex: 1 }} edges={['top', 'bottom']}>
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
        {pendingInvites.length > 0 ? (
          <View className="mb-6">
            <Text className="text-slate-700 font-semibold text-sm mb-2">
              Pending invites
            </Text>
            {pendingInvites.map((group) => (
              <View
                key={group.id}
                className="border border-slate-200 rounded-xl px-4 py-3 mb-3"
              >
                <Text className="text-slate-900 font-medium">{group.name}</Text>
                {group.description ? (
                  <Text className="text-slate-500 text-sm mt-1">{group.description}</Text>
                ) : null}
                <View className="flex-row gap-3 mt-3">
                  <TouchableOpacity
                    onPress={async () => {
                      setInviteActionGroupId(group.id);
                      try {
                        await acceptInvite(group.id);
                      } finally {
                        setInviteActionGroupId(null);
                      }
                    }}
                    disabled={inviteActionGroupId === group.id}
                    className="flex-1 h-10 bg-slate-900 rounded-lg items-center justify-center"
                  >
                    {inviteActionGroupId === group.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white font-medium text-sm">Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      setInviteActionGroupId(group.id);
                      try {
                        await declineInvite(group.id);
                      } finally {
                        setInviteActionGroupId(null);
                      }
                    }}
                    disabled={inviteActionGroupId === group.id}
                    className="flex-1 h-10 border border-slate-300 rounded-lg items-center justify-center"
                  >
                    <Text className="text-slate-700 font-medium text-sm">Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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
        {activeGroup ? (
          <TouchableOpacity
            onPress={() => router.push('/groups/invite')}
            className="h-12 border border-slate-300 rounded-xl items-center justify-center mb-3"
          >
            <Text className="text-slate-700 font-medium text-base">
              Invite member
            </Text>
          </TouchableOpacity>
        ) : null}
        {activeGroup ? (
          <TouchableOpacity
            onPress={() => router.push('/groups/members')}
            className="h-12 border border-slate-300 rounded-xl items-center justify-center mb-3"
          >
            <Text className="text-slate-700 font-medium text-base">
              Manage members
            </Text>
          </TouchableOpacity>
        ) : null}
        {activeGroup && isAdmin ? (
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
