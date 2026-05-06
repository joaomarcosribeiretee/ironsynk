import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { ActionSheet } from './ActionSheet'

const EQUIP_PT: Record<string, string> = {
  barbell: 'Barra',
  dumbbell: 'Haltere',
  cable: 'Cabo',
  machine: 'Máquina',
  bodyweight: 'Peso Corporal',
  'body weight': 'Peso Corporal',
  smith: 'Smith',
  kettlebell: 'Kettlebell',
  band: 'Elástico',
  other: 'Outro',
}
const txEquip = (eq: string | null | undefined) =>
  eq ? (EQUIP_PT[eq.toLowerCase()] ?? eq) : '—'

function formatRest(s: number | null): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  if (sec === 0) return `${m}min`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function WorkoutViewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const route = useRoute<RouteProp<AppStackParamList, 'WorkoutView'>>()
  const { workoutId } = route.params
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => api.workouts.get(workoutId),
    staleTime: 30_000,
  })

  const workout = data?.data.workout
  const exercises = workout?.exercises ?? []

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{workout?.name ?? ''}</Text>
        <TouchableOpacity
          style={s.menuBtn}
          onPress={() => setSheetOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#8A8A9A" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {workout?.notes ? (
            <>
              <Text style={s.description}>{workout.notes}</Text>
              <View style={s.divider} />
            </>
          ) : null}

          {exercises.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="barbell-outline" size={48} color="#2A2A35" />
              <Text style={s.emptyTitle}>Nenhum exercício</Text>
              <Text style={s.emptySub}>Este treino ainda não tem exercícios</Text>
            </View>
          ) : (
            exercises.map((te, idx) => (
              <View key={te.id} style={s.card}>
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
                    <View style={s.exNameRow}>
                      <Text style={s.exNum}>{idx + 1}.</Text>
                      <Text style={s.exName} numberOfLines={1}>{te.exercise.name}</Text>
                    </View>
                    {te.exercise.equipment ? (
                      <View style={s.equipPill}>
                        <Text style={s.equipPillText}>{txEquip(te.exercise.equipment)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {te.notes ? (
                  <Text style={s.exerciseNotes}>{te.notes}</Text>
                ) : null}

                <View style={s.statsRow}>
                  <View style={s.stat}>
                    <Text style={s.statValue}>{te.sets.length || te.targetSets}</Text>
                    <Text style={s.statLabel}>série{(te.sets.length || te.targetSets) !== 1 ? 's' : ''}</Text>
                  </View>
                  {te.targetReps ? (
                    <>
                      <View style={s.statDot} />
                      <View style={s.stat}>
                        <Text style={s.statValue}>{te.targetReps}</Text>
                        <Text style={s.statLabel}>reps</Text>
                      </View>
                    </>
                  ) : null}
                  {te.restSeconds != null ? (
                    <>
                      <View style={s.statDot} />
                      <View style={s.stat}>
                        <Text style={s.statValue}>{formatRest(te.restSeconds)}</Text>
                        <Text style={s.statLabel}>descanso</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <ActionSheet
        visible={sheetOpen}
        title={workout?.name}
        actions={[
          {
            label: 'Editar treino',
            onPress: () => navigation.navigate('WorkoutDetail', { workoutId }),
          },
          { label: 'Cancelar', cancel: true, onPress: () => {} },
        ]}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 19, fontWeight: '500' },
  menuBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  description: {
    color: '#8A8A9A',
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 14,
  },
  divider: { height: 1, backgroundColor: '#2A2A35', marginBottom: 16 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },

  card: {
    backgroundColor: '#1E1E24',
    borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  imgContainer: {
    width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  cardMid: { flex: 1 },
  exNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  exNum: { color: '#555560', fontSize: 12, fontWeight: '600', flexShrink: 0 },
  exName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500', flex: 1 },
  equipPill: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5, alignSelf: 'flex-start',
  },
  equipPillText: { color: '#8A8A9A', fontSize: 11 },

  exerciseNotes: {
    color: '#8A8A9A',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#252530',
  },
  stat: { alignItems: 'center', minWidth: 40 },
  statValue: { color: '#F0F0F5', fontSize: 18, fontWeight: '600' },
  statLabel: { color: '#555560', fontSize: 11, marginTop: 2 },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#2A2A35' },
})
