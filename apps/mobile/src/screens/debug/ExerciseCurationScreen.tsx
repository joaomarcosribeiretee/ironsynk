// ADMIN — remove before launch
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  Image, Alert, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { api } from '../../lib/api'
import type { ExerciseRecord } from '../../lib/api'

const MUSCLE_GROUPS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'CHEST', label: 'Peito' },
  { key: 'BACK', label: 'Costas' },
  { key: 'SHOULDERS', label: 'Ombros' },
  { key: 'BICEPS', label: 'Bíceps' },
  { key: 'TRICEPS', label: 'Tríceps' },
  { key: 'FOREARMS', label: 'Antebraços' },
  { key: 'QUADS', label: 'Quadríceps' },
  { key: 'HAMSTRINGS', label: 'Posteriores' },
  { key: 'GLUTES', label: 'Glúteos' },
  { key: 'CALVES', label: 'Panturrilha' },
  { key: 'ABS', label: 'Abdômen' },
  { key: 'FULL_BODY', label: 'Full Body' },
  { key: 'OTHER', label: 'Outros' },
]

export function ExerciseCurationScreen() {
  const navigation = useNavigation()
  const [exercises, setExercises] = useState<ExerciseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async (group: string) => {
    setLoading(true)
    try {
      const { data } = await api.exercises.list(group === 'ALL' ? undefined : { muscleGroup: group })
      setExercises(data.exercises)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(selectedGroup) }, [selectedGroup])

  function confirmDelete(exercise: ExerciseRecord) {
    Alert.alert(
      'Remover exercício',
      `Remover "${exercise.name}" permanentemente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => deleteExercise(exercise) },
      ]
    )
  }

  async function deleteExercise(exercise: ExerciseRecord) {
    setDeletingId(exercise.id)
    try {
      await api.exercises.delete(exercise.id)
      setExercises(prev => prev.filter(e => e.id !== exercise.id))
    } catch {
      Alert.alert('Erro', 'Não foi possível remover o exercício.')
    } finally {
      setDeletingId(null)
    }
  }

  const renderItem = ({ item }: { item: ExerciseRecord }) => {
    const isDeleting = deletingId === item.id
    return (
      <View style={s.row}>
        <View style={s.thumb}>
          {item.gifUrl ? (
            <Image source={{ uri: item.gifUrl }} style={s.thumbImg} resizeMode="cover" />
          ) : (
            <View style={s.thumbPlaceholder}>
              <Ionicons name="barbell-outline" size={22} color="#4A4A5A" />
            </View>
          )}
        </View>

        <View style={s.rowInfo}>
          <Text style={s.rowName} numberOfLines={2}>{item.name}</Text>
          {item.equipment && (
            <View style={s.equipTag}>
              <Text style={s.equipTagText}>{item.equipment}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[s.removeBtn, isDeleting && s.removeBtnDisabled]}
          onPress={() => confirmDelete(item)}
          disabled={isDeleting}
        >
          {isDeleting
            ? <ActivityIndicator size="small" color="#FF5252" />
            : <Text style={s.removeBtnText}>Remover</Text>
          }
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Curadoria</Text>
          <Text style={s.headerSub}>ADMIN — {exercises.length} exercícios</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Muscle group filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsRow}
      >
        {MUSCLE_GROUPS.map(mg => {
          const active = selectedGroup === mg.key
          return (
            <TouchableOpacity
              key={mg.key}
              style={[s.pill, active && s.pillActive]}
              onPress={() => setSelectedGroup(mg.key)}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{mg.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color="#4FC3F7" />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={e => e.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={renderItem}
          getItemLayout={(_, index) => ({ length: 81, offset: 82 * index, index })}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  headerSub: { color: '#FF5252', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 1 },

  pillsRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
  },
  pillActive: { backgroundColor: 'rgba(79,195,247,0.12)', borderColor: '#4FC3F7' },
  pillText: { color: '#8A8A9A', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#4FC3F7' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  separator: { height: 1, backgroundColor: '#2A2A35', marginLeft: 108 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12, minHeight: 80,
  },
  thumb: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: '#1E1E24', overflow: 'hidden',
    borderWidth: 1, borderColor: '#2A2A35', flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  rowInfo: { flex: 1, gap: 6 },
  rowName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500', lineHeight: 19 },
  equipTag: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, backgroundColor: '#1E1E24',
    borderWidth: 1, borderColor: '#2A2A35',
  },
  equipTagText: { color: '#8A8A9A', fontSize: 11 },

  removeBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.1)', borderWidth: 1, borderColor: '#FF5252',
    minWidth: 72, alignItems: 'center', flexShrink: 0,
  },
  removeBtnDisabled: { opacity: 0.5 },
  removeBtnText: { color: '#FF5252', fontSize: 12, fontWeight: '600' },
})
