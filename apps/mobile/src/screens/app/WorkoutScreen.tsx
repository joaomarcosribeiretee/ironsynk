import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'

export function WorkoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <Text style={s.title}>Treino</Text>
        <Text style={s.sub}>Em breve — Fase 2</Text>

        {/* DEBUG — remove before launch */}
        <TouchableOpacity style={s.debugBtn} onPress={() => navigation.navigate('ExerciseDebug')}>
          <Text style={s.debugBtnText}>Ver banco de exercícios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.debugBtn} onPress={() => navigation.navigate('ExerciseAdmin')}>
          <Text style={s.debugBtnText}>Admin exercícios</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  sub: { color: '#8A8A9A', fontSize: 14 },
  // DEBUG — remove before launch
  debugBtn: {
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#FF5252',
    backgroundColor: 'rgba(255,82,82,0.08)',
  },
  debugBtnText: { color: '#FF5252', fontSize: 13, fontWeight: '600' },
})
