import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Pressable, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import type { ExecutionExerciseRecord } from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { showToast } from '../../components/Toast'

type NavProp = NativeStackNavigationProp<AppStackParamList>
type RouteProps = RouteProp<AppStackParamList, 'WorkoutPost'>

function formatDuration(min: number) {
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h ${min % 60}min`
}

function formatDate(now = new Date()) {
  return now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function ExerciseSummaryRow({ exercise }: { exercise: ExecutionExerciseRecord }) {
  const checkedSets = exercise.sets.filter(s => s.isChecked && s.setType === 'WORKING')
  if (checkedSets.length === 0) return null
  const maxWeight = checkedSets.reduce((mx, s) => Math.max(mx, s.weightKg ?? 0), 0)
  const label = maxWeight > 0
    ? `${checkedSets.length} × ${maxWeight}kg`
    : `${checkedSets.length} séries`
  return (
    <View style={ps.summaryRow}>
      <Text style={ps.summaryExName} numberOfLines={1}>{exercise.exercise.name}</Text>
      <Text style={ps.summaryExDetail}>{label}</Text>
    </View>
  )
}

export function WorkoutPostScreen() {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<RouteProps>()
  const { sessionId, workoutName, durationMin, totalSets, totalValidSets, totalVolume, exercises } = route.params

  const [description, setDescription] = useState('')
  const [discardModal, setDiscardModal] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const visibleExercises = exercises.slice(0, 5)
  const extraCount = exercises.length - visibleExercises.length

  async function handlePublish() {
    setPublishing(true)
    try {
      await api.posts.create({ trainingLogId: sessionId, content: description.trim() || undefined })
      showToast('Treino publicado!')
      navigation.popToTop()
    } catch {
      showToast('Erro ao publicar')
      setPublishing(false)
    }
  }

  function handleSkip() {
    showToast('Treino salvo!')
    navigation.popToTop()
  }

  return (
    <SafeAreaView style={ps.safe}>
      {/* Header */}
      <View style={ps.header}>
        <TouchableOpacity onPress={() => setDiscardModal(true)} style={ps.headerBtn}>
          <Ionicons name="close" size={22} color="#8A8A9A" />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>Publicar</Text>
        <View style={ps.headerRight}>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={ps.skipBtn}>Pular</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePublish} disabled={publishing}>
            {publishing
              ? <ActivityIndicator color="#4FC3F7" size="small" />
              : <Text style={ps.publishBtn}>Publicar</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={ps.scroll} keyboardShouldPersistTaps="handled">
        {/* Workout summary card */}
        <View style={ps.summaryCard}>
          <Text style={ps.summaryTitle}>{workoutName}</Text>
          <Text style={ps.summaryMeta}>{formatDate()} · {formatDuration(durationMin)}</Text>
          <View style={ps.statsRow}>
            <View style={ps.stat}>
              <Text style={ps.statValue}>{exercises.length}</Text>
              <Text style={ps.statLabel}>exercícios</Text>
            </View>
            <View style={ps.statDivider} />
            <View style={ps.stat}>
              <Text style={ps.statValue}>{totalValidSets}</Text>
              <Text style={ps.statLabel}>séries</Text>
            </View>
            <View style={ps.statDivider} />
            <View style={ps.stat}>
              <Text style={ps.statValue}>{totalVolume > 0 ? `${Math.round(totalVolume / 1000)}k` : '—'}</Text>
              <Text style={ps.statLabel}>kg total</Text>
            </View>
          </View>

          {/* Exercise list */}
          <View style={ps.exerciseList}>
            {visibleExercises.map(e => <ExerciseSummaryRow key={e.id} exercise={e} />)}
            {extraCount > 0 && (
              <Text style={ps.moreExercises}>+{extraCount} exercícios</Text>
            )}
          </View>
        </View>

        {/* Description input */}
        <View style={ps.section}>
          <Text style={ps.sectionLabel}>DESCRIÇÃO</Text>
          <TextInput
            style={ps.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Como foi o treino?"
            placeholderTextColor="#4A4A5A"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Discard modal */}
      <Modal visible={discardModal} transparent animationType="fade" onRequestClose={() => setDiscardModal(false)}>
        <View style={ps.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDiscardModal(false)} />
          <View style={ps.modal}>
            <Text style={ps.modalTitle}>Descartar publicação?</Text>
            <Text style={ps.modalBody}>O treino ficará salvo, mas não será publicado.</Text>
            <TouchableOpacity style={ps.modalBtnPrimary} onPress={() => setDiscardModal(false)}>
              <Text style={ps.modalBtnPrimaryText}>Continuar editando</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ps.modalBtnPrimary, { backgroundColor: '#2A2A35' }]} onPress={() => { setDiscardModal(false); navigation.popToTop() }}>
              <Text style={[ps.modalBtnPrimaryText, { color: '#8A8A9A' }]}>Descartar</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E1E24',
  },
  headerBtn: { width: 40 },
  headerTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  skipBtn: { color: '#555560', fontSize: 15 },
  publishBtn: { color: '#4FC3F7', fontSize: 15, fontWeight: '600' },

  scroll: { padding: 16, gap: 20, paddingBottom: 40 },

  // Summary card
  summaryCard: {
    backgroundColor: '#1E1E24', borderRadius: 16, padding: 16,
  },
  summaryTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  summaryMeta: { color: '#8A8A9A', fontSize: 13, marginBottom: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#F0F0F5', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8A8A9A', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#2A2A35' },

  exerciseList: { gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryExName: { color: '#8A8A9A', fontSize: 13, flex: 1 },
  summaryExDetail: { color: '#555560', fontSize: 12 },
  moreExercises: { color: '#4A4A5A', fontSize: 12 },

  // Description
  section: { gap: 8 },
  sectionLabel: { color: '#555560', fontSize: 11, fontWeight: '500', letterSpacing: 1 },
  descInput: {
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, padding: 14, color: '#F0F0F5', fontSize: 15,
    minHeight: 100,
  },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, gap: 12 },
  modalTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  modalBody: { color: '#8A8A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBtnPrimary: { height: 50, borderRadius: 14, backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
