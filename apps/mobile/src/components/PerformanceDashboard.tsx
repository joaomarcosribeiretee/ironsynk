import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import type { WorkoutAnalytics, WorkoutAnalyticsQuery } from '@ironsynk/shared'
import type { AppStackParamList } from '../navigation/AppNavigator'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

const MUSCLES: Record<string, string> = {
  CHEST: 'Peito', BACK: 'Costas', SHOULDERS: 'Ombros', BICEPS: 'Bíceps', TRICEPS: 'Tríceps',
  FOREARMS: 'Antebraço', QUADS: 'Quadríceps', HAMSTRINGS: 'Posterior', GLUTES: 'Glúteos',
  CALVES: 'Panturrilha', ABS: 'Abdômen', FULL_BODY: 'Corpo inteiro', OTHER: 'Outro',
}
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const weekDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.choice, selected && s.selected]}>
    <Text style={[s.choiceText, selected && s.accent]}>{label}</Text>
  </Pressable>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.section}><Text style={s.title}>{title}</Text>{children}</View>
}
function Tile({ label, value }: { label: string; value: string }) {
  return <View style={s.tile}><Text style={s.value}>{value}</Text><Text style={s.muted}>{label}</Text></View>
}
function More({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.choice}><Text style={s.accent}>Ver mais</Text></Pressable>
}

/** Zero-based bars with exact values and dates; missing measurements have no bar. */
function Bars({ points, unit }: { points: { id: string; label: string; value: number | null }[]; unit: string }) {
  const max = Math.max(1, ...points.map((point) => point.value ?? 0))
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.chart}>
    {points.map((point) => <View key={point.id} accessible accessibilityLabel={`${point.label}: ${point.value === null ? 'sem dados' : `${number(point.value)} ${unit}`}`} style={s.barColumn}>
      <Text style={s.barValue}>{point.value === null ? '—' : number(point.value)}</Text>
      <View style={s.barTrack}><View style={[s.bar, { height: `${(point.value ?? 0) / max * 100}%` }]} /></View>
      <Text style={s.barLabel}>{point.label}</Text>
    </View>)}
  </ScrollView>
}

function ExerciseDetail({ exercise }: { exercise: WorkoutAnalytics['exercises'][number] }) {
  const [metric, setMetric] = useState<'maxWeightKg' | 'best1RM' | 'volume' | 'reps'>('maxWeightKg')
  const [visible, setVisible] = useState(6)
  const units = metric === 'reps' ? 'reps' : metric === 'volume' ? 'kg·rep' : 'kg'
  const latestPoints = exercise.points.slice(-12)
  return <View style={s.card}>
    <Text style={s.name}>{exercise.name}</Text>
    <Text style={s.muted}>{exercise.sessions} sessões · {exercise.totalSets} séries · {number(exercise.totalReps)} reps</Text>
    <Text style={s.muted}>Volume registrado: {number(exercise.totalVolume)} kg × reps</Text>
    <View style={s.options}>
      {([['maxWeightKg', 'Carga'], ['best1RM', '1RM est.'], ['volume', 'Volume'], ['reps', 'Reps']] as const).map(([key, label]) =>
        <Choice key={key} label={label} selected={metric === key} onPress={() => setMetric(key)} />)}
    </View>
    <Text style={s.muted}>Últimas {latestPoints.length} sessões do período · {units}</Text>
    <Bars unit={units} points={latestPoints.map((point) => ({ id: point.sessionId, label: date(point.date), value: point[metric] }))} />
    {exercise.points.length === 1 && <Text style={s.muted}>Primeira referência: mais uma sessão permitirá comparar a evolução.</Text>}
    {exercise.best && <Text style={s.body}>Melhor 1RM estimado: {number(exercise.best.estimated1RM)} kg, com {number(exercise.best.weightKg)} kg × {exercise.best.reps} em {date(exercise.best.date)}.</Text>}
    <Text style={s.muted}>{exercise.change1RM === null ? 'Sem duas sessões com 1RM estimável.' : `Variação do primeiro ao último 1RM estimável no período: ${exercise.change1RM > 0 ? '+' : ''}${number(exercise.change1RM)} kg.`}</Text>
    <Text style={s.muted}>1RM: estimativa Epley em séries tradicionais de 1–12 reps; uma repetição usa a carga real. Compare apenas o mesmo exercício e execução.</Text>
    {[...exercise.points].reverse().slice(0, visible).map((point) => <View key={point.sessionId} style={s.row}>
      <Text style={s.body}>{date(point.date)}</Text>
      <Text style={s.muted}>{point.maxWeightKg === null ? 'Carga ausente' : `${number(point.maxWeightKg)} kg máx.`} · {point.sets} séries · {point.reps} reps{point.bestSet ? `\nReferência: ${number(point.bestSet.weightKg)} kg × ${point.bestSet.reps}` : ''}</Text>
    </View>)}
    {exercise.points.length > visible && <More onPress={() => setVisible(visible + 12)} />}
  </View>
}

