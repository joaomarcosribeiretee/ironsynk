import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { ExerciseCardShell, cardMetaStyles } from '../../components/ExerciseCardShell'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import type { PlannedSetRecord, SetType, PlannedSetTechnique } from '../../lib/api'
import { SetBadge, getTechStyle } from '../../components/SetBadge'

const EQUIP_PT: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Haltere', cable: 'Cabo', machine: 'Máquina',
  bodyweight: 'Peso Corporal', 'body weight': 'Peso Corporal',
  smith: 'Smith', kettlebell: 'Kettlebell', band: 'Elástico', other: 'Outro',
}
const txEquip = (eq: string | null | undefined) => eq ? (EQUIP_PT[eq.toLowerCase()] ?? eq) : '—'

// ─── Technique summary helper ─────────────────────────────────────────────────

function buildViewTechSummary(technique: PlannedSetTechnique, c: Record<string, unknown> | null): string | null {
  if (!c) return null
  switch (technique) {
    case 'REST_PAUSE': {
      const pts = (c['failurePoints'] as number) ?? 3
      const rest = (c['restBetweenSeconds'] as number) ?? 20
      return `${pts} pontos de falha · ${rest}s descanso`
    }
    case 'CLUSTER_SET': {
      const blks = (c['blocks'] as number) ?? 4
      const rpp = c['repsPerBlock'] as number | undefined
      const rest = (c['restBetweenSeconds'] as number) ?? 15
      return `${blks} blocos${rpp ? ` × ${rpp} reps` : ''} · ${rest}s`
    }
    case 'MUSCLE_ROUND': {
      const blks = (c['blocks'] as number) ?? 6
      const rest = (c['restBetweenSeconds'] as number) ?? 35
      const dropKg = c['dropWeightKg'] as number | null | undefined
      return `${blks} blocos · ${rest}s${dropKg != null ? ` · ↓ ${dropKg} kg` : ''}`
    }
    case 'DROP_SET': {
      const dw = c['dropWeights'] as (number | null)[] | undefined
      const drops = (c['drops'] as number) ?? 2
      if (dw && dw.some(w => w != null)) {
        return dw.map(w => (w != null ? `${w} kg` : '—')).join(' → ')
      }
      return `${drops + 1} drops`
    }
    case 'MYOREP': {
      const aReps = (c['activationReps'] as number) ?? 5
      const aRest = (c['activationRestSeconds'] as number) ?? 40
      const rpp = (c['repsPerBlock'] as number) ?? 2
      return `Ativ. ${aReps} reps · ${aRest}s · ${rpp}/bloco`
    }
    default: return null
  }
}

// ─── Read-only set row ────────────────────────────────────────────────────────

