import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function StudentsScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <Text style={s.title}>Alunos</Text>
        <Text style={s.sub}>Em breve — Fase 4</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#F0F0F5', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sub: { color: '#8A8A9A', fontSize: 14 },
})