export function PerformanceDashboard() {
  const [period, setPeriod] = useState<WorkoutAnalyticsQuery['period']>('8')
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [historyCount, setHistoryCount] = useState(10)
  const [prCount, setPrCount] = useState(5)
  const [weeklyMetric, setWeeklyMetric] = useState<'count' | 'volume'>('count')
  const userId = useAuthStore((state) => state.user?.id)
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['profile-stats', userId, period, timeZone],
    queryFn: () => api.profile.stats({ period, timeZone }), enabled: Boolean(userId), staleTime: 30_000,
  })
  useFocusEffect(useCallback(() => { if (userId) void refetch() }, [refetch, userId]))
  const analytics = data?.data.analytics
  const exercise = analytics?.exercises.find((item) => item.exerciseId === exerciseId) ?? analytics?.exercises[0]
  return <View style={s.wrap}>
    <View style={s.options}>
      {(['4', '8', '12', 'all'] as const).map((value) => <Choice key={value} label={value === 'all' ? 'Tudo' : `${value} sem.`} selected={period === value}
        onPress={() => { setPeriod(value); setHistoryCount(10); setPrCount(5) }} />)}
    </View>
    <Text style={s.muted}>Semanas de segunda a domingo, incluindo a atual em andamento. Fuso: {timeZone}.</Text>
    <Pressable accessibilityRole="button" disabled={isFetching} onPress={() => void refetch()} style={s.refresh}>
      <Text style={s.accent}>{isFetching ? 'Atualizando…' : 'Atualizar dados'}</Text>
    </Pressable>
    {isLoading && <ActivityIndicator color="#4FC3F7" style={s.loading} />}
    {error && <Text accessibilityRole="alert" style={s.error}>Não foi possível atualizar. Toque em “Atualizar dados” para tentar novamente.</Text>}
    {analytics && <>
      {analytics.summary.totalWorkouts === 0 ? <View style={s.card}><Text style={s.name}>Nenhum treino concluído neste período</Text><Text style={s.muted}>Escolha outro período ou conclua um treino para começar seu histórico.</Text></View> : <>
        <Section title="Resumo do período">
          <View style={s.grid}>
            <Tile label="Treinos concluídos" value={number(analytics.summary.totalWorkouts)} />
            <Tile label="Dias com treino" value={number(analytics.summary.activeDays)} />
            <Tile label="Volume · kg × reps" value={number(analytics.summary.totalVolume)} />
            <Tile label="Séries de trabalho" value={number(analytics.summary.totalSets)} />
            <Tile label="Repetições" value={number(analytics.summary.totalReps)} />
            <Tile label="Duração média · min" value={analytics.summary.avgDurationMin === null ? '—' : number(analytics.summary.avgDurationMin)} />
          </View>
          <Text style={s.muted}>{analytics.summary.totalMinutes === null ? 'Duração não registrada.' : `${number(analytics.summary.totalMinutes)} min em ${analytics.summary.timedWorkouts} treinos com duração registrada.`}</Text>
          {analytics.summary.missingVolumeSets > 0 && <Text style={s.muted}>Volume parcial: {analytics.summary.missingVolumeSets} séries sem carga ou blocos completos foram excluídas apenas do volume.</Text>}
        </Section>
        <Section title="Frequência e volume semanal">
          <View style={s.card}>
            <View style={s.options}><Choice label="Treinos" selected={weeklyMetric === 'count'} onPress={() => setWeeklyMetric('count')} /><Choice label="Volume" selected={weeklyMetric === 'volume'} onPress={() => setWeeklyMetric('volume')} /></View>
            <Text style={s.muted}>{period === 'all' ? 'Gráfico das últimas 12 semanas, ou desde o primeiro treino.' : 'Datas indicam o início de cada semana.'} {weeklyMetric === 'volume' ? 'Volume em kg × reps.' : 'Treinos concluídos.'}</Text>
            <Bars unit={weeklyMetric === 'count' ? 'treinos' : 'kg·rep'} points={analytics.frequency.weeks.map((item) => ({ id: item.label, label: weekDate(item.label), value: item[weeklyMetric] }))} />
            <Text style={s.body}>{number(analytics.frequency.workoutsPerWeek)} treinos/semana · {analytics.frequency.consistencyPct}% das semanas com treino</Text>
            <Text style={s.muted}>{analytics.frequency.activeWeeks} de {analytics.frequency.observedWeeks} semanas observadas no período, a partir do primeiro treino. A semana atual é parcial.</Text>
            <Text style={s.body}>{analytics.frequency.streakWeeks} semanas seguidas até agora</Text>
            <Text style={s.muted}>Sequência geral: a semana atual ainda não treinada não interrompe a sequência da semana passada.</Text>
          </View>
        </Section>
        <Section title={`Evolução por exercício · ${analytics.exercises.length}`}>
          {analytics.exercises.length ? <>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.options}>
              {analytics.exercises.map((item) => <Choice key={item.exerciseId} label={item.name} selected={exercise?.exerciseId === item.exerciseId} onPress={() => setExerciseId(item.exerciseId)} />)}
            </ScrollView>
            {exercise && <ExerciseDetail key={`${period}:${exercise.exerciseId}`} exercise={exercise} />}
          </> : <Text style={s.muted}>Sem séries de trabalho concluídas com repetições registradas.</Text>}
        </Section>
        <Section title="Distribuição por grupo muscular">
          <View style={s.card}>
            <Text style={s.muted}>Participação nas séries de trabalho por grupo principal. Não representa ativação muscular nem compara força entre músculos.</Text>
            {analytics.muscleVolume.length === 0 && <Text style={s.muted}>Sem séries elegíveis neste período.</Text>}
            {analytics.muscleVolume.map((muscle) => <View key={muscle.muscleGroup} style={s.row}>
              <Text style={s.body}>{MUSCLES[muscle.muscleGroup] ?? muscle.muscleGroup} · {muscle.pct}%</Text>
              <View style={s.track}><View style={[s.fill, { width: `${muscle.pct}%` }]} /></View>
              <Text style={s.muted}>{muscle.setCount} séries · {number(muscle.volume)} kg × reps</Text>
            </View>)}
          </View>
        </Section>
        <Section title="Recordes pessoais registrados">
          <View style={s.card}>
            <Text style={s.muted}>{analytics.personalRecords.length} séries marcadas como recorde no período. Uma série pode superar mais de uma marca; a primeira referência não é um recorde.</Text>
            {analytics.personalRecords.length === 0 && <Text style={s.body}>Nenhum recorde registrado neste período.</Text>}
            {analytics.personalRecords.slice(0, prCount).map((record, index) => <View key={`${record.exerciseId}:${record.date}:${index}`} style={s.row}>
              <Text style={s.name}>{record.exerciseName}</Text><Text style={s.accent}>{number(record.weightKg)} kg × {record.reps}</Text><Text style={s.muted}>{date(record.date)}</Text>
            </View>)}
            {analytics.personalRecords.length > prCount && <More onPress={() => setPrCount(prCount + 10)} />}
          </View>
        </Section>
        <Section title="Destaques do período">
          <View style={s.card}>
            {([
              ['largestVolume', 'Maior volume registrado', 'kg × reps'],
              ['mostSets', 'Mais séries de trabalho', 'séries'],
              ['longestWorkout', 'Maior duração registrada', 'min'],
            ] as const).map(([key, label, unit]) => {
              const record = analytics.records[key]
              return <View key={key} style={s.row}><Text style={s.body}>{label}</Text>
                <Text style={s.accent}>{record ? `${number(record.value)} ${unit}` : 'Sem registro positivo'}</Text>
                {record && <Text style={s.muted}>{record.workoutName} · {date(record.date)}</Text>}
              </View>
            })}
          </View>
        </Section>
        <Section title="Histórico de treinos">
          <View style={s.card}>
            {analytics.history.slice(0, historyCount).map((session) => <Pressable key={session.sessionId} accessibilityRole="button" accessibilityLabel={`Ver ${session.workoutName}, ${date(session.date)}`} onPress={() => navigation.navigate('WorkoutSession', { sessionId: session.sessionId })} style={s.row}>
              <Text style={s.name}>{session.workoutName}</Text>
              <Text style={s.muted}>{date(session.date)} · {session.durationMin === null ? 'Duração ausente' : `${number(session.durationMin)} min`}</Text>
              <Text style={s.body}>{session.sets} séries · {session.reps} reps · {number(session.volume)} kg × reps</Text>
              {session.personalRecords > 0 && <Text style={s.accent}>{session.personalRecords} séries com recorde</Text>}
            </Pressable>)}
            {analytics.history.length > historyCount && <More onPress={() => setHistoryCount(historyCount + 10)} />}
          </View>
        </Section>
      </>}
      <Section title="Como os números são calculados">
        <Text style={s.muted}>Somente treinos concluídos e séries de trabalho marcadas como feitas, com reps positivas. Aquecimento e feeder não entram nas séries, repetições ou volume. Séries sem carga externa contam nas reps e séries; peso corporal não é estimado. Volume é a soma de carga × reps registradas, incluindo os blocos das técnicas quando disponíveis. Uma técnica conta como uma série.</Text>
      </Section>
    </>}
  </View>
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 12 }, section: { gap: 12, marginTop: 12 },
  title: { color: '#F0F0F5', fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: '#1E1E24', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35', padding: 16, gap: 12 },
  name: { color: '#F0F0F5', fontWeight: '600', fontSize: 15 }, body: { color: '#F0F0F5', fontSize: 13, lineHeight: 20 },
  muted: { color: '#8A8A9A', fontSize: 12, lineHeight: 18 }, accent: { color: '#4FC3F7' },
  error: { color: '#FF5252', lineHeight: 20 }, loading: { padding: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '46%', flexGrow: 1, backgroundColor: '#1E1E24', borderRadius: 12, padding: 14, gap: 6 },
  value: { color: '#F0F0F5', fontSize: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
  options: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#2A2A35', borderRadius: 12 },
  selected: { borderColor: '#4FC3F7', backgroundColor: '#1C303C' }, choiceText: { color: '#8A8A9A', fontSize: 12 },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  row: { borderBottomWidth: 1, borderColor: '#2A2A35', paddingVertical: 12, gap: 6 },
  chart: { flexDirection: 'row', gap: 8, paddingVertical: 12 }, barColumn: { width: 60, alignItems: 'center', gap: 8 },
  barValue: { color: '#F0F0F5', fontSize: 10, fontVariant: ['tabular-nums'] },
  barLabel: { color: '#8A8A9A', fontSize: 10 },
  barTrack: { height: 88, width: 24, backgroundColor: '#141418', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden' },
  bar: { backgroundColor: '#4FC3F7', width: '100%', borderRadius: 4 },
  track: { height: 6, backgroundColor: '#141418', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#4FC3F7' },
})
