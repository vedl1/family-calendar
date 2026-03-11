import { View, Text } from 'react-native';

export default function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, color: '#64748b' }}>Page not found</Text>
    </View>
  );
}
