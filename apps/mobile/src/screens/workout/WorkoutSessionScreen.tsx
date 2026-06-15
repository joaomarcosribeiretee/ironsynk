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
import type { ExecutionExerciseRecord, ExecutionSetLogRecord } from '../../lib/api'
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

// ─── Executed technique detail (read-only, full structure) ──────────────────────

function RestSep({ seconds, color }: { seconds: number; color?: string }) {
  if (!seconds) return <View style={ss.blockSepThin} />
  return (
    <View style={ss.restSep}>
      <View style={[ss.restSepLine, color ? { backgroundColor: color } : null]} />
      <Text style={[ss.restSepText, color ? { color } : null]}>{seconds}s</Text>
      <View style={[ss.restSepLine, color ? { backgroundColor: color } : null]} />
    </View>
  )
}

function BlockRow({ label, reps, weight, failed, accent }: {
  label: string
  reps: number | null | undefined
  weight?: number | null
  failed?: boolean
  accent?: string
}) {
  return (
    <View style={[ss.blockRow, failed && ss.blockRowFailed]}>
      <Text style={[ss.blockLabel, accent ? { color: accent } : null]}>{label}</Text>
      <View style={ss.blockVals}>
        {weight != null && weight > 0 && <Text style={ss.blockWeight}>{formatWeight(weight)}</Text>}
        <Text style={ss.blockReps}>{reps != null ? `${reps} reps` : '—'}</Text>
        {failed && <Text style={ss.failTag}>falha</Text>}
      </View>
    </View>
  )
}

function TechniqueDetail({ set }: { set: ExecutionSetLogRecord }) {
  const cfg = set.techniqueConfig as Record<string, unknown> | null
  if (!cfg) return null
  const rest = Number(cfg['restBetweenSeconds'] ?? 0)
  const pink = 'rgba(244,114,182,0.25)'

  switch (set.technique) {
    case 'REST_PAUSE': {
      const pts = (cfg['execPoints'] as { reps: number | null; weightKg: number | null }[] | undefined) ?? []
      if (!pts.length) return null
      return (
        <View style={ss.techDetail}>
          {pts.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 && <RestSep seconds={rest} />}
              <BlockRow
                label={i === 0 ? 'Série Principal' : `Falha ${i}`}
                reps={p.reps}
                weight={i === 0 ? p.weightKg : undefined}
              />
            </React.Fragment>
          ))}
        </View>
      )
    }
    case 'CLUSTER_SET': {
      const blks = (cfg['execBlocks'] as { reps: number | null; weightKg: number | null }[] | undefined) ?? []
      if (!blks.length) return null
      return (
        <View style={ss.techDetail}>
          {blks.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <RestSep seconds={rest} />}
              <BlockRow label={`Bloco ${i + 1}`} reps={b.reps} weight={i === 0 ? b.weightKg : undefined} />
            </React.Fragment>
          ))}
        </View>
      )
    }
    case 'MUSCLE_ROUND': {
      const blks = (cfg['execBlocks'] as { reps: number | null; failed?: boolean }[] | undefined) ?? []
      const mainW = cfg['mainWeightKg'] as number | null | undefined
      const dropW = cfg['dropWeightKg'] as number | null | undefined
      const failedAt = blks.findIndex(b => b?.failed)
      return (
        <View style={ss.techDetail}>
          <View style={ss.mrWeights}>
            <View style={ss.mrWeightBox}>
              <Text style={ss.mrWeightLabel}>PRINCIPAL</Text>
              <Text style={ss.mrWeightVal}>{formatWeight(mainW ?? null)}</Text>
            </View>
            <View style={[ss.mrWeightBox, ss.mrWeightBoxDrop]}>
              <Text style={[ss.mrWeightLabel, { color: '#A78BFA' }]}>↓ QUEDA</Text>
              <Text style={ss.mrWeightVal}>{formatWeight(dropW ?? null)}</Text>
            </View>
          </View>
          {blks.map((b, i) => {
            const isDrop = failedAt >= 0 && i > failedAt
            return (
              <React.Fragment key={i}>
                {i > 0 && <RestSep seconds={rest} />}
                <BlockRow
                  label={`Bloco ${i + 1}`}
                  reps={b.reps}
                  weight={isDrop ? dropW : mainW}
                  failed={!!b.failed}
                  accent={isDrop ? '#A78BFA' : undefined}
                />
              </React.Fragment>
            )
          })}
        </View>
      )
    }
    case 'DROP_SET': {
      const drops = (cfg['execDrops'] as { weightKg: number | null; reps: number | null }[] | undefined) ?? []
      if (!drops.length) return null
      return (
        <View style={ss.techDetail}>
          {drops.map((d, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={ss.dropSep}>
                  <View style={[ss.restSepLine, { backgroundColor: 'rgba(239,68,68,0.2)' }]} />
                  <Text style={ss.dropSepText}>↓ drop</Text>
                  <View style={[ss.restSepLine, { backgroundColor: 'rgba(239,68,68,0.2)' }]} />
                </View>
              )}
              <BlockRow label={i === 0 ? 'Série Principal' : `Drop ${i}`} reps={d.reps} weight={d.weightKg} />
            </React.Fragment>
          ))}
        </View>
      )
    }
    case 'MYOREP': {
      const act = cfg['execActivationReps'] as number | null | undefined
      const minis = (cfg['execMiniBlocks'] as { reps: number | null; failed?: boolean }[] | undefined) ?? []
      const mainW = (cfg['mainWeightKg'] as number | null | undefined) ?? (cfg['weightKg'] as number | null | undefined)
      const actRest = Number(cfg['activationRestSeconds'] ?? 0)
      if (act == null && minis.length === 0) return null
      return (
        <View style={ss.techDetail}>
          <BlockRow label="Ativação" reps={act} weight={mainW} accent="#F472B6" />
          {minis.map((m, i) => (
            <React.Fragment key={i}>
              <RestSep seconds={i === 0 ? actRest : rest} color={pink} />
              <BlockRow label={`Mini ${i + 1}`} reps={m.reps} weight={mainW} failed={!!m.failed} accent="#F472B6" />
            </React.Fragment>
          ))}
        </View>
      )
    }
    default:
      return null
  }
}

function SetDetailRow({ set, index }: { set: ExecutionSetLogRecord; index: number }) {
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
        <TechniqueDetail set={set} />
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

  // Executed technique detail
  techDetail: { marginTop: 8, gap: 4 },
  blockRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, gap: 8,
  },
  blockRowFailed: { backgroundColor: 'rgba(239,68,68,0.10)' },
  blockLabel: { color: '#8A8A9A', fontSize: 12, flexShrink: 1 },
  blockVals: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blockWeight: { color: '#8A8A9A', fontSize: 12 },
  blockReps: { color: '#F0F0F5', fontSize: 12, fontWeight: '500' },
  failTag: { color: '#FF5252', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  restSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 1 },
  restSepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  restSepText: { color: '#4A4A5A', fontSize: 10, marginHorizontal: 8 },
  blockSepThin: { height: 4 },

  dropSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 1 },
  dropSepText: { color: '#EF4444', fontSize: 10, marginHorizontal: 8, opacity: 0.75 },

  mrWeights: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  mrWeightBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  mrWeightBoxDrop: { backgroundColor: 'rgba(123,97,255,0.10)' },
  mrWeightLabel: { color: '#8A8A9A', fontSize: 10, fontWeight: '600' },
  mrWeightVal: { color: '#F0F0F5', fontSize: 12, fontWeight: '500' },

  emptyExercises: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#4A4A5A', fontSize: 13 },
})
