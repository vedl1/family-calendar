import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * VCH-11: Empty state when user has no groups.
 * CTA navigates to create group screen.
 */
export default function EmptyStateScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 px-6 justify-center max-w-md w-full self-center">
      <Text className="text-2xl font-semibold text-slate-900 mb-1">
        No groups yet
      </Text>
      <Text className="text-slate-500 text-base mb-8">
        Create your first family group to start sharing events.
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/groups/create')}
        className="h-12 bg-slate-900 rounded-xl items-center justify-center active:opacity-80"
      >
        <Text className="text-white font-medium text-base">
          Create your first group
        </Text>
      </TouchableOpacity>
    </View>
  );
}
