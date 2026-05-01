// DEBUG — remove before launch
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  Image, Modal, StyleSheet, ActivityIndicator, Pressable,
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

export function ExerciseDebugScreen() {
  const navigation = useNavigation()
  const [exercises, setExercises] = useState<ExerciseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [selected, setSelected] = useState<ExerciseRecord | null>(null)

  const load = useCallback(async (group: string) => {
    setLoading(true)
    try {
      const { data } = await api.exercises.list(group === 'ALL' ? undefined : group)
      setExercises(data.exercises)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(selectedGroup) }, [selectedGroup])

  function selectGroup(key: string) {
    setSelectedGroup(key)
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Exercícios</Text>
          <Text style={s.headerSub}>DEBUG — {exercises.length} carregados</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Muscle group pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsRow}
      >
        {MUSCLE_GROUPS.map((mg) => {
          const active = selectedGroup === mg.key
          return (
            <TouchableOpacity
              key={mg.key}
              style={[s.pill, active && s.pillActive]}
              onPress={() => selectGroup(mg.key)}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{mg.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color="#4FC3F7" />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => setSelected(item)} activeOpacity={0.75}>
              <View style={s.thumb}>
                {item.gifUrl ? (
                  <Image source={{ uri: item.gifUrl }} style={s.thumbImg} resizeMode="cover" />
                ) : (
                  <View style={s.thumbPlaceholder}>
                    <Ionicons name="barbell-outline" size={20} color="#4A4A5A" />
                  </View>
                )}
              </View>
              <View style={s.rowInfo}>
                <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.rowMeta}>{item.equipment ?? '—'}</Text>
              </View>
              <View style={[s.gifBadge, item.gifUrl ? s.gifBadgeOk : s.gifBadgeMissing]}>
                <Text style={[s.gifBadgeText, item.gifUrl ? s.gifBadgeTextOk : s.gifBadgeTextMissing]}>
                  {item.gifUrl ? 'IMG' : 'NULL'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setSelected(null)} />
        {selected && (
          <View style={s.sheet}>
            <View style={s.sheetHandle} />

            {selected.gifUrl ? (
              <Image source={{ uri: selected.gifUrl }} style={s.sheetImg} resizeMode="contain" />
            ) : (
              <View style={s.sheetImgPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#4A4A5A" />
                <Text style={s.sheetImgPlaceholderText}>Sem imagem</Text>
              </View>
            )}

            <Text style={s.sheetName}>{selected.name}</Text>

            <View style={s.sheetCard}>
              {([
                ['Grupo muscular', selected.muscleGroup],
                ['Equipamento', selected.equipment ?? '—'],
                ['Source ID', selected.sourceId ?? '—'],
                ['GIF URL', selected.gifUrl ?? 'null'],
              ] as [string, string][]).map(([label, value], i, arr) => (
                <View key={label}>
                  <View style={s.sheetRow}>
                    <Text style={s.sheetLabel}>{label}</Text>
                    <Text style={s.sheetValue} numberOfLines={2}>{value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={s.sheetDivider} />}
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
              <Text style={s.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
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
  headerTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600' },
  headerSub: { color: '#FF5252', fontSize: 10, fontWeight: '600', marginTop: 1 },

  pillsRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
  },
  pillActive: { backgroundColor: 'rgba(79,195,247,0.12)', borderColor: '#4FC3F7' },
  pillText: { color: '#8A8A9A', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#4FC3F7' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  separator: { height: 1, backgroundColor: '#2A2A35', marginLeft: 72 },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
  },
  thumb: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: '#1E1E24', overflow: 'hidden',
    borderWidth: 1, borderColor: '#2A2A35',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500', marginBottom: 3 },
  rowMeta: { color: '#8A8A9A', fontSize: 12 },
  gifBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gifBadgeOk: { backgroundColor: 'rgba(0,230,118,0.1)' },
  gifBadgeMissing: { backgroundColor: 'rgba(255,82,82,0.1)' },
  gifBadgeText: { fontSize: 10, fontWeight: '700' },
  gifBadgeTextOk: { color: '#00E676' },
  gifBadgeTextMissing: { color: '#FF5252' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1E1E24', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#2A2A35',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetImg: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16, backgroundColor: '#141418' },
  sheetImgPlaceholder: {
    height: 120, borderRadius: 12, backgroundColor: '#141418',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 8,
  },
  sheetImgPlaceholderText: { color: '#4A4A5A', fontSize: 13 },
  sheetName: { color: '#F0F0F5', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  sheetCard: {
    backgroundColor: '#141418', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A35', marginBottom: 20,
  },
  sheetRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 12, gap: 12,
  },
  sheetLabel: { color: '#8A8A9A', fontSize: 13, flexShrink: 0 },
  sheetValue: { color: '#F0F0F5', fontSize: 13, textAlign: 'right', flex: 1 },
  sheetDivider: { height: 1, backgroundColor: '#2A2A35', marginHorizontal: 12 },
  closeBtn: {
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#2A2A35', alignItems: 'center',
  },
  closeBtnText: { color: '#F0F0F5', fontSize: 15, fontWeight: '600' },
})
