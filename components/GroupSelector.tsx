import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { Group } from '@/contracts/types';
import { useGroup } from '@/hooks/useGroup';

/**
 * VCH-15: Group selector toggle — lists all groups, highlights activeGroup.
 * Tapping a group calls setActiveGroup(group).
 * Use in calendar header or persistent top bar.
 */
export default function GroupSelector() {
  const { groups, activeGroup, setActiveGroup } = useGroup();

  if (groups.length === 0) return null;
  if (groups.length === 1) {
    return (
      <View className="py-2">
        <Text className="text-slate-900 font-medium text-base" numberOfLines={1}>
          {groups[0]!.name}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      className="py-2 -mx-1"
    >
      {groups.map((group: Group) => {
        const isActive = activeGroup?.id === group.id;
        return (
          <TouchableOpacity
            key={group.id}
            onPress={() => setActiveGroup(group)}
            className={`px-4 py-2 rounded-lg ${
              isActive ? 'bg-slate-900' : 'bg-slate-100'
            }`}
          >
            <Text
              className={`font-medium text-sm ${
                isActive ? 'text-white' : 'text-slate-700'
              }`}
              numberOfLines={1}
            >
              {group.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
