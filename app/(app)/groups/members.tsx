import { useState } from 'react';
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
import type { GroupMember, User } from '@/contracts/types';
import { useGroup } from '@/hooks/useGroup';
import { approveMember, rejectMember, GroupMustHaveAdminError } from '@/lib/groups';

type MemberWithUser = GroupMember & { user: User };

/**
 * VCH-14: Admin role management.
 * List members with role badge (admin / member).
 * Admin-only: promote, demote (last-admin warning), remove.
 */
export default function MembersScreen() {
  const router = useRouter();
  const {
    activeGroup,
    members,
    isAdmin,
    promoteMember,
    demoteMember,
    removeMember,
    refetchMembers,
    error,
  } = useGroup();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const displayError = bannerMessage ?? error;

  const handleDemote = async (member: MemberWithUser) => {
    if (!isAdmin) return;
    setBannerMessage(null);
    setActionLoading(member.user_id);
    try {
      await demoteMember(member.user_id);
    } catch (e) {
      if (e instanceof GroupMustHaveAdminError) {
        setBannerMessage(
          'This group must keep at least one admin. Promote another member to admin first.',
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = (member: MemberWithUser) => {
    if (!isAdmin) return;
    const name = member.user.display_name ?? 'This member';
    Alert.alert(
      'Remove member',
      `Remove ${name} from the group? They will lose access to all group events.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBannerMessage(null);
            setActionLoading(member.user_id);
            try {
              await removeMember(member.user_id);
              router.back();
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  if (!activeGroup) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-500 text-center">Select a group first.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-slate-700 font-medium">Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-6 pt-12 pb-8 max-w-md w-full self-center">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-slate-500 text-base">Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-semibold text-slate-900 mb-1">
            Members
          </Text>
          <Text className="text-slate-500 text-base mb-8">
            {activeGroup.name} — {isAdmin ? 'you are an admin' : 'member'}
          </Text>

          {displayError ? (
            <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
              <Text className="text-red-700 text-sm">{displayError}</Text>
            </View>
          ) : null}

          {isAdmin && pendingMembers.length > 0 ? (
            <>
              <Text className="text-slate-600 font-medium text-sm mb-2">
                Pending approval
              </Text>
              {pendingMembers.map((member) => (
                <PendingApprovalRow
                  key={member.id}
                  member={member}
                  groupId={activeGroup.id}
                  actionLoading={actionLoading}
                  setActionLoading={setActionLoading}
                  setBannerMessage={setBannerMessage}
                  onSuccess={refetchMembers}
                />
              ))}
            </>
          ) : null}

          <Text className="text-slate-600 font-medium text-sm mb-2 mt-4">Active</Text>
          {activeMembers.length === 0 ? (
            <Text className="text-slate-400 text-sm mb-4">No active members.</Text>
          ) : (
            activeMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isAdmin={isAdmin}
                actionLoading={actionLoading}
                onPromote={() => {
                  setBannerMessage(null);
                  setActionLoading(member.user_id);
                  promoteMember(member.user_id).finally(() => setActionLoading(null));
                }}
                onDemote={() => handleDemote(member)}
                onRemove={() => handleRemove(member)}
              />
            ))
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PendingApprovalRow({
  member,
  groupId,
  actionLoading,
  setActionLoading,
  setBannerMessage,
  onSuccess,
}: {
  member: MemberWithUser;
  groupId: string;
  actionLoading: string | null;
  setActionLoading: (id: string | null) => void;
  setBannerMessage: (msg: string | null) => void;
  onSuccess: () => Promise<void>;
}) {
  const loading = actionLoading === member.user_id;
  const displayName = member.user.display_name ?? member.user_id;

  const handleApprove = async () => {
    setBannerMessage(null);
    setActionLoading(member.user_id);
    try {
      await approveMember(groupId, member.user_id);
      await onSuccess();
    } catch (e) {
      setBannerMessage(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setBannerMessage(null);
    setActionLoading(member.user_id);
    try {
      await rejectMember(groupId, member.user_id);
      await onSuccess();
    } catch (e) {
      setBannerMessage(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-slate-100">
      <Text className="text-slate-700 flex-1 font-medium" numberOfLines={1}>
        {displayName}
      </Text>
      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          onPress={handleApprove}
          disabled={loading}
          className="px-3 py-1.5 bg-green-600 rounded-lg"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-sm font-medium">Approve</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleReject}
          disabled={loading}
          className="px-3 py-1.5 border border-red-500 rounded-lg"
        >
          <Text className="text-red-600 text-sm font-medium">Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MemberRow({
  member,
  isAdmin,
  actionLoading,
  onPromote,
  onDemote,
  onRemove,
}: {
  member: MemberWithUser;
  isAdmin: boolean;
  actionLoading: string | null;
  onPromote: () => void;
  onDemote: () => void;
  onRemove: () => void;
}) {
  const loading = actionLoading === member.user_id;
  const displayName = member.user.display_name ?? 'Unknown';

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-slate-100">
      <View className="flex-1">
        <Text className="text-slate-900 font-medium" numberOfLines={1}>
          {displayName}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          <View
            className={`px-2 py-0.5 rounded ${
              member.role === 'admin' ? 'bg-slate-900' : 'bg-slate-200'
            }`}
          >
            <Text
              className={`text-xs ${member.role === 'admin' ? 'text-white' : 'text-slate-600'}`}
            >
              {member.role === 'admin' ? 'Admin' : 'Member'}
            </Text>
          </View>
        </View>
      </View>
      {isAdmin && (
        <View className="flex-row items-center gap-2">
          {member.role === 'member' ? (
            <TouchableOpacity
              onPress={onPromote}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 rounded-lg"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#475569" />
              ) : (
                <Text className="text-slate-700 text-sm">Promote</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onDemote}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 rounded-lg"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#475569" />
              ) : (
                <Text className="text-slate-700 text-sm">Demote</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onRemove}
            disabled={loading}
            className="px-3 py-1.5 bg-red-50 rounded-lg"
          >
            <Text className="text-red-600 text-sm">Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
