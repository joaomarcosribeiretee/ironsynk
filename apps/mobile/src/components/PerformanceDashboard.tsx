import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { WorkoutAnalytics } from '../lib/api'

const GOLD = '#FFC14A'

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: 'Peito', BACK: 'Costas', SHOULDERS: 'Ombros', BICEPS: 'Bíceps',
  TRICEPS: 'Tríceps', FOREARMS: 'Antebraço', QUADS: 'Quadríceps',
  HAMSTRINGS: 'Posterior', GLUTES: 'Glúteos', CALVES: 'Panturrilha',
  ABS: 'Abdômen', FULL_BODY: 'Full Body', OTHER: 'Outro',
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmtVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

function fmtMinutes(min: number): string {
  if (min <= 0) return '0min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function muscleLabel(mg: string): string {
  return MUSCLE_LABELS[mg] ?? mg
}

// ─── Primitives ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={d.sectionLabel}>{children}</Text>
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[d.card, style]}>{children}</View>
}

function EmptyBlock({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <View style={d.empty}>
      <View style={d.emptyIcon}>
        <Ionicons name={icon as any} size={22} color="#4FC3F7" />
      </View>
      <Text style={d.emptyTitle}>{title}</Text>
      {!!sub && <Text style={d.emptySub}>{sub}</Text>}
    </View>
  )
}

function StatTile({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent?: string }) {
  return (
    <View style={d.tile}>
      <View style={d.tileValueRow}>
        <Text style={[d.tileValue, accent ? { color: accent } : null]}>{value}</Text>
        {!!unit && <Text style={d.tileUnit}>{unit}</Text>}
      </View>
      <Text style={d.tileLabel}>{label}</Text>
    </View>
  )
}

// ─── Frequency chart ─────────────────────────────────────────────────────────