function ReadonlySetRow({ set, index }: { set: PlannedSetRecord; index: number }) {
  const ts = getTechStyle(set.setType, set.technique)
  const hasLeftBorder = set.setType === 'WARMUP' || set.setType === 'FEEDER' || set.technique !== 'NONE'
  const c = set.techniqueConfig as Record<string, unknown> | null
  const isAdvanced = set.technique === 'REST_PAUSE' || set.technique === 'CLUSTER_SET' ||
    set.technique === 'MUSCLE_ROUND' || set.technique === 'DROP_SET' || set.technique === 'MYOREP'
  const summaryText = isAdvanced ? buildViewTechSummary(set.technique, c) : null

  const hideReps = set.technique === 'CLUSTER_SET' || set.technique === 'MUSCLE_ROUND' || set.technique === 'REST_PAUSE' || set.technique === 'DROP_SET' || set.technique === 'MYOREP'
  // DROP_SET weights live in the per-drop headers; MYOREP weight shown in main row like CLUSTER_SET
  const hideWeight = set.technique === 'DROP_SET'

  // sub-row counts / config values
  const rpBlocks = set.technique === 'REST_PAUSE' ? Math.max(1, Number(c?.['failurePoints'] ?? 3)) : 0
  const rpRest = set.technique === 'REST_PAUSE' ? Number(c?.['restBetweenSeconds'] ?? 20) : 0
  const csBlocks = set.technique === 'CLUSTER_SET' ? Math.max(2, Number(c?.['blocks'] ?? 4)) : 0
  const csRest   = set.technique === 'CLUSTER_SET' ? Number(c?.['restBetweenSeconds'] ?? 15) : 0
  const mrBlocks = set.technique === 'MUSCLE_ROUND' ? Math.max(4, Number(c?.['blocks'] ?? 6)) : 0
  const mrRest   = set.technique === 'MUSCLE_ROUND' ? Number(c?.['restBetweenSeconds'] ?? 35) : 0
  const mrDropKg = set.technique === 'MUSCLE_ROUND' ? (c?.['dropWeightKg'] as number | null | undefined) ?? null : null
  const dsDrops  = set.technique === 'DROP_SET'     ? Math.max(1, Number(c?.['drops'] ?? 2)) : 0
  const dsWeights = dsDrops > 0 ? (c?.['dropWeights'] as (number | null)[] | undefined) ?? null : null
  const isMYO = set.technique === 'MYOREP'
  const myoActivationReps = isMYO ? Number(c?.['activationReps'] ?? 5) : 0
  const myoActivationRest = isMYO ? Number(c?.['activationRestSeconds'] ?? 40) : 0
  const myoRepsPerBlock   = isMYO ? Number(c?.['repsPerBlock'] ?? 2) : 0
  const myoRestBetween    = isMYO ? Number(c?.['restBetweenSeconds'] ?? 20) : 0

  return (
    <View style={[rv.wrap, hasLeftBorder && { borderLeftWidth: 2, borderLeftColor: ts.borderColor }]}>
      {/* Main row */}
      <View style={rv.main}>
        <SetBadge setType={set.setType} technique={set.technique} index={index} />
        {!hideReps && <Text style={rv.dash}>—</Text>}
        {!hideReps && !hideWeight && <Text style={rv.timesText}>×</Text>}
        {!hideWeight && <Text style={rv.dash}>—</Text>}
        {!hideWeight && <Text style={rv.kgText}>kg</Text>}
        {hideReps && hideWeight && <View style={{ flex: 1 }} />}
      </View>

      {(set.setType === 'WARMUP' || set.setType === 'FEEDER') && (
        <Text style={rv.volumeHint}>Não conta no volume</Text>
      )}

      {summaryText != null && (
        <View style={rv.techSummaryRow}>
          <View style={[rv.techSummaryAccent, { backgroundColor: ts.borderColor }]} />
          <Text style={[rv.techSummaryText, { color: ts.badgeText }]} numberOfLines={1}>{summaryText}</Text>
        </View>
      )}

      {/* REST_PAUSE sub-rows: Série Principal + failure blocks */}
      {rpBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: rpBlocks + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.restSep}>
                  <View style={rv.restSepLine} />
                  <Text style={rv.restSepText}>{rpRest}s</Text>
                  <View style={rv.restSepLine} />
                </View>
              )}
              <View style={rv.subRow}>
                <Text style={rv.subLabel}>{i === 0 ? 'Série Principal' : `Falha ${i}`}</Text>
                <Text style={rv.subDash}>—</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* CLUSTER_SET sub-rows: blocks with rest separators */}
      {csBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: csBlocks }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.restSep}>
                  <View style={rv.restSepLine} />
                  <Text style={rv.restSepText}>{csRest}s</Text>
                  <View style={rv.restSepLine} />
                </View>
              )}
              <View style={rv.subRow}>
                <Text style={rv.subLabel}>Bloco {i + 1}</Text>
                <Text style={rv.subDash}>—</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* MUSCLE_ROUND sub-rows: drop weight indicator + blocks */}
      {mrBlocks > 0 && (
        <View style={rv.subWrap}>
          <View style={[rv.subRow, rv.mrDropRow]}>
            <Text style={[rv.subLabel, rv.mrDropLabel]}>↓ Queda</Text>
            <Text style={[rv.subDash, rv.mrDropDash]}>
              {mrDropKg != null ? `${mrDropKg} kg` : '—'}
            </Text>
          </View>
          {Array.from({ length: mrBlocks }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.restSep}>
                  <View style={rv.restSepLine} />
                  <Text style={rv.restSepText}>{mrRest}s</Text>
                  <View style={rv.restSepLine} />
                </View>
              )}
              <View style={rv.subRow}>
                <Text style={rv.subLabel}>Bloco {i + 1}</Text>
                <Text style={rv.subDash}>—</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* MYOREP sub-rows — activation + mini-block summary */}
      {isMYO && (
        <View style={rv.subWrap}>
          <View style={[rv.subRow, rv.myoActivationRow]}>
            <Text style={[rv.subLabel, rv.myoLabel]}>→ Ativação</Text>
            <Text style={[rv.subDash, rv.myoValue]}>{myoActivationReps} reps</Text>
          </View>
          <View style={rv.restSep}>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
            <Text style={[rv.restSepText, { color: '#F472B6' }]}>{myoActivationRest}s</Text>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
          </View>
          <View style={[rv.subRow, rv.myoMiniRow]}>
            <Text style={[rv.subLabel, rv.myoLabel]}>→ Mini-blocos</Text>
            <Text style={[rv.subDash, rv.myoValue]}>{myoRepsPerBlock} reps cada</Text>
          </View>
          <View style={rv.restSep}>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
            <Text style={[rv.restSepText, { color: '#F472B6' }]}>{myoRestBetween}s</Text>
            <View style={[rv.restSepLine, { backgroundColor: 'rgba(244,114,182,0.2)' }]} />
          </View>
          <View style={rv.subRow}>
            <Text style={[rv.subLabel, { fontStyle: 'italic', color: '#4A4A5A' }]}>Qtd. definida na execução</Text>
          </View>
        </View>
      )}

      {/* DROP_SET sub-rows — structured: weight header → reps block per drop */}
      {dsDrops > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: dsDrops + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={rv.dropSep}>
                  <View style={[rv.restSepLine, { backgroundColor: 'rgba(239,68,68,0.2)' }]} />
                  <Text style={rv.dropSepText}>↓ drop</Text>
                  <View style={[rv.restSepLine, { backgroundColor: 'rgba(239,68,68,0.2)' }]} />
                </View>
              )}
              <View style={rv.dropHeader}>
                <Text style={rv.dropHeaderLabel}>{i === 0 ? 'Peso Principal' : `Peso Drop ${i}`}</Text>
                <Text style={rv.dropHeaderWeight}>
                  {dsWeights?.[i] != null ? `${dsWeights[i]} kg` : '— kg'}
                </Text>
              </View>
              <View style={[rv.subRow, rv.dropBlock]}>
                <Text style={rv.dropArrow}>→</Text>
                <Text style={rv.subLabel}>{i === 0 ? 'Série Principal' : `Drop ${i}`}</Text>
                <Text style={rv.subDash}>—</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  )
}

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
              {exercises.map((te) => {
                const sets = te.sets
                const validSets = sets.filter((s: PlannedSetRecord) => s.setType === 'WORKING').length

                return (
                  <ExerciseCardShell
                    key={te.id}
                    gifUrl={te.exercise.gifUrl ?? null}
                    name={te.exercise.name}
                    meta={
                      te.exercise.equipment ? (
                        <View style={cardMetaStyles.pill}>
                          <Text style={cardMetaStyles.pillText}>{txEquip(te.exercise.equipment)}</Text>
                        </View>
                      ) : null
                    }
                    shadowStyle={{ marginBottom: 12 }}
                  >
                    <View style={s.cardBody}>
                      {sets.length > 0 ? (
                        sets.map((set: PlannedSetRecord, i: number) => (
                          <ReadonlySetRow key={set.id} set={set} index={i} />
                        ))
                      ) : (
                        Array.from({ length: te.targetSets }).map((_, i) => (
                          <View key={i} style={rv.wrap}>
                            <View style={rv.main}>
                              <SetBadge setType="WORKING" technique="NONE" index={i} />
                              <Text style={rv.dash}>—</Text>
                              <Text style={rv.timesText}>×</Text>
                              <Text style={rv.dash}>—</Text>
                              <Text style={rv.kgText}>kg</Text>
                            </View>
                          </View>
                        ))
                      )}

                      <Text style={s.cardFooter}>
                        {sets.length > 0 ? sets.length : te.targetSets} {((sets.length || te.targetSets) === 1) ? 'série' : 'séries'}
                        {sets.length > 0 ? ` · ${validSets} válidas` : ''}
                      </Text>
                    </View>
                  </ExerciseCardShell>
                )
              })}
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

  cardBody: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10 },
  cardFooter: { color: '#8A8A9A', fontSize: 12, marginTop: 10 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },
})

