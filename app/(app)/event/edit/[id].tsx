import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Stub for event edit screen (REQ-16). Edit form can be implemented in a follow-up.
 */
export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="px-4 pt-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-slate-500 text-base">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-slate-900 mt-4">
          Edit event
        </Text>
        <Text className="text-slate-500 text-sm mt-1">
          Event id: {id}. Edit form coming in a follow-up.
        </Text>
      </View>
    </SafeAreaView>
  );
}
