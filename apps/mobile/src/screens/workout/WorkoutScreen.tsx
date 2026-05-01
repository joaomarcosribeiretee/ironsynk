import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { ProgramRecord, WorkoutRecord } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { ProgramCard } from './ProgramCard'
import { ProgramModal } from './ProgramModal'
import { WorkoutModal } from './WorkoutModal'
import { FreeWorkoutInfoModal } from './FreeWorkoutInfoModal'

const FREE_WORKOUT_KEY = 'hasSeenFreeWorkoutModal'

export function WorkoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const qc = useQueryClient()

  const [programModal, setProgramModal] = useState<{ open: boolean; editing: ProgramRecord | null }>({ open: false, editing: null })
  const [workoutModal, setWorkoutModal] = useState<{ open: boolean; programId: string | null; editing: WorkoutRecord | null }>({ open: false, programId: null, editing: null })
  const [freeWorkoutModal, setFreeWorkoutModal] = useState(false)

  // Programs query
  const { data, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.programs.list(),
    staleTime: 30_000,
  })
  const programs = data?.data.programs ?? []

  // Create program
  const createProgram = useMutation({
    mutationFn: (body: Parameters<typeof api.programs.create>[0]) => api.programs.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  })

  // Update program
  const updateProgram = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.programs.update>[1]) =>
      api.programs.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  })

  // Create workout
  const createWorkout = useMutation({
    mutationFn: (body: Parameters<typeof api.workouts.create>[0]) => api.workouts.create(body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['workouts', vars.programId] })
      qc.invalidateQueries({ queryKey: ['programs'] })
    },
  })

  // Update workout
  const updateWorkout = useMutation({
    mutationFn: ({ id, programId, ...body }: { id: string; programId: string } & Parameters<typeof api.workouts.update>[1]) =>
      api.workouts.update(id, body),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workouts', vars.programId] }),
  })

  const openCreateProgram = useCallback(() => setProgramModal({ open: true, editing: null }), [])
  const openEditProgram = useCallback((p: ProgramRecord) => setProgramModal({ open: true, editing: p }), [])
  const openAddWorkout = useCallback((programId: string) => setWorkoutModal({ open: true, programId, editing: null }), [])
  const openEditWorkout = useCallback((w: WorkoutRecord, programId: string) => setWorkoutModal({ open: true, programId, editing: w }), [])
  const navigateToWorkout = useCallback((w: WorkoutRecord) => navigation.navigate('WorkoutDetail', { workoutId: w.id }), [navigation])

  async function handleTrenoLivre() {
    const seen = await SecureStore.getItemAsync(FREE_WORKOUT_KEY)
    if (seen) {
      navigation.navigate('FreeWorkout')
    } else {
      setFreeWorkoutModal(true)
    }
  }

  async function handleFreeWorkoutConfirm() {
    setFreeWorkoutModal(false)
    navigation.navigate('FreeWorkout')
  }

  async function handleFreeWorkoutDismissForever() {
    await SecureStore.setItemAsync(FREE_WORKOUT_KEY, 'true')
    setFreeWorkoutModal(false)
    navigation.navigate('FreeWorkout')
  }

  async function handleSaveProgram(data: { name: string; goals: Parameters<typeof api.programs.create>[0]['goals']; description?: string }) {
    if (programModal.editing) {
      await updateProgram.mutateAsync({ id: programModal.editing.id, ...data })
    } else {
      await createProgram.mutateAsync(data)
    }
  }

  async function handleSaveWorkout(data: { name: string; description?: string }) {
    if (workoutModal.editing && workoutModal.programId) {
      await updateWorkout.mutateAsync({ id: workoutModal.editing.id, programId: workoutModal.programId, ...data })
    } else if (workoutModal.programId) {
      await createWorkout.mutateAsync({ programId: workoutModal.programId, ...data })
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Treino</Text>
        <TouchableOpacity onPress={openCreateProgram} style={s.addBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add-outline" size={26} color="#F0F0F5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Treino Livre card */}
        <TouchableOpacity onPress={handleTrenoLivre} activeOpacity={0.8} style={s.freeCard}>
          <LinearGradient colors={['#4FC3F7', '#2979FF']} style={s.freeIconCircle}>
            <Ionicons name="flash-outline" size={18} color="#fff" />
          </LinearGradient>
          <View style={s.freeCardInfo}>
            <Text style={s.freeCardTitle}>Treino Livre</Text>
            <Text style={s.freeCardSub}>Comece agora sem um programa</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color="#4FC3F7" />
        </TouchableOpacity>

        {/* Section header */}
        <Text style={s.sectionHeader}>MEUS PROGRAMAS</Text>

        {/* Programs list */}
        {isLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color="#4FC3F7" />
          </View>
        ) : programs.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>💪</Text>
            <Text style={s.emptyTitle}>Nenhum programa criado</Text>
            <Text style={s.emptySub}>Crie seu primeiro programa de treino</Text>
            <TouchableOpacity onPress={openCreateProgram} activeOpacity={0.85} style={s.emptyBtnWrap}>
              <LinearGradient colors={['#4FC3F7', '#2979FF']} style={s.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.emptyBtnText}>Criar programa</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.programsList}>
            {programs.map(program => (
              <ProgramCard
                key={program.id}
                program={program}
                onEditProgram={openEditProgram}
                onAddWorkout={openAddWorkout}
                onEditWorkout={openEditWorkout}
                onNavigateWorkout={navigateToWorkout}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <ProgramModal
        visible={programModal.open}
        editingProgram={programModal.editing}
        onClose={() => setProgramModal({ open: false, editing: null })}
        onSave={handleSaveProgram}
      />

      <WorkoutModal
        visible={workoutModal.open}
        programId={workoutModal.programId}
        editingWorkout={workoutModal.editing}
        onClose={() => setWorkoutModal({ open: false, programId: null, editing: null })}
        onSave={handleSaveWorkout}
      />

      <FreeWorkoutInfoModal
        visible={freeWorkoutModal}
        onConfirm={handleFreeWorkoutConfirm}
        onDismissForever={handleFreeWorkoutDismissForever}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  headerTitle: { color: '#F0F0F5', fontSize: 24, fontWeight: '500' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  freeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1E1E24', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#2A2A35', marginBottom: 20,
  },
  freeIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  freeCardInfo: { flex: 1 },
  freeCardTitle: { color: '#F0F0F5', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  freeCardSub: { color: '#8A8A9A', fontSize: 13 },

  sectionHeader: {
    color: '#8A8A9A', fontSize: 13, fontWeight: '600', letterSpacing: 0.8,
    marginBottom: 12,
  },

  centered: { paddingVertical: 40, alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#8A8A9A', fontSize: 14, marginBottom: 8 },
  emptyBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  emptyBtn: { paddingVertical: 13, paddingHorizontal: 28 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  programsList: { gap: 12 },
})
