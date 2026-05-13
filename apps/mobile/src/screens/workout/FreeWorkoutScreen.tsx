import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'

export function FreeWorkoutScreen() {
  const navigation = useNavigation()
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.title}>Treino Livre</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.center}>
        <Text style={s.sub}>Em breve — Fase 2</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },
  back: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#F0F0F5', fontSize: 17, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sub: { color: '#8A8A9A', fontSize: 14 },
})
