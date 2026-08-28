import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'

type Nav = NativeStackNavigationProp<AppStackParamList>
type ScreenRoute = RouteProp<AppStackParamList, 'NutritionLog'>

// Placeholder: the route exists so free logging has a destination to navigate
// to, and the day it should show is already part of the route params. The API
// behind it (api.nutrition.log.*) is live — only this screen is pending.
export function NutritionLogScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<ScreenRoute>()
  const date = route.params?.date

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Registro Livre</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.wrap}>
        <View style={s.iconWrap}>
          <Ionicons name="create-outline" size={28} color="#4FC3F7" />
        </View>
        <Text style={s.title}>Em construção</Text>
        <Text style={s.sub}>
          Registre o que comeu no dia, sem precisar de um plano ativo.
        </Text>
        {date && <Text style={s.date}>{date}</Text>}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
  },
  headerTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '500' },

  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(79,195,247,0.08)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  title: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  sub: { color: '#8A8A9A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  date: { color: '#4A4A5A', fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
})
