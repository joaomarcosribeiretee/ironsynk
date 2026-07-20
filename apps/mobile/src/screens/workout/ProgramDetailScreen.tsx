import React, { useCallback, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  LayoutAnimation,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import type { TrainingGoal, WorkoutRecord } from '../../lib/api'
import { ReadonlyExerciseCard } from '../../components/ReadonlyExerciseCard'

const GOAL_LABELS: Record<TrainingGoal, string> = {
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Força',
  FAT_LOSS: 'Emagrecimento',
  ENDURANCE: 'Resistência',
  HEALTH: 'Saúde',
  PERFORMANCE: 'Performance',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

// ─── Collapsible workout (read-only) ────────────────────────────────────────────

function CollapsibleWorkout({ workout }: { workout: WorkoutRecord }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['workout', workout.id],
    queryFn: () => api.workouts.get(workout.id),
    enabled: open,
    staleTime: 30_000,
  })

  const detail = data?.data.workout
  const exercises = detail?.exercises ?? []

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(v => !v)
  }

  return (
    <View style={s.workoutCard}>
      <TouchableOpacity style={s.workoutHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={s.workoutHeaderLeft}>
          <Ionicons
            name={open ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color="#4FC3F7"
            style={{ flexShrink: 0 }}
          />
          <View style={s.workoutTitleBlock}>
            <Text style={s.workoutName} numberOfLines={1}>{workout.name}</Text>
            <Text style={s.workoutMeta}>
              {workout.exercisesCount} {workout.exercisesCount === 1 ? 'exercício' : 'exercícios'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={s.workoutBody}>
          {isLoading ? (
            <View style={s.workoutLoading}>
              <ActivityIndicator size="small" color="#4FC3F7" />
            </View>
          ) : (
            <>
              {!!detail?.notes && (
                <Text style={s.workoutNotes}>{detail.notes}</Text>
              )}
              {exercises.length > 0 ? (
                exercises.map((te) => <ReadonlyExerciseCard key={te.id} te={te} />)
              ) : (
                <Text style={s.workoutEmpty}>Nenhum exercício neste treino</Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  )
}

// ─── Main screen ────────────────────────────────────────────────────────────────

export function ProgramDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const route = useRoute<RouteProp<AppStackParamList, 'ProgramDetail'>>()
  const { programId, programName, goals, workoutsCount, updatedAt } = route.params

  // Shares the ['workouts', programId] key with the edit flow so program changes
  // invalidate this view too.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workouts', programId],
    queryFn: () => api.programs.workouts(programId),
    staleTime: 30_000,
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  const workouts = data?.data.workouts ?? []

  return (
    <SafeAreaView style={s.safe}>
      {/* Header — back only, strictly read-only */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{programName}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Program metadata */}
        <View style={s.metaCard}>
          <Text style={s.metaName}>{programName}</Text>
          {goals.length > 0 && (
            <View style={s.pillsRow}>
              {goals.map((g) => (
                <View key={g} style={s.pill}>
                  <Text style={s.pillText}>{GOAL_LABELS[g] ?? g}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={s.metaStatsRow}>
            <View style={s.metaStat}>
              <Ionicons name="barbell-outline" size={14} color="#8A8A9A" />
              <Text style={s.metaStatText}>
                {workoutsCount} {workoutsCount === 1 ? 'treino' : 'treinos'}
              </Text>
            </View>
            <View style={s.metaStat}>
              <Ionicons name="time-outline" size={14} color="#8A8A9A" />
              <Text style={s.metaStatText}>Atualizado em {formatDate(updatedAt)}</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionLabel}>TREINOS</Text>

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color="#4FC3F7" />
          </View>
        ) : workouts.length > 0 ? (
          workouts.map((w) => <CollapsibleWorkout key={w.id} workout={w} />)
        ) : (
          <View style={s.emptyWrap}>
            <Ionicons name="barbell-outline" size={44} color="#2A2A35" />
            <Text style={s.emptyTitle}>Nenhum treino</Text>
            <Text style={s.emptySub}>Este programa ainda não tem treinos</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 10, gap: 8,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 20, fontWeight: '500' },

  center: { paddingVertical: 36, alignItems: 'center' },

  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },

  // Metadata
  metaCard: {
    backgroundColor: '#1E1E24', borderRadius: 16,
    borderWidth: 1, borderColor: '#2A2A35',
    padding: 16, marginBottom: 8,
  },
  metaName: { color: '#F0F0F5', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pill: {
    backgroundColor: 'rgba(41,121,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.2)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
  },
  pillText: { color: 'rgba(79,195,247,0.85)', fontSize: 11 },
  metaStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metaStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaStatText: { color: '#8A8A9A', fontSize: 12 },

  sectionLabel: {
    color: '#8A8A9A', fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 10,
  },

  // Workout card
  workoutCard: {
    backgroundColor: '#1A1A22', borderRadius: 14,
    borderWidth: 1, borderColor: '#252530',
    marginBottom: 10, overflow: 'hidden',
  },
  workoutHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  workoutHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  workoutTitleBlock: { flex: 1, minWidth: 0 },
  workoutName: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  workoutMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 3 },

  workoutBody: {
    paddingHorizontal: 12, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: '#252530',
    paddingTop: 12,
  },
  workoutLoading: { paddingVertical: 20, alignItems: 'center' },
  workoutNotes: {
    color: '#8A8A9A', fontSize: 13, fontStyle: 'italic', lineHeight: 19,
    marginBottom: 12,
  },
  workoutEmpty: { color: '#8A8A9A', fontSize: 13, paddingVertical: 8, textAlign: 'center' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },
})
