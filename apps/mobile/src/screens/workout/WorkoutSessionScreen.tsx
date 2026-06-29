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
import { SetBadge } from '../../components/SetBadge'

type NavProp = NativeStackNavigationProp<AppStackParamList>
type RouteProps = RouteProp<AppStackParamList, 'WorkoutSession'>

// Single premium gold identity for every Personal Record indicator on this
// screen — badge, banner and icons all share these tokens. Never green.
const GOLD = '#FFCB52'
const GOLD_SOFT = 'rgba(255,203,82,0.10)'
const GOLD_LINE = 'rgba(255,203,82,0.32)'

// Neutral rail used by every advanced-technique breakdown so all techniques
// share one integrated visual language instead of per-type boxes/colors.
const RAIL = 'rgba(255,255,255,0.09)'

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
// Every technique renders into one shared rail + flat-row language: a quiet left
// guide line, a secondary block label and right-aligned values. No per-block
// boxes, no competing accent colors — the SetBadge already carries the identity.

function RestSep({ seconds }: { seconds: number }) {
  if (!seconds) return <View style={ss.blockSepThin} />
  return (
    <View style={ss.restSep}>
      <Text style={ss.restSepText}>descanso {seconds}s</Text>
    </View>
  )
}

function BlockRow({ label, reps, weight, failed }: {
  label: string
  reps: number | null | undefined
  weight?: number | null
  failed?: boolean
}) {
  return (
    <View style={ss.blockRow}>
      <Text style={ss.blockLabel} numberOfLines={1}>{label}</Text>
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
              <Text style={ss.mrWeightLabel}>Principal</Text>
              <Text style={ss.mrWeightVal}>{formatWeight(mainW ?? null)}</Text>
            </View>
            <View style={ss.mrWeightBox}>
              <Text style={ss.mrWeightLabel}>↓ Drop</Text>
              <Text style={ss.mrWeightVal}>{formatWeight(dropW ?? null)}</Text>
            </View>
          </View>
          {blks.map((b, i) => {
            const isDrop = failedAt >= 0 && i > failedAt
            return (
              <React.Fragment key={i}>
                {i > 0 && <RestSep seconds={rest} />}
                <BlockRow
                  label={isDrop ? `Bloco ${i + 1} · drop` : `Bloco ${i + 1}`}
                  reps={b.reps}
                  weight={isDrop ? dropW : mainW}
                  failed={!!b.failed}
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
              {i > 0 && <View style={ss.restSep}><Text style={ss.restSepText}>↓ drop</Text></View>}
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
          <BlockRow label="Ativação" reps={act} weight={mainW} />
          {minis.map((m, i) => (
            <React.Fragment key={i}>
              <RestSep seconds={i === 0 ? actRest : rest} />
              <BlockRow label={`Mini ${i + 1}`} reps={m.reps} weight={mainW} failed={!!m.failed} />
            </React.Fragment>
          ))}
        </View>
      )
    }
    default:
      return null
  }
}

function PRBadge() {
  return (
    <View style={ss.prPill}>
      <Ionicons name="trophy" size={9} color={GOLD} />
      <Text style={ss.prText}>PR</Text>
    </View>
  )
}

function SetDetailRow({ set, index, isFirst }: { set: ExecutionSetLogRecord; index: number; isFirst: boolean }) {
  return (
    <View style={[ss.setRow, !isFirst && ss.setRowDivider]}>
      <SetBadge setType={set.setType} technique={set.technique} index={index} />
      <View style={ss.setInfo}>
        <View style={ss.setMainRow}>
          <Text style={ss.setReps}>{set.repsCompleted ?? 0} reps</Text>
          <Text style={ss.setWeight}>{formatWeight(set.weightKg)}</Text>
          {set.isPersonalRecord && <PRBadge />}
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
  const hasPR = checkedSets.some(s => s.isPersonalRecord)

  return (
    <View style={ss.exerciseSection}>
      <View style={ss.exerciseHeader}>
        <View style={ss.exerciseHeaderText}>
          <Text style={ss.exerciseName} numberOfLines={2}>{exercise.exercise.name}</Text>
          <Text style={ss.exerciseMuscle}>{muscleLabel.toUpperCase()}</Text>
        </View>
        {hasPR && <Ionicons name="trophy" size={15} color={GOLD} />}
      </View>
      {!!exercise.exerciseNotes && (
        <View style={ss.exerciseNotesRow}>
          <Ionicons name="chatbubble-outline" size={11} color="#555560" />
          <Text style={ss.exerciseNotes}>{exercise.exerciseNotes}</Text>
        </View>
      )}
      <View style={ss.setsContainer}>
        {checkedSets.map((set, i) => (
          <SetDetailRow key={set.id} set={set} index={i} isFirst={i === 0} />
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
          {/* ── Summary ── */}
          <View style={ss.summary}>
            <Text style={ss.workoutName}>{session.workoutName ?? 'Treino'}</Text>
            <Text style={ss.date}>{formatDateTime(session.startedAt)}</Text>

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

            {totalPRs > 0 && (
              <View style={ss.prHighlight}>
                <Ionicons name="trophy" size={14} color={GOLD} />
                <Text style={ss.prHighlightText}>
                  {totalPRs} {totalPRs === 1 ? 'recorde pessoal' : 'recordes pessoais'} nessa sessão
                </Text>
              </View>
            )}

            {techniques.length > 0 && (
              <View style={ss.techRow}>
                {techniques.map(t => (
                  <View key={t} style={ss.techPill}>
                    <Text style={ss.techPillText}>{TECHNIQUE_LABELS[t] ?? t}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!session.notes && (
              <View style={ss.notesBox}>
                <Ionicons name="document-text-outline" size={14} color="#4FC3F7" />
                <Text style={ss.notesText}>{session.notes}</Text>
              </View>
            )}
          </View>

          {/* ── Exercises ── */}
          {completedExercises.length > 0 && (
            <View style={ss.sectionHeaderRow}>
              <Text style={ss.sectionTitle}>Exercícios</Text>
              <Text style={ss.sectionCount}>{completedExercises.length}</Text>
            </View>
          )}

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

  scroll: { padding: 16, paddingBottom: 56, gap: 22 },

  // ── Summary ──
  summary: { gap: 14 },
  workoutName: { color: '#F0F0F5', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  date: { color: '#555560', fontSize: 12, marginTop: -8 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#F0F0F5', fontSize: 19, fontWeight: '700' },
  statLabel: { color: '#555560', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, height: 26, backgroundColor: '#2A2A35' },

  prHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GOLD_SOFT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD_LINE,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  prHighlightText: { color: GOLD, fontSize: 13, fontWeight: '700' },

  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techPill: { backgroundColor: '#20202A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  techPillText: { color: '#9A9AAA', fontSize: 11, fontWeight: '600' },

  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    padding: 13,
  },
  notesText: { color: '#8A8A9A', fontSize: 13, lineHeight: 18, flex: 1 },

  // ── Section header ──
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: -10,
  },
  sectionTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '700' },
  sectionCount: { color: '#555560', fontSize: 13, fontWeight: '600' },

  exerciseList: { gap: 12 },

  exerciseSection: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },

  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  exerciseHeaderText: { flex: 1, gap: 3 },
  exerciseName: { color: '#F0F0F5', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  exerciseMuscle: { color: '#8A8A9A', fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },

  exerciseNotesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  exerciseNotes: { color: '#8A8A9A', fontSize: 12, lineHeight: 16, flex: 1, fontStyle: 'italic' },

  setsContainer: { },

  setRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  setRowDivider: { borderTopWidth: 1, borderTopColor: '#23232C' },
  setInfo: { flex: 1, gap: 2 },
  setMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 22 },
  setReps: { color: '#F0F0F5', fontSize: 15, fontWeight: '600', minWidth: 72 },
  setWeight: { color: '#8A8A9A', fontSize: 15, flex: 1 },
  prPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: GOLD_SOFT,
    borderWidth: 1,
    borderColor: GOLD_LINE,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  prText: { color: GOLD, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // ── Executed technique detail (shared rail language) ──
  techDetail: {
    marginTop: 8,
    marginLeft: 1,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: RAIL,
    gap: 2,
  },
  blockRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4, gap: 8,
  },
  blockLabel: { color: '#8A8A9A', fontSize: 12, flexShrink: 1 },
  blockVals: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockWeight: { color: '#8A8A9A', fontSize: 12 },
  blockReps: { color: '#F0F0F5', fontSize: 12, fontWeight: '600' },
  failTag: { color: '#FF5252', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  restSep: { paddingVertical: 1 },
  restSepText: { color: '#4A4A5A', fontSize: 10 },
  blockSepThin: { height: 2 },

  mrWeights: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  mrWeightBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  mrWeightLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '600' },
  mrWeightVal: { color: '#F0F0F5', fontSize: 12, fontWeight: '600' },

  emptyExercises: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#4A4A5A', fontSize: 13 },
})
