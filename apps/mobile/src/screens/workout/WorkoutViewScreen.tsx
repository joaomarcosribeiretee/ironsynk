import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import type { PlannedSetRecord } from '../../lib/api'
import { ReadonlyExerciseCard } from '../../components/ReadonlyExerciseCard'

// ─── Main screen ──────────────────────────────────────────────────────────────

export function WorkoutViewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const route = useRoute<RouteProp<AppStackParamList, 'WorkoutView'>>()
  const { workoutId } = route.params

  const { data, isLoading } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => api.workouts.get(workoutId),
    staleTime: 30_000,
  })

  const workout = data?.data.workout
  const exercises = workout?.exercises ?? []

  const validSetsTotal = exercises.reduce((acc, te) => {
    return acc + te.sets.filter((s: PlannedSetRecord) => s.setType === 'WORKING').length
  }, 0)

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{workout?.name ?? ''}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('WorkoutDetail', { workoutId })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.editBtn}>Editar</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Description */}
          {workout?.notes ? (
            <>
              <Text style={s.description} numberOfLines={3}>{workout.notes}</Text>
              <View style={s.divider} />
            </>
          ) : null}

          {/* Start workout button */}
          <TouchableOpacity activeOpacity={0.85} style={s.startBtnWrap} onPress={() => navigation.navigate('WorkoutExecution', { workoutId })}>
            <LinearGradient
              colors={['#2979FF', '#1565C0']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.startBtn}
            >
              <Ionicons name="play-circle-outline" size={22} color="#fff" />
              <Text style={s.startBtnText}>Iniciar Treino</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Último treino</Text>
              <Text style={s.statValue}>—</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Séries válidas</Text>
              <Text style={s.statValue}>{validSetsTotal > 0 ? String(validSetsTotal) : '—'}</Text>
            </View>
          </View>

          {/* Exercises section */}
          {exercises.length > 0 && (
            <>
              <Text style={s.sectionLabel}>EXERCÍCIOS</Text>
              {exercises.map((te) => <ReadonlyExerciseCard key={te.id} te={te} />)}
            </>
          )}

          {exercises.length === 0 && (
            <View style={s.emptyWrap}>
              <Ionicons name="barbell-outline" size={48} color="#2A2A35" />
              <Text style={s.emptyTitle}>Nenhum exercício</Text>
              <Text style={s.emptySub}>Este treino ainda não tem exercícios</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 18, paddingTop: 4, paddingBottom: 10, gap: 8,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 20, fontWeight: '500' },
  editBtn: { color: '#4FC3F7', fontSize: 15, fontWeight: '500' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },

  description: {
    color: '#8A8A9A', fontSize: 14, fontStyle: 'italic', lineHeight: 20, paddingBottom: 14,
  },
  divider: { height: 1, backgroundColor: '#2A2A35', marginBottom: 16 },

  startBtnWrap: { marginBottom: 16 },
  startBtn: {
    height: 56, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14,
  },
  statLabel: { color: '#8A8A9A', fontSize: 11, marginBottom: 4 },
  statValue: { color: '#F0F0F5', fontSize: 20, fontWeight: '600' },

  sectionLabel: {
    color: '#8A8A9A', fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 10,
  },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },
})
