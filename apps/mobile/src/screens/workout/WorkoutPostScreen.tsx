import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { ExecutionExerciseRecord, PostMediaItem } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { showToast } from '../../components/Toast'
import { ActionSheet } from './ActionSheet'
import { PostMediaPicker, POST_MEDIA_MAX } from '../../components/PostMediaPicker'
import type { SelectedMedia } from '../../components/PostMediaPicker'
import { uploadPostMedia } from '../../lib/postMediaUpload'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

const MAX_VIDEO_SEC = 60

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Map an expo-image-picker asset to our local media descriptor; null if unusable.
function assetToMedia(asset: ImagePicker.ImagePickerAsset): SelectedMedia | null {
  if (!asset.uri) return null
  const isVideo = asset.type === 'video' || (asset.mimeType?.startsWith('video/') ?? false)
  const fileName = asset.fileName ?? asset.uri.split(/[\\/]/).pop() ?? (isVideo ? 'video' : 'image')
  const mime = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')
  if (isVideo) {
    const durationSec = (asset.duration ?? 0) / 1000
    return { id: makeId(), uri: asset.uri, type: 'VIDEO', mime, fileName, durationSec }
  }
  return { id: makeId(), uri: asset.uri, type: 'IMAGE', mime, fileName }
}

type NavProp = NativeStackNavigationProp<AppStackParamList>
type RouteProps = RouteProp<AppStackParamList, 'WorkoutPost'>

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: 'Peito', BACK: 'Costas', SHOULDERS: 'Ombros',
  BICEPS: 'Bíceps', TRICEPS: 'Tríceps', FOREARMS: 'Antebraço',
  QUADS: 'Quadríceps', HAMSTRINGS: 'Posterior', GLUTES: 'Glúteos',
  CALVES: 'Panturrilha', ABS: 'Abdômen', FULL_BODY: 'Full Body', OTHER: 'Outro',
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${min}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatStartTime(durationMin: number) {
  const d = new Date(Date.now() - durationMin * 60_000)
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('pt-BR', { month: 'short' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} às ${time}`
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

function ExerciseSummaryRow({ exercise }: { exercise: ExecutionExerciseRecord }) {
  const checkedSets = exercise.sets.filter(s => s.isChecked && s.setType === 'WORKING')
  if (checkedSets.length === 0) return null
  const maxWeight = checkedSets.reduce((mx, s) => Math.max(mx, s.weightKg ?? 0), 0)
  const label = maxWeight > 0 ? `${checkedSets.length} × ${maxWeight}kg` : `${checkedSets.length} séries`
  return (
    <View style={ps.summaryRow}>
      <View style={ps.summaryDot} />
      <Text style={ps.summaryExName} numberOfLines={1}>{exercise.exercise.name}</Text>
      <Text style={ps.summaryExDetail}>{label}</Text>
    </View>
  )
}

export function WorkoutPostScreen() {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<RouteProps>()
  const { sessionId, workoutName, durationMin, totalValidSets, totalVolume, exercises } = route.params

  const qc = useQueryClient()
  const [description, setDescription] = useState('')
  const [discardModal, setDiscardModal] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const [sheetVisible, setSheetVisible] = useState(false)
  // Stable per-screen folder id so all media for this draft share a storage path.
  const postDraftId = useRef(makeId()).current

  const visibleExercises = exercises.slice(0, 5)
  const extraCount = exercises.length - visibleExercises.length
  const muscles = [...new Set(exercises.map(e => e.exercise.muscleGroup))].slice(0, 6)

  // Publish button opacity transition (200ms) while submitting.
  const btnOpacity = useSharedValue(1)
  useEffect(() => {
    btnOpacity.value = withTiming(publishing ? 0.6 : 1, { duration: 200 })
  }, [publishing, btnOpacity])
  const btnAnimStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value }))

  function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const remaining = POST_MEDIA_MAX - media.length
    if (remaining <= 0) {
      showToast(`Máximo de ${POST_MEDIA_MAX} mídias`, 'warning')
      return
    }

    const mapped = assets.map(assetToMedia).filter((m): m is SelectedMedia => m !== null)
    const valid = mapped.filter(m => {
      if (m.type === 'VIDEO' && (m.durationSec ?? 0) > MAX_VIDEO_SEC) return false
      return true
    })
    const rejectedForDuration = mapped.length - valid.length

    if (rejectedForDuration > 0) {
      showToast('Vídeos devem ter até 60 segundos.', 'error')
    }

    const accepted = valid.slice(0, remaining)
    if (valid.length > remaining) {
      showToast(`Máximo de ${POST_MEDIA_MAX} mídias`, 'warning')
    }
    if (accepted.length > 0) {
      setMedia(prev => [...prev, ...accepted])
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      showToast('Permita o acesso à câmera para continuar', 'warning')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: MAX_VIDEO_SEC,
      quality: 0.85,
    })
    if (result.canceled) return
    addAssets(result.assets)
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      showToast('Permita o acesso à galeria para continuar', 'warning')
      return
    }
    const remaining = POST_MEDIA_MAX - media.length
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(remaining, 1),
      quality: 0.85,
    })
    if (result.canceled) return
    addAssets(result.assets)
  }

  function openSheet() {
    if (media.length >= POST_MEDIA_MAX) {
      showToast(`Máximo de ${POST_MEDIA_MAX} mídias`, 'warning')
      return
    }
    setSheetVisible(true)
  }

  function removeMedia(id: string) {
    setMedia(prev => prev.filter(m => m.id !== id))
  }

  async function handlePublish() {
    if (publishing) return // prevent double submit
    setPublishing(true)
    try {
      let uploaded: PostMediaItem[] = []
      if (media.length > 0) {
        uploaded = await Promise.all(media.map((m, i) => uploadPostMedia(m, i, postDraftId)))
      }
      await api.posts.create({
        trainingLogId: sessionId,
        content: description.trim() || undefined,
        media: uploaded.length > 0 ? uploaded : undefined,
      })
      qc.invalidateQueries({ queryKey: ['my-workout-posts'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      showToast('Treino publicado!', 'success')
      navigation.navigate('AthleteTabs', { screen: 'Workout' })
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Erro ao publicar'), 'error')
      setPublishing(false)
    }
  }

  return (
    <SafeAreaView style={ps.safe}>
      {/* Header */}
      <View style={ps.header}>
        <TouchableOpacity
          onPress={() => setDiscardModal(true)}
          style={ps.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#8A8A9A" />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>Nova publicação</Text>
        <Reanimated.View style={btnAnimStyle}>
          <TouchableOpacity onPress={handlePublish} disabled={publishing} style={ps.publishPill}>
            <Text style={ps.publishPillText}>{publishing ? 'Publicando...' : 'Publicar'}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>

      <ScrollView
        contentContainerStyle={ps.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Description — top, composer feel */}
        <TextInput
          style={ps.descInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Como foi o treino hoje?"
          placeholderTextColor="#3A3A4A"
          multiline
          textAlignVertical="top"
        />

        {/* Media picker carousel */}
        <PostMediaPicker items={media} onAddPress={openSheet} onRemove={removeMedia} />

        {/* Section divider */}
        <View style={ps.sectionDivider}>
          <View style={ps.sectionLine} />
          <Text style={ps.sectionLabel}>RESUMO DO TREINO</Text>
          <View style={ps.sectionLine} />
        </View>

        {/* Workout summary card */}
        <View style={ps.summaryCard}>
          {/* Card header */}
          <View style={ps.cardHeader}>
            <View style={ps.cardIcon}>
              <Ionicons name="barbell-outline" size={16} color="#4FC3F7" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ps.cardTitle} numberOfLines={1}>{workoutName}</Text>
              <Text style={ps.cardDate}>{formatStartTime(durationMin)}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={ps.statsRow}>
            <View style={ps.stat}>
              <Text style={ps.statValue}>{formatDuration(durationMin)}</Text>
              <Text style={ps.statLabel}>duração</Text>
            </View>
            <View style={ps.statDivider} />
            <View style={ps.stat}>
              <Text style={ps.statValue}>{totalValidSets}</Text>
              <Text style={ps.statLabel}>séries</Text>
            </View>
            <View style={ps.statDivider} />
            <View style={ps.stat}>
              <Text style={ps.statValue}>{totalVolume > 0 ? formatVolume(totalVolume) : '—'}</Text>
              <Text style={ps.statLabel}>kg total</Text>
            </View>
          </View>

          {/* Muscles */}
          {muscles.length > 0 && (
            <View style={ps.musclesRow}>
              {muscles.map(m => (
                <View key={m} style={ps.musclePill}>
                  <Text style={ps.musclePillText}>{MUSCLE_LABELS[m] ?? m}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Exercise list */}
          {visibleExercises.length > 0 && (
            <View style={ps.exerciseList}>
              {visibleExercises.map(e => <ExerciseSummaryRow key={e.id} exercise={e} />)}
              {extraCount > 0 && (
                <Text style={ps.moreExercises}>+{extraCount} exercícios</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Media source action sheet */}
      <ActionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        actions={[
          { label: 'Câmera', onPress: pickFromCamera },
          { label: 'Galeria', onPress: pickFromLibrary },
          { label: 'Cancelar', onPress: () => {}, cancel: true },
        ]}
      />

      {/* Back modal */}
      <Modal visible={discardModal} transparent animationType="fade" onRequestClose={() => setDiscardModal(false)}>
        <View style={ps.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDiscardModal(false)} />
          <View style={ps.modal}>
            <Text style={ps.modalTitle}>Sair da publicação?</Text>
            <Text style={ps.modalBody}>O treino já está salvo. Você pode publicar a qualquer momento.</Text>
            <TouchableOpacity style={ps.modalBtnPrimary} onPress={() => setDiscardModal(false)}>
              <Text style={ps.modalBtnPrimaryText}>Continuar editando</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ps.modalBtnPrimary, { backgroundColor: '#2A2A35' }]}
              onPress={() => {
                setDiscardModal(false)
                // Reopen the same execution in editable state. WorkoutExecution
                // replaced itself with this screen, so goBack() would skip to
                // Training home; rehydrate the existing TrainingLog by id instead.
                navigation.replace('WorkoutExecution', { resumeSessionId: sessionId })
              }}
            >
              <Text style={[ps.modalBtnPrimaryText, { color: '#8A8A9A' }]}>Voltar ao treino</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const ps = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E24',
    gap: 10,
  },
  headerBtn: { width: 36 },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  publishPill: {
    backgroundColor: '#2979FF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  publishPillText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  scroll: { padding: 16, gap: 16, paddingBottom: 48 },

  descInput: {
    color: '#F0F0F5',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 72,
    paddingVertical: 4,
  },

  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#1E1E24' },
  sectionLabel: { color: '#3A3A4A', fontSize: 9, fontWeight: '600', letterSpacing: 1.2 },

  summaryCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#252530',
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(41,121,255,0.10)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardTitle: { color: '#F0F0F5', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  cardDate: { color: '#555560', fontSize: 11, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: 12,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: '#F0F0F5', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#555560', fontSize: 10 },
  statDivider: { width: 1, height: 28, backgroundColor: '#2A2A35' },

  musclesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  musclePill: {
    backgroundColor: 'rgba(79,195,247,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.14)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  musclePillText: { color: 'rgba(79,195,247,0.65)', fontSize: 11 },

  exerciseList: { gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2A2A35', flexShrink: 0 },
  summaryExName: { color: '#8A8A9A', fontSize: 13, flex: 1 },
  summaryExDetail: { color: '#555560', fontSize: 12 },
  moreExercises: { color: '#4A4A5A', fontSize: 12, textAlign: 'center', paddingTop: 4 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  modal: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, gap: 12 },
  modalTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  modalBody: { color: '#8A8A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBtnPrimary: {
    height: 50, borderRadius: 14, backgroundColor: '#2979FF',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