function FrequencyChart({ weeks }: { weeks: { label: string; count: number }[] }) {
  const max = Math.max(...weeks.map((w) => w.count), 1)
  return (
    <View style={d.freqChart}>
      {weeks.map((w, i) => (
        <View key={i} style={d.freqSlot}>
          <Text style={d.freqVal}>{w.count > 0 ? w.count : ''}</Text>
          <View style={d.freqBarBg}>
            <LinearGradient
              colors={w.count > 0 ? ['#4FC3F7', '#2979FF'] : ['#23232C', '#23232C']}
              style={[d.freqBarFill, { height: `${Math.max((w.count / max) * 100, w.count > 0 ? 12 : 4)}%` }]}
            />
          </View>
          <Text style={d.freqLbl}>{w.label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Strength progression sparkline ──────────────────────────────────────────

function Sparkline({ points }: { points: { date: string; best1RM: number }[] }) {
  const values = points.map((p) => p.best1RM)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return (
    <View style={d.spark}>
      {points.map((p, i) => {
        const h = 8 + ((p.best1RM - min) / span) * 26
        const isLast = i === points.length - 1
        return (
          <View key={i} style={d.sparkSlot}>
            <View style={[d.sparkBar, { height: h, backgroundColor: isLast ? GOLD : 'rgba(79,195,247,0.45)' }]} />
          </View>
        )
      })}
    </View>
  )
}

function ProgressionRow({ item }: { item: WorkoutAnalytics['progression'][number] }) {
  const first = item.points[0]!.best1RM
  const last = item.points[item.points.length - 1]!.best1RM
  const delta = Math.round((last - first) * 10) / 10
  const up = delta > 0
  const flat = delta === 0
  return (
    <View style={d.progRow}>
      <View style={d.progHead}>
        <Text style={d.progName} numberOfLines={1}>{item.name}</Text>
        <View style={[d.progDelta, up ? d.progDeltaUp : flat ? d.progDeltaFlat : d.progDeltaDown]}>
          <Ionicons
            name={up ? 'trending-up' : flat ? 'remove' : 'trending-down'}
            size={11}
            color={up ? GOLD : flat ? '#8A8A9A' : '#FF5252'}
          />
          <Text style={[d.progDeltaText, { color: up ? GOLD : flat ? '#8A8A9A' : '#FF5252' }]}>
            {up ? '+' : ''}{delta}kg
          </Text>
        </View>
      </View>
      <View style={d.progBody}>
        <Sparkline points={item.points} />
        <View style={d.progMeta}>
          <Text style={d.progCurrent}>{last}<Text style={d.progCurrentUnit}>kg</Text></Text>
          <Text style={d.progCurrentLbl}>1RM est.</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function PerformanceDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['profile-stats'],
    queryFn: () => api.profile.stats(),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <View style={d.loading}>
        <ActivityIndicator color="#4FC3F7" />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={d.wrap}>
        <Card>
          <EmptyBlock icon="cloud-offline-outline" title="Não foi possível carregar" sub="Tente novamente mais tarde" />
        </Card>
      </View>
    )
  }

  const a = data.data.analytics
  const noWorkouts = a.summary.totalWorkouts === 0

  if (noWorkouts) {
    return (
      <View style={d.wrap}>
        <Card>
          <EmptyBlock
            icon="bar-chart-outline"
            title="Sem dados de treino ainda"
            sub="Complete seu primeiro treino para desbloquear seu painel de desempenho"
          />
        </Card>
      </View>
    )
  }

  const pr = a.personalRecords

  return (
    <View style={d.wrap}>
      {/* ── Resumo ── */}
      <SectionLabel>RESUMO GERAL</SectionLabel>
      <View style={d.tileGrid}>
        <StatTile value={String(a.summary.totalWorkouts)} label="Treinos" />
        <StatTile value={fmtMinutes(a.summary.totalMinutes)} label="Tempo total" />
        <StatTile value={fmtVolume(a.summary.totalVolume)} unit="kg" label="Volume total" accent="#4FC3F7" />
        <StatTile value={`${a.summary.avgDurationMin}`} unit="min" label="Duração média" />
      </View>

      {/* ── Frequência ── */}
      <SectionLabel>FREQUÊNCIA — 8 SEMANAS</SectionLabel>
      <Card>
        <FrequencyChart weeks={a.frequency.weeks} />
        <View style={d.freqStats}>
          <View style={d.freqStat}>
            <Text style={d.freqStatNum}>{a.frequency.workoutsPerWeek}</Text>
            <Text style={d.freqStatLbl}>treinos/semana</Text>
          </View>
          <View style={d.freqStatDiv} />
          <View style={d.freqStat}>
            <Text style={d.freqStatNum}>{a.frequency.currentMonthCount}</Text>
            <Text style={d.freqStatLbl}>este mês</Text>
          </View>
          <View style={d.freqStatDiv} />
          <View style={d.freqStat}>
            <Text style={d.freqStatNum}>{a.frequency.consistencyPct}%</Text>
            <Text style={d.freqStatLbl}>consistência</Text>
          </View>
          <View style={d.freqStatDiv} />
          <View style={d.freqStat}>
            <Text style={[d.freqStatNum, a.frequency.streakWeeks > 0 && { color: GOLD }]}>
              {a.frequency.streakWeeks}
            </Text>
            <Text style={d.freqStatLbl}>{a.frequency.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}</Text>
          </View>
        </View>
      </Card>

      {/* ── Records pessoais ── */}
      <SectionLabel>RECORDES PESSOAIS</SectionLabel>
      {pr.total === 0 ? (
        <Card>
          <EmptyBlock
            icon="trophy-outline"
            title="Nenhum recorde ainda"
            sub="Supere seu histórico em um exercício para registrar seu primeiro recorde"
          />
        </Card>
      ) : (
        <Card style={d.prCard}>
          <View style={d.prTopRow}>
            <View style={d.prTrophy}>
              <Ionicons name="trophy" size={18} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={d.prTotal}>{pr.total}</Text>
              <Text style={d.prTotalLbl}>{pr.total === 1 ? 'recorde pessoal' : 'recordes pessoais'}</Text>
            </View>
          </View>
          {pr.strongest && (
            <View style={d.prDetailRow}>
              <Text style={d.prDetailLbl}>Exercício mais forte</Text>
              <Text style={d.prDetailVal} numberOfLines={1}>
                {pr.strongest.exerciseName} · {pr.strongest.estimated1RM}kg
              </Text>
            </View>
          )}
          {pr.latest && (
            <View style={d.prDetailRow}>
              <Text style={d.prDetailLbl}>Último recorde</Text>
              <Text style={d.prDetailVal} numberOfLines={1}>
                {pr.latest.exerciseName} · {pr.latest.weightKg}kg × {pr.latest.reps}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* ── Volume por grupamento ── */}
      <SectionLabel>VOLUME POR GRUPAMENTO</SectionLabel>
      {a.muscleVolume.length === 0 ? (
        <Card>
          <EmptyBlock icon="body-outline" title="Sem volume registrado" />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 6 }}>
          {a.muscleVolume.map((m) => (
            <View key={m.muscleGroup} style={d.muscleRow}>
              <Text style={d.muscleName}>{muscleLabel(m.muscleGroup)}</Text>
              <View style={d.muscleBarBg}>
                <LinearGradient
                  colors={['#4FC3F7', '#2979FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[d.muscleBarFill, { width: `${Math.max(m.pct, 3)}%` }]}
                />
              </View>
              <Text style={d.musclePct}>{m.pct}%</Text>
            </View>
          ))}
        </Card>
      )}

      {/* ── Evolução de carga ── */}
      <SectionLabel>EVOLUÇÃO DE CARGA</SectionLabel>
      {a.progression.length === 0 ? (
        <Card>
          <EmptyBlock
            icon="trending-up-outline"
            title="Sem dados suficientes"
            sub="Treine o mesmo exercício em ao menos 3 sessões para ver a evolução"
          />
        </Card>
      ) : (
        <Card style={d.progCard}>
          {a.progression.map((item, i) => (
            <View key={item.exerciseId}>
              {i > 0 && <View style={d.progDivider} />}
              <ProgressionRow item={item} />
            </View>
          ))}
        </Card>
      )}

      {/* ── Exercícios ── */}
      <SectionLabel>EXERCÍCIOS</SectionLabel>
      <View style={d.tileGrid}>
        <StatTile value={String(a.exercises.uniqueCount)} label="Exercícios únicos" />
        <StatTile
          value={a.exercises.mostTrained ? `${a.exercises.mostTrained.sessions}` : '0'}
          unit={a.exercises.mostTrained ? 'sessões' : undefined}
          label={a.exercises.mostTrained ? a.exercises.mostTrained.name : 'Mais treinado'}
        />
      </View>
      {a.exercises.top.length > 0 && (
        <Card style={{ paddingVertical: 4, marginTop: 8 }}>
          {a.exercises.top.map((e, i) => (
            <View key={e.name + i} style={d.exRow}>
              <Text style={d.exRank}>{i + 1}</Text>
              <Text style={d.exName} numberOfLines={1}>{e.name}</Text>
              <Text style={d.exMeta}>{e.sessions} {e.sessions === 1 ? 'sessão' : 'sessões'} · {e.totalSets} séries</Text>
            </View>
          ))}
        </Card>
      )}

      {/* ── Estatísticas gerais ── */}
      <SectionLabel>RECORDES DE TREINO</SectionLabel>
      <Card style={d.generalCard}>
        {a.records.largestVolume && (
          <GeneralRow
            icon="cube-outline"
            label="Maior volume"
            value={`${fmtVolume(a.records.largestVolume.value)} kg`}
            sub={`${a.records.largestVolume.workoutName} · ${fmtDate(a.records.largestVolume.date)}`}
          />
        )}
        {a.records.longestWorkout && (
          <GeneralRow
            icon="time-outline"
            label="Treino mais longo"
            value={fmtMinutes(a.records.longestWorkout.value)}
            sub={`${a.records.longestWorkout.workoutName} · ${fmtDate(a.records.longestWorkout.date)}`}
          />
        )}
        {a.records.mostSets && (
          <GeneralRow
            icon="layers-outline"
            label="Mais séries"
            value={`${a.records.mostSets.value} séries`}
            sub={`${a.records.mostSets.workoutName} · ${fmtDate(a.records.mostSets.date)}`}
            last
          />
        )}
      </Card>
    </View>
  )
}

function GeneralRow({ icon, label, value, sub, last }: { icon: string; label: string; value: string; sub: string; last?: boolean }) {
  return (
    <View style={[d.genRow, last && { borderBottomWidth: 0 }]}>
      <View style={d.genIcon}>
        <Ionicons name={icon as any} size={16} color="#4FC3F7" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={d.genLabel}>{label}</Text>
        <Text style={d.genSub} numberOfLines={1}>{sub}</Text>
      </View>
      <Text style={d.genValue}>{value}</Text>
    </View>
  )
}

const d = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  loading: { paddingVertical: 48, alignItems: 'center' },

  sectionLabel: { color: '#8A8A9A', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 22 },

  card: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 16 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 14 },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(79,195,247,0.08)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  emptyTitle: { color: '#F0F0F5', fontSize: 14, fontWeight: '600', marginBottom: 5 },
  emptySub: { color: '#8A8A9A', fontSize: 12.5, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },

  // Stat tiles
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1, flexBasis: '47%', backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', paddingVertical: 16, paddingHorizontal: 16, gap: 6,
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  tileValue: { color: '#F0F0F5', fontSize: 22, fontWeight: '800', fontFamily: 'monospace', letterSpacing: -0.5 },
  tileUnit: { color: '#8A8A9A', fontSize: 12, fontWeight: '600' },
  tileLabel: { color: '#8A8A9A', fontSize: 11.5 },

  // Frequency
  freqChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 92, marginBottom: 14 },
  freqSlot: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  freqVal: { color: '#8A8A9A', fontSize: 9, fontWeight: '700', height: 12 },
  freqBarBg: { width: '100%', flex: 1, backgroundColor: '#16161B', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  freqBarFill: { width: '100%', borderRadius: 6 },
  freqLbl: { color: '#555560', fontSize: 9 },
  freqStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161B', borderRadius: 12, paddingVertical: 12 },
  freqStat: { flex: 1, alignItems: 'center', gap: 3 },
  freqStatNum: { color: '#F0F0F5', fontSize: 16, fontWeight: '700', fontFamily: 'monospace' },
  freqStatLbl: { color: '#555560', fontSize: 9, textAlign: 'center' },
  freqStatDiv: { width: 1, height: 26, backgroundColor: '#23232C' },

  // PR
  prCard: { gap: 14 },
  prTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prTrophy: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,193,74,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,193,74,0.22)', justifyContent: 'center', alignItems: 'center',
  },
  prTotal: { color: GOLD, fontSize: 24, fontWeight: '800', fontFamily: 'monospace' },
  prTotalLbl: { color: '#8A8A9A', fontSize: 12 },
  prDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  prDetailLbl: { color: '#8A8A9A', fontSize: 12.5 },
  prDetailVal: { color: '#F0F0F5', fontSize: 12.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  // Muscle volume
  muscleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  muscleName: { color: '#C4C4CE', fontSize: 12.5, width: 78 },
  muscleBarBg: { flex: 1, height: 8, backgroundColor: '#16161B', borderRadius: 4, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 4 },
  musclePct: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right', fontFamily: 'monospace' },

  // Progression
  progCard: { paddingVertical: 6 },
  progDivider: { height: 1, backgroundColor: '#23232C', marginVertical: 4 },
  progRow: { paddingVertical: 12, gap: 10 },
  progHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progName: { color: '#F0F0F5', fontSize: 14, fontWeight: '600', flex: 1 },
  progDelta: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  progDeltaUp: { backgroundColor: 'rgba(255,193,74,0.10)' },
  progDeltaFlat: { backgroundColor: 'rgba(138,138,154,0.10)' },
  progDeltaDown: { backgroundColor: 'rgba(255,82,82,0.10)' },
  progDeltaText: { fontSize: 11.5, fontWeight: '700', fontFamily: 'monospace' },
  progBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  spark: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 36 },
  sparkSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparkBar: { width: '100%', borderRadius: 3, minHeight: 4 },
  progMeta: { alignItems: 'flex-end' },
  progCurrent: { color: '#F0F0F5', fontSize: 18, fontWeight: '800', fontFamily: 'monospace' },
  progCurrentUnit: { color: '#8A8A9A', fontSize: 11, fontWeight: '600' },
  progCurrentLbl: { color: '#555560', fontSize: 9.5 },

  // Exercises
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  exRank: { color: '#555560', fontSize: 12, fontWeight: '700', fontFamily: 'monospace', width: 16 },
  exName: { color: '#F0F0F5', fontSize: 13, fontWeight: '500', flex: 1 },
  exMeta: { color: '#6A6A7A', fontSize: 11 },

  // General records
  generalCard: { paddingVertical: 4 },
  genRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#23232C' },
  genIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(79,195,247,0.07)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  genLabel: { color: '#F0F0F5', fontSize: 13, fontWeight: '600' },
  genSub: { color: '#6A6A7A', fontSize: 11, marginTop: 2 },
  genValue: { color: '#4FC3F7', fontSize: 14, fontWeight: '700', fontFamily: 'monospace', flexShrink: 0 },
})
