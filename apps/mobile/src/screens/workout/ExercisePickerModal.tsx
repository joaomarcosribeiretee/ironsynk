import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  FlatList, Modal, ActivityIndicator, Image, Pressable, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ExerciseRecord } from '../../lib/api'

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
const txEquip = (s: string | null | undefined) =>
  s ? (EQUIP_PT[s.toLowerCase()] ?? s) : '—'

const MUSCLE_GROUPS = [
  { label: 'Todos', value: '' },
  { label: 'Peito', value: 'CHEST' },
  { label: 'Costas', value: 'BACK' },
  { label: 'Ombros', value: 'SHOULDERS' },
  { label: 'Bíceps', value: 'BICEPS' },
  { label: 'Tríceps', value: 'TRICEPS' },
  { label: 'Antebraços', value: 'FOREARMS' },
  { label: 'Quadríceps', value: 'QUADS' },
  { label: 'Posteriores', value: 'HAMSTRINGS' },
  { label: 'Glúteos', value: 'GLUTES' },
  { label: 'Panturrilhas', value: 'CALVES' },
  { label: 'Abdômen', value: 'ABS' },
  { label: 'Corpo Inteiro', value: 'FULL_BODY' },
]

const EQUIPMENT = [
  { label: 'Todos', value: '' },
  { label: 'Barra', value: 'barbell' },
  { label: 'Haltere', value: 'dumbbell' },
  { label: 'Cabo', value: 'cable' },
  { label: 'Máquina', value: 'machine' },
  { label: 'Peso Corporal', value: 'bodyweight' },
  { label: 'Smith', value: 'smith' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Outro', value: 'other' },
]

type Props = {
  visible: boolean
  mode: 'add' | 'replace'
  workoutId: string
  replaceTargetId: string | null
  existingExerciseIds?: string[]
  onClose: () => void
  onAdded: () => void
  onReplaced: () => void
}

type FilterPickerProps = {
  visible: boolean
  title: string
  options: { label: string; value: string }[]
  selected: string
  onSelect: (value: string) => void
  onClose: () => void
}

function FilterPicker({ visible, title, options, selected, onSelect, onClose }: FilterPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={fp.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={fp.sheet}>
          <Text style={fp.title}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={fp.option}
                onPress={() => { onSelect(opt.value); onClose() }}
                activeOpacity={0.7}
              >
                <Text style={[fp.optionText, selected === opt.value && fp.optionActive]}>
                  {opt.label}
                </Text>
                {selected === opt.value && (
                  <Ionicons name="checkmark" size={16} color="#4FC3F7" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export function ExercisePickerModal({
  visible, mode, workoutId, replaceTargetId, existingExerciseIds = [], onClose, onAdded, onReplaced,
}: Props) {
  const insets = useSafeAreaInsets()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [musclePickerOpen, setMusclePickerOpen] = useState(false)
  const [equipPickerOpen, setEquipPickerOpen] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [search])

  useEffect(() => {
    if (!visible) {
      setSearch('')
      setDebouncedSearch('')
      setSelectedMuscle('')
      setSelectedEquipment('')
      setSelectedIds(new Set())
      setIsSubmitting(false)
    }
  }, [visible])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['exercises-picker', debouncedSearch, selectedMuscle, selectedEquipment],
    queryFn: ({ pageParam }) =>
      api.exercises.list({
        search: debouncedSearch || undefined,
        muscleGroup: selectedMuscle || undefined,
        equipment: selectedEquipment || undefined,
        limit: 30,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((s, p) => s + p.data.exercises.length, 0)
      return loaded < lastPage.data.total ? loaded : undefined
    },
    enabled: visible,
  })

  const exercises = data?.pages.flatMap(p => p.data.exercises) ?? []

  function toggleSelect(ex: ExerciseRecord) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(ex.id)) next.delete(ex.id)
      else next.add(ex.id)
      return next
    })
  }

  async function handleAddSelected() {
    if (isSubmitting || selectedIds.size === 0) return
    setIsSubmitting(true)
    try {
      await Promise.all(
        [...selectedIds].map(id => api.workouts.addExercise(workoutId, { exerciseId: id }))
      )
      onAdded()
    } catch {}
    finally {
      setIsSubmitting(false)
    }
  }

  async function handleReplace(ex: ExerciseRecord) {
    if (!replaceTargetId || isSubmitting) return
    setIsSubmitting(true)
    try {
      await api.trainingExercises.replace(replaceTargetId, { newExerciseId: ex.id })
      onReplaced()
    } catch {}
    finally {
      setIsSubmitting(false)
    }
  }

  const muscleLabel = MUSCLE_GROUPS.find(m => m.value === selectedMuscle)?.label ?? 'Todos'
  const equipLabel = EQUIPMENT.find(e => e.value === selectedEquipment)?.label ?? 'Todos'

  function renderExercise({ item: ex }: { item: ExerciseRecord }) {
    const isSelected = selectedIds.has(ex.id)
    const alreadyIn = existingExerciseIds.includes(ex.id)

    return (
      <TouchableOpacity
        style={[s.exRow, isSelected && s.exRowSelected, alreadyIn && s.exRowDim]}
        onPress={() => {
          if (alreadyIn) return
          mode === 'add' ? toggleSelect(ex) : handleReplace(ex)
        }}
        activeOpacity={alreadyIn ? 1 : 0.75}
      >
        <View style={s.exImgWrap}>
          {ex.gifUrl ? (
            <>
              <Image source={{ uri: ex.gifUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', isSelected ? 'rgba(30,58,92,0.95)' : '#141418']}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View style={s.exImgPlaceholder}>
              <Ionicons name="barbell-outline" size={18} color="#4A4A5A" />
            </View>
          )}
        </View>

        <View style={s.exInfo}>
          <Text style={[s.exName, alreadyIn && s.exNameDim]} numberOfLines={1}>{ex.name}</Text>
          <Text style={s.exEquip}>{alreadyIn ? 'Já adicionado' : txEquip(ex.equipment)}</Text>
        </View>

        <View style={s.exAction}>
          {alreadyIn ? (
            <Ionicons name="checkmark-circle" size={22} color="#2A2A35" />
          ) : mode === 'add' ? (
            isSelected ? (
              <View style={s.checkCircle}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            ) : (
              <View style={s.addCircle}>
                <Ionicons name="add" size={18} color="#4FC3F7" />
              </View>
            )
          ) : (
            isSubmitting ? (
              <ActivityIndicator size="small" color="#4FC3F7" />
            ) : (
              <Text style={s.replaceText}>Substituir</Text>
            )
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{mode === 'add' ? 'Adicionar Exercício' : 'Substituir Exercício'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#8A8A9A" />
          </TouchableOpacity>
        </View>

        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color="#555560" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar exercício..."
            placeholderTextColor="#4A4A5A"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#555560" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterBtn, selectedMuscle !== '' && s.filterBtnActive]}
            onPress={() => setMusclePickerOpen(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name="body-outline"
              size={13}
              color={selectedMuscle !== '' ? '#4FC3F7' : '#8A8A9A'}
              style={{ marginRight: 5 }}
            />
            <Text style={[s.filterBtnText, selectedMuscle !== '' && s.filterBtnTextActive]} numberOfLines={1}>
              {muscleLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={selectedMuscle !== '' ? '#4FC3F7' : '#555560'} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterBtn, selectedEquipment !== '' && s.filterBtnActive]}
            onPress={() => setEquipPickerOpen(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name="barbell-outline"
              size={13}
              color={selectedEquipment !== '' ? '#4FC3F7' : '#8A8A9A'}
              style={{ marginRight: 5 }}
            />
            <Text style={[s.filterBtnText, selectedEquipment !== '' && s.filterBtnTextActive]} numberOfLines={1}>
              {equipLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={selectedEquipment !== '' ? '#4FC3F7' : '#555560'} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {(selectedMuscle !== '' || selectedEquipment !== '') && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => { setSelectedMuscle(''); setSelectedEquipment('') }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={13} color="#8A8A9A" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.separator} />

        <FlatList
          data={exercises}
          keyExtractor={ex => ex.id}
          renderItem={renderExercise}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            isLoading ? (
              <View style={s.listEmpty}>
                <ActivityIndicator color="#4FC3F7" />
              </View>
            ) : (
              <View style={s.listEmpty}>
                <Text style={s.emptyText}>Nenhum exercício encontrado</Text>
              </View>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={s.listFooter}>
                <ActivityIndicator color="#4FC3F7" />
              </View>
            ) : null
          }
        />

        {mode === 'add' && selectedIds.size > 0 && (
          <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity
              style={[s.ctaBtn, isSubmitting && s.ctaBtnDisabled]}
              onPress={handleAddSelected}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#4FC3F7" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={16} color="#4FC3F7" />
                  <Text style={s.ctaBtnText}>
                    Adicionar {selectedIds.size} exercício{selectedIds.size !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      </View>
      <FilterPicker
        visible={musclePickerOpen}
        title="Grupo muscular"
        options={MUSCLE_GROUPS}
        selected={selectedMuscle}
        onSelect={setSelectedMuscle}
        onClose={() => setMusclePickerOpen(false)}
      />
      <FilterPicker
        visible={equipPickerOpen}
        title="Equipamento"
        options={EQUIPMENT}
        selected={selectedEquipment}
        onSelect={setSelectedEquipment}
        onClose={() => setEquipPickerOpen(false)}
      />
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 0,
  },
  container: {
    width: '100%', maxHeight: '92%',
    backgroundColor: '#141418',
    borderRadius: 20, overflow: 'hidden',
    flex: 1,
  },

  handle: { width: 36, height: 4, backgroundColor: '#2A2A35', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 16 },
  title: { flex: 1, color: '#F0F0F5', fontSize: 18, fontWeight: '500' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12, height: 44,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: '#F0F0F5', fontSize: 15 },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 12,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A22', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    flex: 1,
  },
  filterBtnActive: { backgroundColor: 'rgba(30,58,92,0.7)', borderColor: '#2979FF' },
  filterBtnText: { color: '#8A8A9A', fontSize: 13, flex: 1 },
  filterBtnTextActive: { color: '#4FC3F7' },
  clearBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#1A1A22', borderWidth: 1, borderColor: '#2A2A35',
    justifyContent: 'center', alignItems: 'center',
  },

  separator: { height: 1, backgroundColor: '#2A2A35', marginBottom: 0 },

  exRow: {
    height: 68, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#1E1E24',
  },
  exRowSelected: { backgroundColor: 'rgba(41,121,255,0.06)' },
  exRowDim: { opacity: 0.45 },
  exNameDim: { color: '#8A8A9A' },
  exImgWrap: {
    width: 64, alignSelf: 'stretch', overflow: 'hidden',
    backgroundColor: '#1E1E28',
  },
  exImgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  exInfo: { flex: 1, paddingHorizontal: 12 },
  exName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  exEquip: { color: '#8A8A9A', fontSize: 12, marginTop: 3 },

  exAction: { paddingRight: 16, alignItems: 'center' },
  addCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#2A2A35',
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2979FF',
    justifyContent: 'center', alignItems: 'center',
  },
  replaceText: { color: '#4FC3F7', fontSize: 13 },

  listEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#8A8A9A', fontSize: 14 },
  listFooter: { padding: 16, alignItems: 'center' },

  ctaBar: {
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: '#141418',
    borderTopWidth: 1, borderTopColor: '#2A2A35',
  },
  ctaBtn: {
    height: 48, borderRadius: 12,
    backgroundColor: '#1E1E24',
    borderWidth: 1.5, borderColor: 'rgba(41,121,255,0.4)',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: '#4FC3F7', fontSize: 15, fontWeight: '600' },
})

const fp = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    width: '100%',
    paddingTop: 8, paddingBottom: 16,
    overflow: 'hidden',
  },
  title: {
    color: '#8A8A9A', fontSize: 11, fontWeight: '600',
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 0.5, borderTopColor: '#2A2A35',
  },
  optionText: { color: '#F0F0F5', fontSize: 15 },
  optionActive: { color: '#4FC3F7', fontWeight: '500' },
})
