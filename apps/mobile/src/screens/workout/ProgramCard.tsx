import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ProgramRecord, WorkoutRecord, TrainingGoal } from '../../lib/api'

const GOAL_LABELS: Record<TrainingGoal, string> = {
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Força',
  FAT_LOSS: 'Emagrecimento',
  ENDURANCE: 'Resistência',
  HEALTH: 'Saúde',
  PERFORMANCE: 'Performance',
}

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
  const [contentH, setContentH] = useState(0)
  const progress = useRef(new Animated.Value(0)).current

  const chevronRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] })
  const containerHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentH] })
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] })

  function toggle() {
    const toValue = isOpen ? 0 : 1
    Animated.spring(progress, {
      toValue, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: false,
    }).start()
    setIsOpen(v => !v)
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
          `Apagar "${program.name}" e todos os treinos?`,
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
          `Apagar "${workout.name}"?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => deleteWorkout.mutate(workout.id) },
          ]
        ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const visibleGoals = program.goals.slice(0, 2)

  return (
    <View>
      {/* Program row */}
      <TouchableOpacity style={s.row} onPress={toggle} activeOpacity={0.7}>
        <View style={s.rowLeft}>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }], flexShrink: 0 }}>
            <Ionicons name="chevron-forward-outline" size={16} color="#4FC3F7" />
          </Animated.View>
          <View style={s.nameBlock}>
            <Text style={s.programName} numberOfLines={1}>{program.name}</Text>
            {visibleGoals.length > 0 && (
              <View style={s.pillsRow}>
                {visibleGoals.map(g => (
                  <View key={g} style={s.pill}>
                    <Text style={s.pillText}>{GOAL_LABELS[g]}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        <View style={s.rowRight}>
          <Text style={s.countText}>{program.workoutsCount} treinos</Text>
          <TouchableOpacity
            onPress={showProgramMenu}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#8A8A9A" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Expandable content */}
      <Animated.View style={{ height: containerHeight, overflow: 'hidden' }}>
        <View
          style={s.measureWrap}
          onLayout={e => setContentH(e.nativeEvent.layout.height)}
        >
          <Animated.View style={[s.workoutsWrap, { opacity: contentOpacity }]}>
            {loadingWorkouts ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color="#4FC3F7" />
              </View>
            ) : workouts.map((workout, idx) => {
              const isFirst = idx === 0
              const isLast = idx === workouts.length - 1
              return (
                <View
                  key={workout.id}
                  style={[
                    s.workoutRow,
                    isFirst && s.workoutRowFirst,
                    isLast && s.workoutRowLast,
                    idx > 0 && { marginTop: 2 },
                  ]}
                >
                  <TouchableOpacity
                    style={s.playBtn}
                    onPress={() => onNavigateWorkout(workout)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#4FC3F7" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.workoutInfo}
                    onPress={() => onNavigateWorkout(workout)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.workoutName} numberOfLines={1}>{workout.name}</Text>
                    <Text style={s.workoutMeta}>{workout.exercisesCount} exercícios</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => showWorkoutMenu(workout)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color="#8A8A9A" />
                  </TouchableOpacity>
                </View>
              )
            })}

            <TouchableOpacity
              style={s.addRow}
              onPress={() => onAddWorkout(program.id)}
              activeOpacity={0.7}
            >
              <Text style={s.addText}>+ Adicionar treino</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A35',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, minWidth: 0 },
  nameBlock: { flex: 1, minWidth: 0, gap: 3 },
  programName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  pillsRow: { flexDirection: 'row', gap: 4 },
  pill: {
    backgroundColor: 'rgba(41,121,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.22)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: { color: '#4FC3F7', fontSize: 10 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  countText: { color: '#8A8A9A', fontSize: 12 },

  measureWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  workoutsWrap: { paddingLeft: 28, paddingVertical: 8, paddingRight: 0 },
  loadingRow: { height: 52, justifyContent: 'center', alignItems: 'center' },

  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#1A1A20',
    paddingHorizontal: 12,
    gap: 10,
  },
  workoutRowFirst: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  workoutRowLast: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },

  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(41,121,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  workoutInfo: { flex: 1, minWidth: 0 },
  workoutName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  workoutMeta: { color: '#8A8A9A', fontSize: 12, marginTop: 1 },

  addRow: {
    height: 44,
    marginTop: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A2A35',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: { color: '#4FC3F7', fontSize: 14 },
})
