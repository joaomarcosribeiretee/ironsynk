import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import type { PlannedSetRecord, SetType, PlannedSetTechnique } from '../../lib/api'

// ─── Tech style (same palette as editor) ─────────────────────────────────────

type TechStyle = { borderColor: string; bgColor: string; badge: string; badgeBg: string; badgeText: string }

const TECH_STYLE: Record<string, TechStyle> = {
  WARMUP:       { borderColor: '#FFB300', bgColor: '#1A1500', badge: 'W',  badgeBg: '#2A2200', badgeText: '#FFB300' },
  FEEDER:       { borderColor: '#4FC3F7', bgColor: '#001A1A', badge: 'F',  badgeBg: '#002233', badgeText: '#4FC3F7' },
  REST_PAUSE:   { borderColor: '#2979FF', bgColor: '#001428', badge: 'RP', badgeBg: '#001A3A', badgeText: '#4FC3F7' },
  MUSCLE_ROUND: { borderColor: '#7B61FF', bgColor: '#0D0A1E', badge: 'MR', badgeBg: '#1A1030', badgeText: '#A78BFA' },
  CLUSTER_SET:  { borderColor: '#00E676', bgColor: '#001A0A', badge: 'CS', badgeBg: '#002210', badgeText: '#00E676' },
  BACK_OFF:     { borderColor: '#F97316', bgColor: '#1A0C00', badge: 'BO', badgeBg: '#2A1400', badgeText: '#F97316' },
  DROP_SET:     { borderColor: '#EF4444', bgColor: '#1A0505', badge: 'DS', badgeBg: '#2A0A0A', badgeText: '#EF4444' },
}
const DEFAULT_STYLE: TechStyle = { borderColor: '#2A2A35', bgColor: '#141418', badge: '', badgeBg: '#2A2A35', badgeText: '#8A8A9A' }

function getTechStyle(setType: SetType, technique: PlannedSetTechnique): TechStyle {
  if (setType === 'WARMUP') return TECH_STYLE['WARMUP']!
  if (setType === 'FEEDER') return TECH_STYLE['FEEDER']!
  if (technique !== 'NONE') return TECH_STYLE[technique] ?? DEFAULT_STYLE
  return DEFAULT_STYLE
}

function getBadge(setType: SetType, technique: PlannedSetTechnique, index: number): string {
  if (setType === 'WARMUP') return 'W'
  if (setType === 'FEEDER') return 'F'
  if (technique !== 'NONE') return TECH_STYLE[technique]?.badge ?? String(index + 1)
  return String(index + 1)
}

const EQUIP_PT: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Haltere', cable: 'Cabo', machine: 'Máquina',
  bodyweight: 'Peso Corporal', 'body weight': 'Peso Corporal',
  smith: 'Smith', kettlebell: 'Kettlebell', band: 'Elástico', other: 'Outro',
}
const txEquip = (eq: string | null | undefined) => eq ? (EQUIP_PT[eq.toLowerCase()] ?? eq) : '—'

// ─── Read-only set row ────────────────────────────────────────────────────────

