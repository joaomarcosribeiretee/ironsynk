import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DragSortableList } from '../../components/DragSortableList'
import { api } from '../../lib/api'
import type { ProgramRecord, WorkoutRecord } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { ProgramCard } from './ProgramCard'
import { ProgramModal } from './ProgramModal'
import { WorkoutModal } from './WorkoutModal'
import { FreeWorkoutInfoModal } from './FreeWorkoutInfoModal'
import { Toast, showToast } from '../../components/Toast'

const FREE_WORKOUT_KEY = 'hasSeenFreeWorkoutModal'
const PROGRAMS_ORDER_KEY = 'programs_order'

function applyOrder(programs: ProgramRecord[], savedOrder: string[]): ProgramRecord[] {
  if (!savedOrder.length) return programs
  const map = new Map(programs.map(p => [p.id, p]))
  const ordered: ProgramRecord[] = []
  for (const id of savedOrder) {
    const p = map.get(id)
    if (p) ordered.push(p)
  }
  // append any programs not in saved order (newly created)
  for (const p of programs) {
    if (!savedOrder.includes(p.id)) ordered.push(p)
  }
  return ordered
}

export function WorkoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const qc = useQueryClient()

  const [programModal, setProgramModal] = useState<{ open: boolean; editing: ProgramRecord | null }>({ open: false, editing: null })
  const [workoutModal, setWorkoutModal] = useState<{ open: boolean; programId: string | null; editing: WorkoutRecord | null }>({ open: false, programId: null, editing: null })
  const [freeWorkoutModal, setFreeWorkoutModal] = useState(false)
  const [orderedPrograms, setOrderedPrograms] = useState<ProgramRecord[]>([])
  const [dragging, setDragging] = useState(false)
  const savedOrderRef = useRef<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.programs.list(),
    staleTime: 30_000,
  })
  const programs = data?.data.programs ?? []

  useEffect(() => {
    async function loadOrder() {
      const raw = await SecureStore.getItemAsync(PROGRAMS_ORDER_KEY).catch(() => null)
      const order: string[] = raw ? JSON.parse(raw) : []
      savedOrderRef.current = order
      setOrderedPrograms(applyOrder(data?.data.programs ?? [], order))
    }
    loadOrder()
  }, [data])

  const createProgram = useMutation({
    mutationFn: (body: Parameters<typeof api.programs.create>[0]) => api.programs.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  })

  const updateProgram = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.programs.update>[1]) =>
      api.programs.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); showToast('Programa atualizado') },
  })

  const createWorkout = useMutation({
    mutationFn: (body: Parameters<typeof api.workouts.create>[0]) => api.workouts.create(body),
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['workouts', vars.programId] })
      qc.invalidateQueries({ queryKey: ['programs'] })
      navigation.navigate('WorkoutDetail', { workoutId: result.data.workout.id })
    },
  })

  const updateWorkout = useMutation({
    mutationFn: ({ id, programId, ...body }: { id: string; programId: string } & Parameters<typeof api.workouts.update>[1]) =>
      api.workouts.update(id, body),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['workouts', vars.programId] }); showToast('Treino atualizado') },
  })

  const openCreateProgram = useCallback(() => setProgramModal({ open: true, editing: null }), [])
  const openEditProgram = useCallback((p: ProgramRecord) => setProgramModal({ open: true, editing: p }), [])
  const openAddWorkout = useCallback((programId: string) => setWorkoutModal({ open: true, programId, editing: null }), [])
  const navigateToWorkout = useCallback((w: WorkoutRecord) => navigation.navigate('WorkoutDetail', { workoutId: w.id }), [navigation])
  const navigateToView = useCallback((w: WorkoutRecord) => navigation.navigate('WorkoutView', { workoutId: w.id }), [navigation])

  async function handleTrenoLivre() {
    const seen = await SecureStore.getItemAsync(FREE_WORKOUT_KEY)
    if (seen) {
      navigation.navigate('WorkoutExecution', {})
    } else {
      setFreeWorkoutModal(true)
    }
  }

  async function handleFreeWorkoutConfirm() {
    setFreeWorkoutModal(false)
    navigation.navigate('WorkoutExecution', {})
  }

  async function handleFreeWorkoutDismissForever() {
    await SecureStore.setItemAsync(FREE_WORKOUT_KEY, 'true')
    setFreeWorkoutModal(false)
    navigation.navigate('WorkoutExecution', {})
  }

  async function handleSaveProgram(data: { name: string; description?: string }) {
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

  async function handleProgramDragEnd(data: ProgramRecord[]) {
    setOrderedPrograms(data)
    const order = data.map(p => p.id)
    savedOrderRef.current = order
    await SecureStore.setItemAsync(PROGRAMS_ORDER_KEY, JSON.stringify(order)).catch(() => {})
  }

  const ListHeader = (
    <View>
      <TouchableOpacity onPress={handleTrenoLivre} activeOpacity={0.85}>
        <LinearGradient colors={['#2979FF', '#1A237E']} style={s.freeBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={s.freeBtnText}>Iniciar Treino Livre</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>
      <Text style={s.freeSub}>Sem programa · Sessão livre</Text>
      <View style={s.spacer} />
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>PROGRAMAS</Text>
        <TouchableOpacity onPress={openCreateProgram} activeOpacity={0.7}>
          <View style={s.novoBtn}>
            <Text style={s.novoBtnText}>Novo +</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  const ListEmpty = isLoading ? (
    <View>
      {[0, 1, 2].map(i => (
        <View key={i} style={s.skeleton}>
          <View style={s.skeletonLeft}>
            <View style={s.skeletonChev} />
            <View style={{ gap: 6, flex: 1 }}>
              <View style={[s.skeletonLine, { width: '52%' }]} />
              <View style={[s.skeletonLine, { width: '28%', height: 10 }]} />
            </View>
          </View>
          <View style={[s.skeletonLine, { width: 52, height: 10 }]} />
        </View>
      ))}
    </View>
  ) : (
    <View style={s.emptyState}>
      <View style={s.emptyIconWrap}>
        <Ionicons name="barbell-outline" size={28} color="#4FC3F7" />
      </View>
      <Text style={s.emptyTitle}>Nenhum programa</Text>
      <Text style={s.emptySub}>Crie seu primeiro programa de treino</Text>
      <TouchableOpacity onPress={openCreateProgram} activeOpacity={0.85} style={s.emptyBtnWrap}>
        <LinearGradient colors={['#2979FF', '#1565C0']} style={s.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={s.emptyBtnText}>Criar programa</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Treino</Text>
        <TouchableOpacity onPress={openCreateProgram} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add-outline" size={26} color="#F0F0F5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        {ListHeader}
        {isLoading || programs.length === 0 ? ListEmpty : (
          <DragSortableList
            data={orderedPrograms}
            keyExtractor={p => p.id}
            renderItem={({ item: program, drag, isActive }) => (
              <ProgramCard
                key={program.id}
                program={program}
                onEditProgram={openEditProgram}
                onAddWorkout={openAddWorkout}
                onNavigateWorkout={navigateToWorkout}
                onViewWorkout={navigateToView}
                onDrag={drag}
                isDragging={isActive}
                onWorkoutDragStart={() => setDragging(true)}
                onWorkoutDragEnd={() => setDragging(false)}
              />
            )}
            onReorder={handleProgramDragEnd}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
            itemHeight={64}
          />
        )}
      </ScrollView>

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

      <Toast />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: { color: '#F0F0F5', fontSize: 26, fontWeight: '500' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  freeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  freeBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  freeSub: { color: '#8A8A9A', fontSize: 12, textAlign: 'center', marginTop: 8 },

  spacer: { height: 24 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  novoBtn: {
    backgroundColor: 'rgba(41,121,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  novoBtnText: { color: '#4FC3F7', fontSize: 13, fontWeight: '500' },

  skeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 58,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A35',
  },
  skeletonLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  skeletonChev: { width: 16, height: 16, borderRadius: 4, backgroundColor: '#2A2A35' },
  skeletonLine: { height: 13, borderRadius: 6, backgroundColor: '#2A2A35' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(79,195,247,0.08)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500' },
  emptySub: { color: '#8A8A9A', fontSize: 14, marginBottom: 4 },
  emptyBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
})
