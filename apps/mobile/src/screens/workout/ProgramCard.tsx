import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { api } from '../../lib/api'
import type { ProgramRecord, WorkoutRecord, TrainingGoal } from '../../lib/api'

const SPRING_CFG = { damping: 18, stiffness: 180 }

const GOAL_LABELS: Record<TrainingGoal, string> = {
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Força',
  FAT_LOSS: 'Emagrecimento',
  ENDURANCE: 'Resistência',
  HEALTH: 'Saúde',
  PERFORMANCE: 'Performance',
}

const DOT_COLORS = ['#4FC3F7', '#2979FF', '#00E676', '#FFB300', '#FF5252', '#A78BFA']

type Props = {
  program: ProgramRecord
  onEditProgram: (program: ProgramRecord) => void
  onAddWorkout: (programId: string) => void
  onEditWorkout: (workout: WorkoutRecord, programId: string) => void
  onNavigateWorkout: (workout: WorkoutRecord) => void
}

export function ProgramCard({ program, onEditProgram, onAddWorkout, onEditWorkout, onNavigateWorkout }: Props) {
  const qc = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  // Shared values — animations are driven by setting these, never inside useAnimatedStyle
  const progress = useSharedValue(0)
  const contentH = useSharedValue(0)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: progress.value * 90 + 'deg' }],
  }))

  const containerStyle = useAnimatedStyle(() => ({
    height: progress.value * contentH.value,
    overflow: 'hidden',
  }))

  const cardBorderStyle = useAnimatedStyle(() => ({
    borderColor: progress.value > 0.5 ? '#2979FF44' : '#2A2A35',
  }))

  function toggle() {
    const next = isOpen ? 0 : 1
    progress.value = withSpring(next, SPRING_CFG)
    setIsOpen(!isOpen)
  }

  const { data: workoutsData, isLoading: loadingWorkouts } = useQuery({
    queryKey: ['workouts', program.id],
    queryFn: () => api.programs.workouts(program.id),
    enabled: isOpen,
    staleTime: 30_000,
  })

  const workouts = workoutsData?.data.workouts ?? []

  const deleteProgram = useMutation({
    mutationFn: () => api.programs.delete(program.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
    onError: () => Alert.alert('Erro', 'Não foi possível apagar o programa.'),
  })

  const duplicateProgram = useMutation({
    mutationFn: () => api.programs.duplicate(program.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
    onError: () => Alert.alert('Erro', 'Não foi possível duplicar o programa.'),
  })

  const deleteWorkout = useMutation({
    mutationFn: (id: string) => api.workouts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', program.id] })
      qc.invalidateQueries({ queryKey: ['programs'] })
    },
    onError: () => Alert.alert('Erro', 'Não foi possível apagar o treino.'),
  })

  const duplicateWorkout = useMutation({
    mutationFn: (id: string) => api.workouts.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts', program.id] }),
    onError: () => Alert.alert('Erro', 'Não foi possível duplicar o treino.'),
  })

  function showProgramMenu() {
    Alert.alert(program.name, undefined, [
      { text: 'Editar programa', onPress: () => onEditProgram(program) },
      { text: 'Duplicar programa', onPress: () => duplicateProgram.mutate() },
      {
        text: 'Apagar programa', style: 'destructive',
        onPress: () => Alert.alert(
          'Apagar programa',
          'Apagar "' + program.name + '" e todos os treinos?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => deleteProgram.mutate() },
          ]
        ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  function showWorkoutMenu(workout: WorkoutRecord) {
    Alert.alert(workout.name, undefined, [
      { text: 'Editar treino', onPress: () => onEditWorkout(workout, program.id) },
      { text: 'Duplicar treino', onPress: () => duplicateWorkout.mutate(workout.id) },
      {
        text: 'Apagar treino', style: 'destructive',
        onPress: () => Alert.alert(
          'Apagar treino',
          'Apagar "' + workout.name + '"?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => deleteWorkout.mutate(workout.id) },
          ]
        ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const visibleGoals = program.goals.slice(0, 3)
  const extraGoals = program.goals.length - 3

  return (
    <Animated.View style={[s.card, cardBorderStyle]}>
      {/* Header row */}
      <TouchableOpacity style={s.header} onPress={toggle} activeOpacity={0.75}>
        <View style={s.headerLeft}>
          <View style={s.folderIcon}>
            <Ionicons name="folder-outline" size={20} color="#4FC3F7" />
          </View>
          <View style={s.headerInfo}>
            <Text style={s.programName} numberOfLines={1}>{program.name}</Text>
            <View style={s.goalsRow}>
              {visibleGoals.map(g => (
                <View key={g} style={s.goalPill}>
                  <Text style={s.goalPillText}>{GOAL_LABELS[g]}</Text>
                </View>
              ))}
              {extraGoals > 0 && (
                <View style={s.goalPill}>
                  <Text style={s.goalPillText}>{'+' + extraGoals}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={s.headerRight}>
          <Text style={s.workoutCount}>{program.workoutsCount} treinos</Text>
          <TouchableOpacity
            onPress={showProgramMenu}
            style={s.menuBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#8A8A9A" />
          </TouchableOpacity>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-forward" size={18} color="#4FC3F7" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Animated expandable content */}
      <Animated.View style={containerStyle}>
        {/* Measuring view — absolutely positioned so it doesn't affect layout flow */}
        <View
          style={s.measureWrap}
          onLayout={e => { contentH.value = e.nativeEvent.layout.height }}
        >
          <View style={s.divider} />

          {loadingWorkouts ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color="#4FC3F7" />
            </View>
          ) : workouts.map((workout, idx) => (
            <View key={workout.id}>
              <TouchableOpacity
                style={s.workoutRow}
                onPress={() => onNavigateWorkout(workout)}
                activeOpacity={0.75}
              >
                <LinearGradient
                  colors={[DOT_COLORS[idx % DOT_COLORS.length], DOT_COLORS[(idx + 1) % DOT_COLORS.length]]}
                  style={s.workoutDot}
                />
                <View style={s.workoutInfo}>
                  <Text style={s.workoutName} numberOfLines={1}>{workout.name}</Text>
                  <Text style={s.workoutMeta}>{workout.exercisesCount} exercícios</Text>
                </View>
                <TouchableOpacity
                  onPress={() => showWorkoutMenu(workout)}
                  style={s.menuBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color="#8A8A9A" />
                </TouchableOpacity>
              </TouchableOpacity>
              {idx < workouts.length - 1 && <View style={s.rowDivider} />}
            </View>
          ))}

          {/* Add workout row */}
          <TouchableOpacity
            style={s.addWorkoutRow}
            onPress={() => onAddWorkout(program.id)}
            activeOpacity={0.75}
          >
            <Ionicons name="add-circle-outline" size={18} color="#4FC3F7" />
            <Text style={s.addWorkoutText}>Adicionar treino</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E24', borderRadius: 16,
    borderWidth: 1, borderColor: '#2A2A35',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, minWidth: 0 },
  folderIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(79,195,247,0.1)', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  headerInfo: { flex: 1, minWidth: 0, gap: 5 },
  programName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  goalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  goalPill: {
    backgroundColor: 'rgba(41,121,255,0.09)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  goalPillText: { color: '#4FC3F7', fontSize: 11 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  workoutCount: { color: '#8A8A9A', fontSize: 12 },
  menuBtn: { padding: 2 },

  measureWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  divider: { height: 1, backgroundColor: '#2A2A35', marginHorizontal: 16 },
  loadingRow: { height: 48, justifyContent: 'center', alignItems: 'center' },
  workoutRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, minHeight: 44, gap: 12,
  },
  workoutDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  workoutInfo: { flex: 1, gap: 2 },
  workoutName: { color: '#F0F0F5', fontSize: 14 },
  workoutMeta: { color: '#8A8A9A', fontSize: 12 },
  rowDivider: { height: 1, backgroundColor: '#2A2A35', marginLeft: 38 },
  addWorkoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#2A2A35', borderStyle: 'dashed',
  },
  addWorkoutText: { color: '#4FC3F7', fontSize: 14 },
})