function ReadonlySetRow({ set, index }: { set: PlannedSetRecord; index: number }) {
  const ts = getTechStyle(set.setType, set.technique)
  const badge = getBadge(set.setType, set.technique, index)
  const hasLeftBorder = set.setType !== 'WORKING' || set.technique !== 'NONE'
  const c = set.techniqueConfig as Record<string, unknown> | null

  const hideReps = set.technique === 'CLUSTER_SET' || set.technique === 'MUSCLE_ROUND'
  const hideWeight = set.technique === 'MUSCLE_ROUND'

  // sub-row counts from config
  const rpBlocks = set.technique === 'REST_PAUSE' ? Math.max(1, Number(c?.['failurePoints'] ?? 3)) : 0
  const csBlocks = set.technique === 'CLUSTER_SET' ? Math.max(2, Number(c?.['blocks'] ?? 4)) : 0
  const mrBlocks = set.technique === 'MUSCLE_ROUND' ? Math.max(4, Number(c?.['blocks'] ?? 6)) : 0
  const dsDrops  = set.technique === 'DROP_SET'     ? Math.max(1, Number(c?.['drops'] ?? 2)) : 0

  return (
    <View style={[rv.wrap, { backgroundColor: ts.bgColor }, hasLeftBorder && { borderLeftWidth: 3, borderLeftColor: ts.borderColor }]}>
      {/* Main row */}
      <View style={rv.main}>
        <View style={[rv.badge, { backgroundColor: ts.badgeBg }]}>
          <Text style={[rv.badgeText, { color: ts.badgeText }]}>{badge}</Text>
        </View>
        {!hideReps && <Text style={rv.dash}>—</Text>}
        {!hideReps && !hideWeight && <Text style={rv.timesText}>×</Text>}
        {!hideWeight && <Text style={rv.dash}>—</Text>}
        {!hideWeight && <Text style={rv.kgText}>kg</Text>}
      </View>

      {(set.setType === 'WARMUP' || set.setType === 'FEEDER') && (
        <Text style={rv.volumeHint}>Não conta no volume</Text>
      )}

      {/* REST_PAUSE sub-rows */}
      {rpBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: rpBlocks }).map((_, i) => (
            <View key={i} style={rv.subRow}>
              <Text style={rv.subLabel}>Falha {i + 1}</Text>
              <Text style={rv.subDash}>—</Text>
            </View>
          ))}
        </View>
      )}

      {/* CLUSTER_SET sub-rows */}
      {csBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: csBlocks }).map((_, i) => (
            <View key={i} style={rv.subRow}>
              <Text style={rv.subLabel}>Bloco {i + 1}</Text>
              <Text style={rv.subDash}>—</Text>
            </View>
          ))}
        </View>
      )}

      {/* MUSCLE_ROUND sub-rows */}
      {mrBlocks > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: mrBlocks }).map((_, i) => (
            <View key={i} style={rv.subRow}>
              <Text style={rv.subLabel}>Bloco {i + 1}</Text>
              <Text style={rv.subDash}>— × —</Text>
            </View>
          ))}
        </View>
      )}

      {/* DROP_SET sub-rows */}
      {dsDrops > 0 && (
        <View style={rv.subWrap}>
          {Array.from({ length: dsDrops }).map((_, i) => (
            <View key={i} style={rv.subRow}>
              <Text style={rv.subLabel}>Drop {i + 1}</Text>
              <Text style={rv.subDash}>— × —</Text>
            </View>
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
                  <View key={te.id} style={s.card}>
                    {/* Exercise header */}
                    <View style={s.cardTop}>
                      <View style={s.imgContainer}>
                        {te.exercise.gifUrl ? (
                          <Image
                            source={{ uri: te.exercise.gifUrl }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons name="barbell-outline" size={24} color="#4A4A5A" />
                        )}
                      </View>
                      <View style={s.cardMid}>
                        <Text style={s.exName} numberOfLines={1}>{te.exercise.name}</Text>
                        {te.exercise.equipment ? (
                          <View style={s.equipPill}>
                            <Text style={s.equipPillText}>{txEquip(te.exercise.equipment)}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Read-only set rows */}
                    {sets.length > 0 ? (
                      sets.map((set: PlannedSetRecord, i: number) => (
                        <ReadonlySetRow key={set.id} set={set} index={i} />
                      ))
                    ) : (
                      // If no planned sets yet, show placeholder rows from targetSets
                      Array.from({ length: te.targetSets }).map((_, i) => (
                        <View key={i} style={rv.wrap}>
                          <View style={rv.main}>
                            <View style={[rv.badge, { backgroundColor: '#2A2A35' }]}>
                              <Text style={[rv.badgeText, { color: '#8A8A9A' }]}>{i + 1}</Text>
                            </View>
                            <Text style={rv.dash}>—</Text>
                            <Text style={rv.timesText}>×</Text>
                            <Text style={rv.dash}>—</Text>
                            <Text style={rv.kgText}>kg</Text>
                          </View>
                        </View>
                      ))
                    )}

                    {/* Card footer */}
                    <Text style={s.cardFooter}>
                      {sets.length > 0 ? sets.length : te.targetSets} {((sets.length || te.targetSets) === 1) ? 'série' : 'séries'}
                      {sets.length > 0 ? ` · ${validSets} válidas` : ''}
                    </Text>
                  </View>
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

  card: {
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  imgContainer: {
    width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardMid: { flex: 1 },
  exName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  equipPill: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5, alignSelf: 'flex-start',
  },
  equipPillText: { color: '#8A8A9A', fontSize: 11 },

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
  main: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    width: 28, height: 28, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  dash: {
    flex: 1, height: 40,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8, textAlign: 'center', textAlignVertical: 'center',
    color: '#444455', fontSize: 16, fontWeight: '500',
    paddingTop: 10,
  },
  timesText: { width: 14, textAlign: 'center', color: '#2A2A35', fontSize: 13 },
  kgText: { width: 18, color: '#555560', fontSize: 11 },
  volumeHint: { color: '#8A8A9A', fontSize: 10, marginTop: 3, marginLeft: 35 },

  subWrap: { marginTop: 6, marginLeft: 35, gap: 4 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  subLabel: { color: '#8A8A9A', fontSize: 12 },
  subDash: { color: '#444455', fontSize: 13 },
})
