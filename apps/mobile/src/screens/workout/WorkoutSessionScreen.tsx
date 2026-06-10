import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ExecutionExerciseRecord, ExecutionSetLogRecord, PlannedSetTechnique } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { SetBadge, getTechStyle } from '../../components/SetBadge'

type NavProp = NativeStackNavigationProp<AppStackParamList>
type RouteProps = RouteProp<AppStackParamList, 'WorkoutSession'>

const TECHNIQUE_LABELS: Record<string, string> = {
  DROP_SET: 'Drop Set',
  BACK_OFF: 'Back-off',
  REST_PAUSE: 'Rest-Pause',
  CLUSTER_SET: 'Cluster Set',
  MUSCLE_ROUND: 'Muscle Round',
  MYOREP: 'MyoRep',
}

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: 'Peito', BACK: 'Costas', SHOULDERS: 'Ombros',
  BICEPS: 'Bíceps', TRICEPS: 'Tríceps', FOREARMS: 'Antebraço',
  QUADS: 'Quadríceps', HAMSTRINGS: 'Posterior', GLUTES: 'Glúteos',
  CALVES: 'Panturrilha', ABS: 'Abdômen', FULL_BODY: 'Full Body', OTHER: 'Outro',
}

function formatDuration(min: number | null) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${min}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatVolume(v: number | null) {
  if (v == null || v <= 0) return '—'
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('pt-BR', { month: 'long' })
  const year = d.getFullYear()
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} de ${year} · ${time}`
}

function formatWeight(kg: number | null) {
  if (kg == null || kg <= 0) return '—'
  return `${kg % 1 === 0 ? kg : kg.toFixed(1)} kg`
}

function getTechBlockSummary(technique: PlannedSetTechnique, cfg: Record<string, unknown> | null): string | null {
  if (!cfg) return null
  const blockReps = cfg['blockReps'] as string[] | undefined
  const blockWeights = cfg['blockWeights'] as string[] | undefined

  switch (technique) {
    case 'DROP_SET': {
      if (blockWeights?.length && blockReps?.length) {
        return blockWeights.map((w, i) => `${w}kg × ${blockReps[i] ?? '?'}`).join(' → ')
      }
      return null
    }
    case 'REST_PAUSE':
    case 'CLUSTER_SET':
    case 'MUSCLE_ROUND': {
      if (blockReps?.length) return blockReps.map(r => `${r}x`).join(' · ')
      return null
    }
    case 'MYOREP': {
      if (blockReps?.length) {
        const [act, ...mini] = blockReps
        return mini.length > 0
          ? `Ativ: ${act}x · ${mini.map(r => `${r}x`).join(' · ')}`
          : `Ativ: ${act}x`
      }
      return null
    }
    default: return null
  }
}

function SetDetailRow({ set, index }: { set: ExecutionSetLogRecord; index: number }) {
  const blockSummary = set.technique !== 'NONE'
    ? getTechBlockSummary(set.technique, set.techniqueConfig as Record<string, unknown> | null)
    : null

  return (
    <View style={ss.setRow}>
      <SetBadge setType={set.setType} technique={set.technique} index={index} />
      <View style={ss.setInfo}>
        <View style={ss.setMainRow}>
          <Text style={ss.setReps}>{set.repsCompleted ?? 0} reps</Text>
          <Text style={ss.setWeight}>{formatWeight(set.weightKg)}</Text>
          {set.isPersonalRecord && (
            <View style={ss.prPill}>
              <Ionicons name="trophy" size={9} color="#00E676" />
              <Text style={ss.prText}>PR</Text>
            </View>
          )}
        </View>
        {blockSummary && (
          <Text style={ss.blockSummary}>{blockSummary}</Text>
        )}
      </View>
    </View>
  )
}

function ExerciseSection({ exercise }: { exercise: ExecutionExerciseRecord }) {
  const checkedSets = exercise.sets.filter(s => s.isChecked)
  if (checkedSets.length === 0) return null

  const muscleLabel = MUSCLE_LABELS[exercise.exercise.muscleGroup] ?? exercise.exercise.muscleGroup

  return (
    <View style={ss.exerciseSection}>
      <View style={ss.exerciseHeader}>
        <Text style={ss.exerciseName}>{exercise.exercise.name}</Text>
        <Text style={ss.exerciseMuscle}>{muscleLabel}</Text>
      </View>
      {!!exercise.exerciseNotes && (
        <View style={ss.exerciseNotesRow}>
          <Ionicons name="chatbubble-outline" size={11} color="#555560" />
          <Text style={ss.exerciseNotes}>{exercise.exerciseNotes}</Text>
        </View>
      )}
      <View style={ss.setsContainer}>
        {checkedSets.map((set, i) => (
          <SetDetailRow key={set.id} set={set} index={i} />
        ))}
      </View>
    </View>
  )
}

export function WorkoutSessionScreen() {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<RouteProps>()
  const { sessionId } = route.params

  const { data, isLoading, error } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.sessions.get(sessionId),
  })

  const session = data?.data.session

  const totalPRs = session
    ? session.exercises.flatMap(e => e.sets).filter(s => s.isPersonalRecord && s.isChecked).length
    : 0

  const techniques = session
    ? [...new Set(
        session.exercises
          .flatMap(e => e.sets)
          .filter(s => s.isChecked && s.technique !== 'NONE')
          .map(s => s.technique),
      )]
    : []

  const completedExercises = session
    ? session.exercises.filter(e => e.sets.some(s => s.isChecked))
    : []

  return (
    <SafeAreaView style={ss.safe}>
      {/* Header */}
      <View style={ss.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={ss.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#8A8A9A" />
        </TouchableOpacity>
        <Text style={ss.headerTitle} numberOfLines={1}>
          {isLoading ? 'Carregando...' : (session?.workoutName ?? 'Treino')}
        </Text>
      </View>

      {isLoading ? (
        <View style={ss.centered}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : error || !session ? (
        <View style={ss.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#FF5252" />
          <Text style={ss.errorText}>Não foi possível carregar os detalhes</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={ss.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Date */}
          <Text style={ss.date}>{formatDateTime(session.startedAt)}</Text>

          {/* Stats */}
          <View style={ss.statsRow}>
            <View style={ss.stat}>
              <Text style={ss.statValue}>{formatDuration(session.durationMin)}</Text>
              <Text style={ss.statLabel}>duração</Text>
            </View>
            <View style={ss.statDivider} />
            <View style={ss.stat}>
              <Text style={ss.statValue}>{session.totalValidSets ?? 0}</Text>
              <Text style={ss.statLabel}>séries</Text>
            </View>
            <View style={ss.statDivider} />
            <View style={ss.stat}>
              <Text style={ss.statValue}>{formatVolume(session.totalVolume)}</Text>
              <Text style={ss.statLabel}>kg total</Text>
            </View>
          </View>

          {/* PR highlight */}
          {totalPRs > 0 && (
            <View style={ss.prHighlight}>
              <Ionicons name="trophy" size={14} color="#00E676" />
              <Text style={ss.prHighlightText}>
                {totalPRs} {totalPRs === 1 ? 'record pessoal' : 'records pessoais'} nessa sessão
              </Text>
            </View>
          )}

          {/* Techniques */}
          {techniques.length > 0 && (
            <View style={ss.techRow}>
              {techniques.map(t => {
                const ts = getTechStyle('WORKING', t)
                return (
                  <View key={t} style={[ss.techPill, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}>
                    <Text style={[ss.techPillText, { color: ts.badgeText }]}>
                      {TECHNIQUE_LABELS[t] ?? t}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* Session notes */}
          {!!session.notes && (
            <View style={ss.notesBox}>
              <Ionicons name="document-text-outline" size={14} color="#4FC3F7" />
              <Text style={ss.notesText}>{session.notes}</Text>
            </View>
          )}

          {/* Exercise sections */}
          <View style={ss.exerciseList}>
            {completedExercises.map(e => (
              <ExerciseSection key={e.id} exercise={e} />
            ))}
          </View>

          {completedExercises.length === 0 && (
            <View style={ss.emptyExercises}>
              <Text style={ss.emptyText}>Nenhuma série concluída nessa sessão</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E24',
    gap: 10,
  },
  backBtn: { width: 32, flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 16, fontWeight: '600' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { color: '#8A8A9A', fontSize: 14 },

  scroll: { padding: 16, paddingBottom: 56, gap: 14 },

  date: { color: '#555560', fontSize: 12 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A35',
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: '#F0F0F5', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#555560', fontSize: 10 },
  statDivider: { width: 1, height: 28, backgroundColor: '#2A2A35' },

  prHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,230,118,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  prHighlightText: { color: '#00E676', fontSize: 13, fontWeight: '600' },

  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  techPillText: { fontSize: 10, fontWeight: '600' },

  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 12,
  },
  notesText: { color: '#8A8A9A', fontSize: 13, lineHeight: 18, flex: 1 },

  exerciseList: { gap: 2 },

  exerciseSection: {
    backgroundColor: '#1E1E24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A35',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },

  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseName: { color: '#F0F0F5', fontSize: 14, fontWeight: '700', flex: 1 },
  exerciseMuscle: { color: '#555560', fontSize: 11 },

  exerciseNotesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  exerciseNotes: { color: '#555560', fontSize: 12, lineHeight: 16, flex: 1, fontStyle: 'italic' },

  setsContainer: { gap: 8 },

  setRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  setInfo: { flex: 1, gap: 3 },
  setMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setReps: { color: '#F0F0F5', fontSize: 13, width: 62 },
  setWeight: { color: '#8A8A9A', fontSize: 13, flex: 1 },
  prPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,230,118,0.10)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  prText: { color: '#00E676', fontSize: 9, fontWeight: '700' },
  blockSummary: { color: '#555560', fontSize: 11, paddingLeft: 2 },

  emptyExercises: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#4A4A5A', fontSize: 13 },
})
