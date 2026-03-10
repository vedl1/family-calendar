import { View, Text } from 'react-native';
import type { Importance } from '@/contracts/types';
import { IMPORTANCE } from '@/contracts/types';
import { ImportanceShape } from '@/components/ImportanceShape';

const IMPORTANCE_KEYS: Importance[] = ['fyi', 'recommend', 'important', 'critical'];

/**
 * VCH-18: Horizontal legend of all four importance levels (shape + label).
 */
export function ImportanceLegend() {
  return (
    <View className="flex-row gap-4 items-center">
      {IMPORTANCE_KEYS.map((key) => (
        <View key={key} className="flex-row items-center gap-1">
          <ImportanceShape importance={key} size={12} />
          <Text className="text-xs text-slate-500">{IMPORTANCE[key].label}</Text>
        </View>
      ))}
    </View>
  );
}
