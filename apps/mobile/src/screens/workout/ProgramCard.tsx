import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ProgramRecord, WorkoutRecord, TrainingGoal } from '../../lib/api'
import { ActionSheet, type SheetAction } from './ActionSheet'

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
  const [sheet, setSheet] = useState<{ visible: boolean; title: string; actions: SheetAction[] }>({
    visible: false, title: '', actions: [],
  })

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
    setSheet({
      visible: true,
      title: program.name,
      actions: [
        { label: 'Editar programa', onPress: () => onEditProgram(program) },
        { label: 'Duplicar programa', onPress: () => duplicateProgram.mutate() },
        {
          label: 'Apagar programa', destructive: true,
          onPress: () => Alert.alert(
            'Apagar programa',
            `Apagar "${program.name}" e todos os treinos?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => deleteProgram.mutate() },
            ]
          ),
        },
        { label: 'Cancelar', cancel: true, onPress: () => {} },
      ],
    })
  }

  function showWorkoutMenu(workout: WorkoutRecord) {
    setSheet({
      visible: true,
      title: workout.name,
      actions: [
        { label: 'Editar treino', onPress: () => onEditWorkout(workout, program.id) },
        { label: 'Duplicar treino', onPress: () => duplicateWorkout.mutate(workout.id) },
        {
          label: 'Apagar treino', destructive: true,
          onPress: () => Alert.alert(
            'Apagar treino',
            `Apagar "${workout.name}"?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => deleteWorkout.mutate(workout.id) },
            ]
          ),
        },
        { label: 'Cancelar', cancel: true, onPress: () => {} },
      ],
    })
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
            <Ionicons name="ellipsis-horizontal" size={22} color="#8A8A9A" />
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
            ) : workouts.map(workout => (
              <View key={workout.id} style={s.workoutRow}>
                <TouchableOpacity
                  onPress={() => onNavigateWorkout(workout)}
                  activeOpacity={0.8}
                  style={s.playBtn}
                >
                  <LinearGradient
                    colors={['#2979FF', '#1565C0']}
                    style={s.playGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="play" size={16} color="#fff" />
                  </LinearGradient>
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
                  <Ionicons name="ellipsis-horizontal" size={20} color="#555560" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={s.addRow}
              onPress={() => onAddWorkout(program.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color="#4FC3F7" />
              <Text style={s.addText}>Adicionar treino</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      <ActionSheet
        visible={sheet.visible}
        title={sheet.title}
        actions={sheet.actions}
        onClose={() => setSheet(s => ({ ...s, visible: false }))}
      />
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A35',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, minWidth: 0 },
  nameBlock: { flex: 1, minWidth: 0, gap: 5 },
  programName: { color: '#F0F0F5', fontSize: 17, fontWeight: '500' },
  pillsRow: { flexDirection: 'row', gap: 4 },
  pill: {
    backgroundColor: '#2979FF18',
    borderWidth: 1,
    borderColor: '#2979FF35',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: '#4FC3F7', fontSize: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  countText: { color: '#8A8A9A', fontSize: 13 },

  measureWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  workoutsWrap: { paddingVertical: 10 },
  loadingRow: { height: 68, justifyContent: 'center', alignItems: 'center' },

  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    backgroundColor: '#1A1A22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252530',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  playBtn: { flexShrink: 0 },
  playGrad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutInfo: { flex: 1, minWidth: 0 },
  workoutName: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  workoutMeta: { color: '#8A8A9A', fontSize: 13, marginTop: 3 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    marginBottom: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#2A2A35',
    borderRadius: 12,
  },
  addText: { color: '#4FC3F7', fontSize: 14 },
})
