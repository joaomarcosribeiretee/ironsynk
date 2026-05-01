// ADMIN — remove before launch
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  Image, Alert, StyleSheet, ActivityIndicator, Modal,
  TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { api } from '../../lib/api'
import type { ExerciseRecord, UpdateExerciseInput } from '../../lib/api'

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

const MG_OPTIONS = MUSCLE_GROUPS.filter(mg => mg.key !== 'ALL')

function getYoutubeThumbnail(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/0.jpg` : null
}

function resolvePreviewUri(gifUrl: string, videoUrl: string): string | null {
  if (gifUrl.trim()) return gifUrl.trim()
  if (videoUrl.trim()) return getYoutubeThumbnail(videoUrl.trim()) ?? videoUrl.trim()
  return null
}

function ExerciseThumb({ gifUrl, videoUrl }: { gifUrl: string | null; videoUrl: string | null }) {
  const uri = gifUrl ?? (videoUrl ? (getYoutubeThumbnail(videoUrl) ?? videoUrl) : null)
  return (
    <View style={s.thumb}>
      {uri ? (
        <Image source={{ uri }} style={s.thumbImg} resizeMode="cover" />
      ) : (
        <View style={s.thumbPlaceholder}>
          <Ionicons name="image-outline" size={22} color="#4A4A5A" />
        </View>
      )}
    </View>
  )
}

type EditState = {
  name: string
  muscleGroup: string
  equipment: string
  gifUrl: string
  videoUrl: string
}

export function ExerciseAdminScreen() {
  const navigation = useNavigation()
  const [exercises, setExercises] = useState<ExerciseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<ExerciseRecord | null>(null)
  const [edit, setEdit] = useState<EditState>({ name: '', muscleGroup: 'CHEST', equipment: '', gifUrl: '', videoUrl: '' })
  const [showMgPicker, setShowMgPicker] = useState(false)

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

  function openEdit(exercise: ExerciseRecord) {
    setEdit({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment ?? '',
      gifUrl: exercise.gifUrl ?? '',
      videoUrl: exercise.videoUrl ?? '',
    })
    setEditTarget(exercise)
  }

  function closeEdit() {
    setEditTarget(null)
    setShowMgPicker(false)
  }

  async function handleSave() {
    if (!editTarget) return
    setSavingId(editTarget.id)
    try {
      const body: UpdateExerciseInput = {
        name: edit.name.trim(),
        muscleGroup: edit.muscleGroup,
        equipment: edit.equipment.trim() || null,
        gifUrl: edit.gifUrl.trim() || null,
        videoUrl: edit.videoUrl.trim() || null,
      }
      const { data } = await api.exercises.update(editTarget.id, body)
      setExercises(prev => prev.map(e => e.id === editTarget.id ? data.exercise : e))
      closeEdit()
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.')
    } finally {
      setSavingId(null)
    }
  }

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
      closeEdit()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      Alert.alert('Erro ao remover', msg)
    } finally {
      setDeletingId(null)
    }
  }

  const previewUri = resolvePreviewUri(edit.gifUrl, edit.videoUrl)
  const mgLabel = MG_OPTIONS.find(mg => mg.key === edit.muscleGroup)?.label ?? edit.muscleGroup

  const renderItem = ({ item }: { item: ExerciseRecord }) => (
    <TouchableOpacity style={s.row} onPress={() => openEdit(item)} activeOpacity={0.7}>
      <ExerciseThumb gifUrl={item.gifUrl} videoUrl={item.videoUrl} />
      <View style={s.rowInfo}>
        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
        {item.equipment && (
          <View style={s.equipTag}>
            <Text style={s.equipTagText}>{item.equipment}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#4A4A5A" />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.headerTitle}>Admin Exercícios</Text>
          <Text style={s.headerSub}>ADMIN — {exercises.length} exercícios</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Muscle group filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
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
        <View style={s.centered}><ActivityIndicator color="#4FC3F7" /></View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={e => e.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={renderItem}
        />
      )}

      {/* Edit modal */}
      <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={closeEdit}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.backdrop} onPress={closeEdit} />
          <View style={s.sheet}>
            <View style={s.handle} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Live image preview */}
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={s.previewImg} resizeMode="cover" />
              ) : (
                <View style={s.previewPlaceholder}>
                  <Ionicons name="camera-outline" size={36} color="#4A4A5A" />
                </View>
              )}

              <Text style={s.fieldLabel}>Nome</Text>
              <TextInput
                style={s.input}
                value={edit.name}
                onChangeText={v => setEdit(p => ({ ...p, name: v }))}
                placeholder="Ex: Supino Reto"
                placeholderTextColor="#4A4A5A"
              />

              <Text style={s.fieldLabel}>Grupamento Muscular</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => setShowMgPicker(true)}>
                <Text style={s.pickerBtnText}>{mgLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#8A8A9A" />
              </TouchableOpacity>

              <Text style={s.fieldLabel}>Equipamento</Text>
              <TextInput
                style={s.input}
                value={edit.equipment}
                onChangeText={v => setEdit(p => ({ ...p, equipment: v }))}
                placeholder="Ex: barbell"
                placeholderTextColor="#4A4A5A"
              />

              <Text style={s.fieldLabel}>URL da Imagem</Text>
              <TextInput
                style={s.input}
                value={edit.gifUrl}
                onChangeText={v => setEdit(p => ({ ...p, gifUrl: v }))}
                placeholder="https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{Nome}/0.jpg"
                placeholderTextColor="#4A4A5A"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={s.fieldLabel}>URL do Vídeo</Text>
              <TextInput
                style={s.input}
                value={edit.videoUrl}
                onChangeText={v => setEdit(p => ({ ...p, videoUrl: v }))}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor="#4A4A5A"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeEdit}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, !!savingId && s.btnDisabled]}
                  onPress={handleSave}
                  disabled={!!savingId}
                >
                  {savingId
                    ? <ActivityIndicator size="small" color="#141418" />
                    : <Text style={s.saveBtnText}>Salvar</Text>
                  }
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.deleteModalBtn, !!deletingId && s.btnDisabled]}
                onPress={() => editTarget && confirmDelete(editTarget)}
                disabled={!!deletingId}
              >
                {deletingId
                  ? <ActivityIndicator size="small" color="#FF5252" />
                  : <Text style={s.deleteModalBtnText}>Remover exercício</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Muscle group sub-picker */}
        <Modal visible={showMgPicker} transparent animationType="fade" onRequestClose={() => setShowMgPicker(false)}>
          <Pressable style={s.backdrop} onPress={() => setShowMgPicker(false)} />
          <View style={s.mgSheet}>
            <Text style={s.mgSheetTitle}>Grupamento Muscular</Text>
            <ScrollView>
              {MG_OPTIONS.map(mg => (
                <TouchableOpacity
                  key={mg.key}
                  style={s.mgOption}
                  onPress={() => { setEdit(p => ({ ...p, muscleGroup: mg.key })); setShowMgPicker(false) }}
                >
                  <Text style={[s.mgOptionText, edit.muscleGroup === mg.key && s.mgOptionTextActive]}>
                    {mg.label}
                  </Text>
                  {edit.muscleGroup === mg.key && <Ionicons name="checkmark" size={16} color="#4FC3F7" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
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
  separator: { height: 1, backgroundColor: '#2A2A35', marginLeft: 80 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12, minHeight: 84,
  },
  thumb: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: '#1E1E24', overflow: 'hidden',
    borderWidth: 1, borderColor: '#2A2A35', flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rowInfo: { flex: 1, gap: 5 },
  rowName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  equipTag: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, backgroundColor: '#1E1E24',
    borderWidth: 1, borderColor: '#2A2A35',
  },
  equipTagText: { color: '#8A8A9A', fontSize: 11 },

  rowActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  editBtn: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(79,195,247,0.1)', borderWidth: 1, borderColor: '#4FC3F7',
  },
  deleteBtn: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,82,82,0.1)', borderWidth: 1, borderColor: '#FF5252',
  },
  btnDisabled: { opacity: 0.4 },

  // Edit modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1E1E24', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#2A2A35',
    alignSelf: 'center', marginBottom: 16,
  },
  previewImg: { width: '100%', height: 200, borderRadius: 12, marginBottom: 20, backgroundColor: '#141418' },
  previewPlaceholder: {
    height: 120, borderRadius: 12, backgroundColor: '#141418',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#2A2A35',
  },

  fieldLabel: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#F0F0F5', fontSize: 14, marginBottom: 14,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  pickerBtnText: { color: '#F0F0F5', fontSize: 14 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#2A2A35', alignItems: 'center',
  },
  cancelBtnText: { color: '#F0F0F5', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#4FC3F7', alignItems: 'center',
  },
  saveBtnText: { color: '#141418', fontSize: 15, fontWeight: '700' },

  // Muscle group sub-picker
  deleteModalBtn: {
    marginTop: 10, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#FF5252', alignItems: 'center',
  },
  deleteModalBtnText: { color: '#FF5252', fontSize: 15, fontWeight: '600' },

  mgSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1E1E24', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, maxHeight: '70%',
  },
  mgSheetTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  mgOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A2A35',
  },
  mgOptionText: { color: '#8A8A9A', fontSize: 15 },
  mgOptionTextActive: { color: '#4FC3F7', fontWeight: '600' },
})