const rv = StyleSheet.create({
  wrap: {
    borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: {
    flex: 1, height: 40,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, textAlign: 'center', textAlignVertical: 'center',
    color: '#444455', fontSize: 16, fontWeight: '500',
  },
  timesText: { width: 14, textAlign: 'center', color: '#2A2A35', fontSize: 13 },
  kgText: { width: 18, color: '#555560', fontSize: 11 },
  volumeHint: { color: '#8A8A9A', fontSize: 10, marginTop: 3, marginLeft: 42 },

  techSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 3,
    paddingBottom: 4,
  },
  techSummaryAccent: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
    flexShrink: 0,
  },
  techSummaryText: {
    fontSize: 11,
    letterSpacing: 0.2,
    flex: 1,
    opacity: 0.75,
  },

  subWrap: { marginTop: 6, marginLeft: 42, gap: 4 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  subLabel: { color: '#8A8A9A', fontSize: 12 },
  subDash: { color: '#444455', fontSize: 13 },
  restSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  restSepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  restSepText: { color: '#4A4A5A', fontSize: 10, marginHorizontal: 8 },
  mrDropRow: { backgroundColor: 'rgba(123,97,255,0.1)', marginBottom: 2 },
  mrDropLabel: { color: '#A78BFA' },
  mrDropDash: { color: '#A78BFA', fontWeight: '600' },

  // MYOREP
  myoActivationRow: { backgroundColor: 'rgba(244,114,182,0.12)' },
  myoMiniRow: { backgroundColor: 'rgba(244,114,182,0.06)' },
  myoLabel: { color: '#F472B6' },
  myoValue: { color: '#F472B6', fontWeight: '500' },

  // DROP_SET structured layout
  dropSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  dropSepText: { color: '#EF4444', fontSize: 10, marginHorizontal: 8, opacity: 0.7 },
  dropHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 3, gap: 6,
  },
  dropHeaderLabel: { color: '#EF4444', fontSize: 11, flex: 1 },
  dropHeaderWeight: { color: '#EF4444', fontSize: 12, fontWeight: '500' },
  dropBlock: { backgroundColor: 'rgba(239,68,68,0.08)' },
  dropArrow: { color: 'rgba(239,68,68,0.45)', fontSize: 10, marginRight: 2 },
})
