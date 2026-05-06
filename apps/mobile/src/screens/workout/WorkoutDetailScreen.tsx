import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Image, ActivityIndicator, Modal, Pressable,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ActionSheet } from './ActionSheet'
import { ExercisePickerModal } from './ExercisePickerModal'
import { TechniquePickerSheet, TechniqueSelection } from './TechniquePickerSheet'
import { SupersetPickerModal } from './SupersetPickerModal'
import { ConfirmModal } from '../../components/ConfirmModal'
import { showToast } from '../../components/Toast'
import {
  api, UpdateTrainingExerciseInput,
  PlannedSetRecord, SetType, PlannedSetTechnique, TechniqueConfig,
} from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'

// ─── Technique visual config ──────────────────────────────────────────────────

type TechStyle = {
  borderColor: string
  bgColor: string
  badge: string
  badgeBg: string
  badgeText: string
}

const TECH_STYLE: Record<string, TechStyle> = {
  WARMUP:       { borderColor: '#FFB300', bgColor: '#1A1500', badge: 'W',  badgeBg: '#2A2200', badgeText: '#FFB300' },
  FEEDER:       { borderColor: '#4FC3F7', bgColor: '#001A1A', badge: 'F',  badgeBg: '#002233', badgeText: '#4FC3F7' },
  REST_PAUSE:   { borderColor: '#2979FF', bgColor: '#001428', badge: 'RP', badgeBg: '#001A3A', badgeText: '#4FC3F7' },
  MUSCLE_ROUND: { borderColor: '#7B61FF', bgColor: '#0D0A1E', badge: 'MR', badgeBg: '#1A1030', badgeText: '#A78BFA' },
  CLUSTER_SET:  { borderColor: '#00E676', bgColor: '#001A0A', badge: 'CS', badgeBg: '#002210', badgeText: '#00E676' },
  BACK_OFF:     { borderColor: '#FF5252', bgColor: '#1A0505', badge: 'BO', badgeBg: '#2A0A0A', badgeText: '#FF5252' },
}

const DEFAULT_TECH_STYLE: TechStyle = {
  borderColor: '#2A2A35', bgColor: '#141418', badge: '', badgeBg: '#2A2A35', badgeText: '#8A8A9A',
}

function getTechStyle(setType: SetType, technique: PlannedSetTechnique): TechStyle {
  if (setType === 'WARMUP') return TECH_STYLE['WARMUP']!
  if (setType === 'FEEDER') return TECH_STYLE['FEEDER']!
  if (technique !== 'NONE') return TECH_STYLE[technique] ?? DEFAULT_TECH_STYLE
  return DEFAULT_TECH_STYLE
}

function getBadge(setType: SetType, technique: PlannedSetTechnique, index: number): string {
  if (setType === 'WARMUP') return 'W'
  if (setType === 'FEEDER') return 'F'
  if (technique !== 'NONE') return TECH_STYLE[technique]?.badge ?? String(index + 1)
  return String(index + 1)
}

function getVolumeHint(setType: SetType): string | null {
  if (setType === 'WARMUP') return 'Não conta no volume'
  if (setType === 'FEEDER') return 'Não conta no volume'
  return null
}

// ─── Equipment translation ────────────────────────────────────────────────────

const EQUIP_PT: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Haltere', cable: 'Cabo', machine: 'Máquina',
  bodyweight: 'Peso Corporal', 'body weight': 'Peso Corporal',
  smith: 'Smith', kettlebell: 'Kettlebell', band: 'Elástico', other: 'Outro',
}
const txEquip = (s: string | null | undefined) => s ? (EQUIP_PT[s.toLowerCase()] ?? s) : '—'

// ─── Rest wheel picker ────────────────────────────────────────────────────────

const MINS = Array.from({ length: 10 }, (_, i) => String(i))
const SECS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
const WHEEL_H = 48

function formatRest(s: number | null): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  if (sec === 0) return `${m}min`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function restToIdx(s: number | null): [number, number] {
  if (s == null) return [0, 0]
  return [Math.min(Math.floor(s / 60), 9), Math.min(Math.round((s % 60) / 5), 11)]
}

function WheelCol({ items, initialIndex, onChange }: { items: string[]; initialIndex: number; onChange: (idx: number) => void }) {
  const ref = useRef<ScrollView>(null)
  const [active, setActive] = useState(initialIndex)
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: initialIndex * WHEEL_H, animated: false })
      setActive(initialIndex)
    }, 80)
    return () => clearTimeout(t)
  }, [initialIndex])
  function snap(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / WHEEL_H)))
    setActive(idx); onChange(idx)
  }
  return (
    <View style={wh.wrap}>
      <View style={wh.selection} pointerEvents="none" />
      <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={WHEEL_H} decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_H }} onMomentumScrollEnd={snap} onScrollEndDrag={snap}>
        {items.map((item, idx) => (
          <View key={idx} style={wh.item}>
            <Text style={[wh.itemText, active === idx && wh.itemActive]}>{item}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function RestPickerModal({ visible, initialSeconds, onConfirm, onClose }: {
  visible: boolean; initialSeconds: number | null; onConfirm: (s: number | null) => void; onClose: () => void
}) {
  const [minIdx, setMinIdx] = useState(0)
  const [secIdx, setSecIdx] = useState(0)
  useEffect(() => {
    if (!visible) return
    const [m, s] = restToIdx(initialSeconds)
    setMinIdx(m); setSecIdx(s)
  }, [visible])
  function confirm() {
    const secs = minIdx * 60 + secIdx * 5
    onConfirm(secs === 0 ? null : secs); onClose()
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rp.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={confirm} />
        <View style={rp.sheet}>
          <View style={rp.handle} />
          <Text style={rp.title}>Tempo de descanso</Text>
          <Text style={rp.subtitle}>0:00 = sem descanso</Text>
          <View style={rp.wheels}>
            <WheelCol items={MINS} initialIndex={minIdx} onChange={setMinIdx} />
            <Text style={rp.colon}>:</Text>
            <WheelCol items={SECS} initialIndex={secIdx} onChange={setSecIdx} />
            <Text style={rp.unit}>min : seg</Text>
          </View>
          <TouchableOpacity style={rp.confirmBtn} onPress={confirm} activeOpacity={0.85}>
            <Text style={rp.confirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ─── Technique expansion sub-rows ─────────────────────────────────────────────

function RestSeparator({ seconds }: { seconds: number }) {
  return (
    <View style={exp.sep}>
      <View style={exp.sepLine} />
      <Text style={exp.sepText}>{seconds}s</Text>
      <View style={exp.sepLine} />
    </View>
  )
}

function RestPauseExpansion({ config }: { config: TechniqueConfig | null }) {
  const c = config as Record<string, unknown> | null
  const failurePoints = Math.min(4, Math.max(2, Number(c?.['failurePoints'] ?? 3)))
  const rest = Number(c?.['restBetweenSeconds'] ?? 20)
  return (
    <View style={exp.wrap}>
      {Array.from({ length: failurePoints }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RestSeparator seconds={rest} />}
          <View style={exp.block}>
            <Text style={exp.blockLabel}>Falha {i + 1}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

function MuscleRoundExpansion({ config, setId, failedBlocks, onToggleFailed }: {
  config: TechniqueConfig | null
  setId: string
  failedBlocks: Record<string, boolean[]>
  onToggleFailed: (setId: string, idx: number) => void
}) {
  const c = config as Record<string, unknown> | null
  const blocks = Math.min(8, Math.max(4, Number(c?.['blocks'] ?? 6)))
  const reps = Number(c?.['repsPerBlock'] ?? 6)
  const rest = Number(c?.['restBetweenSeconds'] ?? 30)
  const failed = failedBlocks[setId] ?? Array(blocks).fill(false)
  return (
    <View style={exp.wrap}>
      {Array.from({ length: blocks }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RestSeparator seconds={rest} />}
          <View style={[exp.block, exp.blockMr]}>
            <Text style={exp.blockLabel}>Bloco {i + 1} · {reps} reps</Text>
            <TouchableOpacity
              style={[exp.failBtn, failed[i] && exp.failBtnActive]}
              onPress={() => onToggleFailed(setId, i)}
              activeOpacity={0.7}
            >
              <Text style={[exp.failBtnText, failed[i] && exp.failBtnTextActive]}>
                {failed[i] ? 'Falhou' : 'Falhou?'}
              </Text>
            </TouchableOpacity>
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

function ClusterSetExpansion({ config }: { config: TechniqueConfig | null }) {
  const c = config as Record<string, unknown> | null
  const blocks = Math.min(6, Math.max(2, Number(c?.['blocks'] ?? 4)))
  const reps = Number(c?.['repsPerBlock'] ?? 4)
  const rest = Number(c?.['restBetweenSeconds'] ?? 15)
  return (
    <View style={exp.wrap}>
      {Array.from({ length: blocks }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RestSeparator seconds={rest} />}
          <View style={exp.block}>
            <Text style={exp.blockLabel}>Bloco {i + 1} · {reps} reps</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({
  set,
  index,
  reps,
  weight,
  failedBlocks,
  onRepsChange,
  onWeightChange,
  onTechniqueTap,
  onLongPress,
  onToggleFailed,
}: {
  set: PlannedSetRecord
  index: number
  reps: string
  weight: string
  failedBlocks: Record<string, boolean[]>
  onRepsChange: (v: string) => void
  onWeightChange: (v: string) => void
  onTechniqueTap: () => void
  onLongPress: () => void
  onToggleFailed: (setId: string, idx: number) => void
}) {
  const ts = getTechStyle(set.setType, set.technique)
  const badge = getBadge(set.setType, set.technique, index)
  const volumeHint = getVolumeHint(set.setType)
  const hasLeftBorder = set.setType !== 'WORKING' || set.technique !== 'NONE'

  return (
    <TouchableOpacity onLongPress={onLongPress} activeOpacity={0.85} delayLongPress={400}>
      <View style={[sr.wrap, { backgroundColor: ts.bgColor }, hasLeftBorder && { borderLeftWidth: 3, borderLeftColor: ts.borderColor }]}>
        <View style={sr.main}>
          <TouchableOpacity style={[sr.badge, { backgroundColor: ts.badgeBg }]} onPress={onTechniqueTap} activeOpacity={0.7}>
            <Text style={[sr.badgeText, { color: ts.badgeText }]}>{badge}</Text>
          </TouchableOpacity>

          <TextInput
            style={sr.repsInput}
            value={reps}
            onChangeText={onRepsChange}
            placeholder="Reps"
            placeholderTextColor="#3A3A4A"
            returnKeyType="done"
            blurOnSubmit
          />
          <Text style={sr.timesText}>×</Text>
          <TextInput
            style={sr.weightInput}
            value={weight}
            onChangeText={onWeightChange}
            placeholder="—"
            placeholderTextColor="#3A3A4A"
            keyboardType="decimal-pad"
          />
          <Text style={sr.kgText}>kg</Text>
        </View>

        {volumeHint && (
          <Text style={sr.volumeHint}>{volumeHint}</Text>
        )}

        {set.setType === 'WORKING' && set.technique === 'REST_PAUSE' && (
          <RestPauseExpansion config={set.techniqueConfig} />
        )}
        {set.setType === 'WORKING' && set.technique === 'MUSCLE_ROUND' && (
          <MuscleRoundExpansion
            config={set.techniqueConfig}
            setId={set.id}
            failedBlocks={failedBlocks}
            onToggleFailed={onToggleFailed}
          />
        )}
        {set.setType === 'WORKING' && set.technique === 'CLUSTER_SET' && (
          <ClusterSetExpansion config={set.techniqueConfig} />
        )}
        {set.setType === 'WORKING' && set.technique === 'BACK_OFF' && (() => {
          const c = set.techniqueConfig as Record<string, unknown> | null
          const pct = Number(c?.['percentage'] ?? 60)
          return <Text style={sr.backOffHint}>~{pct}% da carga anterior</Text>
        })()}
      </View>
    </TouchableOpacity>
  )
}

// ─── Volume counter ───────────────────────────────────────────────────────────

function VolumeCounter({ sets }: { sets: PlannedSetRecord[] }) {
  const valid = sets.filter(s => s.setType === 'WORKING').length
  const total = sets.length
  return (
    <Text style={vc.text}>
      {total} {total === 1 ? 'série' : 'séries'} · <Text style={vc.valid}>{valid} válidas</Text>
    </Text>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function WorkoutDetailScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<AppStackParamList, 'WorkoutDetail'>>()
  const { workoutId } = route.params
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()

  const [localSets, setLocalSets] = useState<Record<string, PlannedSetRecord[]>>({})
  const [localRepsWeight, setLocalRepsWeight] = useState<Record<string, { reps: string; weight: string }>>({})
  const [failedBlocks, setFailedBlocks] = useState<Record<string, boolean[]>>({})

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<'add' | 'replace'>('add')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ visible: boolean; teId: string | null }>({ visible: false, teId: null })
  const [restPicker, setRestPicker] = useState<{ visible: boolean; teId: string | null }>({ visible: false, teId: null })
  const [localRestSeconds, setLocalRestSeconds] = useState<Record<string, number | null>>({})
  const [workoutName, setWorkoutName] = useState('')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({})
  const [confirmRemoveTe, setConfirmRemoveTe] = useState<{ visible: boolean; teId: string | null }>({ visible: false, teId: null })
  const [confirmDeleteSet, setConfirmDeleteSet] = useState<{ visible: boolean; teId: string | null; setId: string | null }>({ visible: false, teId: null, setId: null })
  const [confirmRemoveLastSet, setConfirmRemoveLastSet] = useState<{ visible: boolean; teId: string | null }>({ visible: false, teId: null })
  const [techniquePicker, setTechniquePicker] = useState<{ visible: boolean; teId: string | null; setId: string | null }>({ visible: false, teId: null, setId: null })
  const [supersetPicker, setSupersetPicker] = useState<{ visible: boolean; type: 'BISET' | 'SUPERSET'; sourceTeId: string | null }>({ visible: false, type: 'BISET', sourceTeId: null })
  const [addingSet, setAddingSet] = useState<Record<string, boolean>>({})

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingTEChanges = useRef<Record<string, Partial<{ notes: string | null; restSeconds: number | null }>>>({})
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameInitialized = useRef(false)
  const setTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => api.workouts.get(workoutId),
  })

  const workout = data?.data.workout

  useEffect(() => {
    if (!workout) return
    if (!nameInitialized.current) {
      setWorkoutName(workout.name)
      setWorkoutNotes(workout.notes ?? '')
      nameInitialized.current = true
    }
    setLocalSets(prev => {
      const next = { ...prev }
      for (const te of workout.exercises) {
        if (!next[te.id]) {
          next[te.id] = te.sets
        }
      }
      return next
    })
    setLocalRepsWeight(prev => {
      const next = { ...prev }
      for (const te of workout.exercises) {
        for (const s of te.sets) {
          if (!next[s.id]) {
            next[s.id] = {
              reps: s.targetReps ?? '',
              weight: s.targetWeight != null ? String(s.targetWeight) : '',
            }
          }
        }
      }
      return next
    })
    setLocalRestSeconds(prev => {
      const next = { ...prev }
      for (const te of workout.exercises) {
        if (next[te.id] === undefined) {
          next[te.id] = te.restSeconds ?? null
        }
      }
      return next
    })
    setLocalNotes(prev => {
      const next = { ...prev }
      for (const te of workout.exercises) {
        if (next[te.id] === undefined) {
          next[te.id] = te.notes ?? ''
        }
      }
      return next
    })
  }, [workout])

  function scheduleSetSave(setId: string, changes: { targetReps?: string | null; targetWeight?: number | null }) {
    if (setTimers.current[setId]) clearTimeout(setTimers.current[setId])
    setTimers.current[setId] = setTimeout(() => {
      api.plannedSets.update(setId, changes).catch(() => null)
      delete setTimers.current[setId]
    }, 800)
  }

  function handleRepsChange(setId: string, val: string) {
    setLocalRepsWeight(prev => ({ ...prev, [setId]: { ...prev[setId]!, reps: val } }))
    scheduleSetSave(setId, { targetReps: val || null })
  }

  function handleWeightChange(setId: string, val: string) {
    setLocalRepsWeight(prev => ({ ...prev, [setId]: { ...prev[setId]!, weight: val } }))
    const n = parseFloat(val)
    scheduleSetSave(setId, { targetWeight: isNaN(n) ? null : n })
  }

  function handleToggleFailed(setId: string, blockIdx: number) {
    setFailedBlocks(prev => {
      const cur = prev[setId] ?? []
      const next = [...cur]
      next[blockIdx] = !next[blockIdx]
      return { ...prev, [setId]: next }
    })
  }

  async function handleAddSet(teId: string) {
    if (addingSet[teId]) return
    setAddingSet(prev => ({ ...prev, [teId]: true }))
    try {
      const res = await api.trainingExercises.addSet(teId, { setType: 'WORKING', technique: 'NONE' })
      const ps = res.data.plannedSet
      setLocalSets(prev => ({ ...prev, [teId]: [...(prev[teId] ?? []), ps] }))
      setLocalRepsWeight(prev => ({ ...prev, [ps.id]: { reps: '', weight: '' } }))
    } catch {
      showToast('Erro ao adicionar série')
    } finally {
      setAddingSet(prev => ({ ...prev, [teId]: false }))
    }
  }

  async function handleRemoveLastSet(teId: string) {
    const sets = localSets[teId] ?? []
    if (sets.length <= 1) return
    const lastSet = sets[sets.length - 1]!
    try {
      await api.plannedSets.delete(lastSet.id)
      setLocalSets(prev => ({ ...prev, [teId]: prev[teId]!.slice(0, -1) }))
    } catch {
      showToast('Erro ao remover série')
    }
  }

  async function handleDeleteSet(teId: string, setId: string) {
    const sets = localSets[teId] ?? []
    if (sets.length <= 1) return
    try {
      await api.plannedSets.delete(setId)
      setLocalSets(prev => ({ ...prev, [teId]: prev[teId]!.filter(s => s.id !== setId) }))
    } catch {
      showToast('Erro ao remover série')
    }
  }

  async function handleTechniqueChange(teId: string, setId: string, sel: TechniqueSelection) {
    try {
      const res = await api.plannedSets.update(setId, {
        setType: sel.setType,
        technique: sel.technique,
        techniqueConfig: sel.config,
      })
      const updated = res.data.plannedSet
      setLocalSets(prev => ({
        ...prev,
        [teId]: prev[teId]!.map(s => s.id === setId ? updated : s),
      }))
    } catch {
      showToast('Erro ao aplicar técnica')
    }
  }

  function handleRestConfirm(teId: string, seconds: number | null) {
    setLocalRestSeconds(prev => ({ ...prev, [teId]: seconds }))
    api.trainingExercises.update(teId, { restSeconds: seconds }).catch(() => null)
  }

  function handleNotesChange(teId: string, val: string) {
    setLocalNotes(prev => ({ ...prev, [teId]: val }))
    if (pendingTEChanges.current[teId]) clearTimeout(saveTimers.current[teId])
    pendingTEChanges.current[teId] = { ...pendingTEChanges.current[teId], notes: val || null }
    saveTimers.current[teId] = setTimeout(() => {
      const changes = pendingTEChanges.current[teId]
      if (changes) api.trainingExercises.update(teId, changes as UpdateTrainingExerciseInput).catch(() => null)
      delete pendingTEChanges.current[teId]
    }, 800)
  }

  function handleNameChange(val: string) {
    setWorkoutName(val)
    if (nameTimer.current) clearTimeout(nameTimer.current)
    if (!val.trim()) return
    nameTimer.current = setTimeout(() => {
      api.workouts.update(workoutId, { name: val.trim() }).catch(() => null)
    }, 800)
  }

  function handleWorkoutNotesChange(val: string) {
    setWorkoutNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      api.workouts.update(workoutId, { description: val || null }).catch(() => null)
    }, 1200)
  }

  async function handleSave() {
    if (nameTimer.current) {
      clearTimeout(nameTimer.current)
      if (workoutName.trim()) await api.workouts.update(workoutId, { name: workoutName.trim() }).catch(() => null)
    }
    if (notesTimer.current) {
      clearTimeout(notesTimer.current)
      await api.workouts.update(workoutId, { description: workoutNotes || null }).catch(() => null)
    }
    for (const id of Object.keys(setTimers.current)) {
      clearTimeout(setTimers.current[id])
      delete setTimers.current[id]
    }
    showToast('Treino salvo')
    navigation.goBack()
  }

  const exercises = workout?.exercises ?? []
  const existingExerciseIds = exercises.map(te => te.exercise.id)

  const currentTechSet = (() => {
    if (!techniquePicker.teId || !techniquePicker.setId) return null
    return (localSets[techniquePicker.teId] ?? []).find(s => s.id === techniquePicker.setId) ?? null
  })()

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F0F0F5" />
        </TouchableOpacity>
        <TextInput
          style={s.headerTitle}
          value={workoutName}
          onChangeText={handleNameChange}
          placeholder="Nome do treino"
          placeholderTextColor="#4A4A5A"
          returnKeyType="done"
          blurOnSubmit
        />
        <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
          <LinearGradient colors={['#2979FF', '#1565C0']} style={s.savePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.saveText}>Salvar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TextInput
            style={s.notesInput}
            value={workoutNotes}
            onChangeText={handleWorkoutNotesChange}
            placeholder="Adicionar descrição..."
            placeholderTextColor="#3A3A4A"
            multiline
            blurOnSubmit
          />
          <View style={s.sectionDivider} />

          {exercises.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="barbell-outline" size={48} color="#2A2A35" />
              <Text style={s.emptyTitle}>Nenhum exercício</Text>
              <Text style={s.emptySub}>Adicione exercícios ao seu treino</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => { setPickerMode('add'); setPickerOpen(true) }} activeOpacity={0.7}>
                <Text style={s.emptyBtnText}>Adicionar exercício</Text>
              </TouchableOpacity>
            </View>
          ) : (
            exercises.map((te, exIdx) => {
              const sets = localSets[te.id] ?? te.sets
              const rest = localRestSeconds[te.id] !== undefined ? localRestSeconds[te.id] : (te.restSeconds ?? null)
              const notes = localNotes[te.id] !== undefined ? localNotes[te.id]! : (te.notes ?? '')

              const isInSuperset = !!te.supersetGroupId
              const prevTe = exIdx > 0 ? exercises[exIdx - 1] : null
              const nextTe = exIdx < exercises.length - 1 ? exercises[exIdx + 1] : null
              const isFirstInPair = isInSuperset && prevTe?.supersetGroupId !== te.supersetGroupId
              const isLastInPair = isInSuperset && nextTe?.supersetGroupId !== te.supersetGroupId

              return (
                <View key={te.id} style={[
                  s.card,
                  isInSuperset && s.cardSuperset,
                  isFirstInPair && s.cardSupersetFirst,
                  isLastInPair && s.cardSupersetLast,
                  !isLastInPair && isInSuperset && { marginBottom: 2 },
                ]}>
                  {isInSuperset && (
                    <View style={s.supersetBadge}>
                      <Text style={s.supersetBadgeText}>
                        {te.technique === 'BISET' ? '⇅ BISET' : '⇅ SUPERSET'}
                      </Text>
                    </View>
                  )}

                  {/* Exercise header */}
                  <View style={s.cardTop}>
                    <View style={s.imgContainer}>
                      {te.exercise.gifUrl ? (
                        <Image source={{ uri: te.exercise.gifUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <Ionicons name="barbell-outline" size={24} color="#4A4A5A" />
                      )}
                    </View>
                    <View style={s.cardMid}>
                      <Text style={s.exName} numberOfLines={1}>{te.exercise.name}</Text>
                      {te.exercise.equipment ? (
                        <View style={s.equipPill}>
                          <Text style={s.equipPillText}>{txEquip(te.exercise.equipment)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity style={s.dotBtn} onPress={() => setSheet({ visible: true, teId: te.id })}>
                      <Ionicons name="ellipsis-vertical" size={18} color="#8A8A9A" />
                    </TouchableOpacity>
                  </View>

                  {/* Coach notes */}
                  <TextInput
                    style={s.exerciseNotesInput}
                    value={notes}
                    onChangeText={val => handleNotesChange(te.id, val)}
                    placeholder="Observações do exercício..."
                    placeholderTextColor="#3A3A4A"
                    multiline
                    blurOnSubmit
                  />

                  {/* Volume counter */}
                  <VolumeCounter sets={sets} />

                  {/* Set rows */}
                  {sets.map((set, i) => {
                    const rw = localRepsWeight[set.id] ?? { reps: set.targetReps ?? '', weight: set.targetWeight != null ? String(set.targetWeight) : '' }
                    return (
                      <SetRow
                        key={set.id}
                        set={set}
                        index={i}
                        reps={rw.reps}
                        weight={rw.weight}
                        failedBlocks={failedBlocks}
                        onRepsChange={v => handleRepsChange(set.id, v)}
                        onWeightChange={v => handleWeightChange(set.id, v)}
                        onTechniqueTap={() => setTechniquePicker({ visible: true, teId: te.id, setId: set.id })}
                        onLongPress={() => {
                          if (sets.length > 1) {
                            setConfirmDeleteSet({ visible: true, teId: te.id, setId: set.id })
                          }
                        }}
                        onToggleFailed={handleToggleFailed}
                      />
                    )
                  })}

                  {/* Add / Remove set buttons */}
                  <View style={s.setActions}>
                    <TouchableOpacity
                      style={[s.setActionBtn, sets.length <= 1 && s.setActionBtnDisabled]}
                      onPress={() => {
                        if (sets.length <= 1) return
                        setConfirmRemoveLastSet({ visible: true, teId: te.id })
                      }}
                      disabled={sets.length <= 1}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color={sets.length <= 1 ? '#2A2A35' : '#8A8A9A'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.addSerieBtn}
                      onPress={() => handleAddSet(te.id)}
                      disabled={addingSet[te.id]}
                      activeOpacity={0.7}
                    >
                      {addingSet[te.id] ? (
                        <ActivityIndicator size="small" color="#4FC3F7" />
                      ) : (
                        <>
                          <Ionicons name="add-circle-outline" size={14} color="#4FC3F7" />
                          <Text style={s.addSerieText}>Adicionar série</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Rest time */}
                  <TouchableOpacity
                    style={s.restRow}
                    onPress={() => setRestPicker({ visible: true, teId: te.id })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="timer-outline" size={14} color="#555560" />
                    <Text style={s.restLabel}>Descanso</Text>
                    <Text style={s.restValue}>{formatRest(rest)}</Text>
                    <Ionicons name="chevron-forward" size={12} color="#3A3A4A" />
                  </TouchableOpacity>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* FAB */}
      {!isLoading && exercises.length > 0 && (
        <View style={[s.fab, { bottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={s.fabBtn} onPress={() => { setPickerMode('add'); setPickerOpen(true) }} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#4FC3F7" />
            <Text style={s.fabText}>Adicionar exercício</Text>
          </TouchableOpacity>
        </View>
      )}

      <ExercisePickerModal
        visible={pickerOpen}
        mode={pickerMode}
        workoutId={workoutId}
        replaceTargetId={replaceTargetId}
        existingExerciseIds={existingExerciseIds}
        onClose={() => setPickerOpen(false)}
        onAdded={() => { qc.invalidateQueries({ queryKey: ['workout', workoutId] }); setPickerOpen(false) }}
        onReplaced={() => { qc.invalidateQueries({ queryKey: ['workout', workoutId] }); setPickerOpen(false) }}
      />

      <ActionSheet
        visible={sheet.visible}
        onClose={() => setSheet({ visible: false, teId: null })}
        actions={(() => {
          const sheetTe = exercises.find(te => te.id === sheet.teId)
          return [
            {
              label: 'Substituir exercício',
              onPress: () => {
                setReplaceTargetId(sheet.teId)
                setPickerMode('replace')
                setTimeout(() => setPickerOpen(true), 350)
              },
            },
            ...(sheetTe && !sheetTe.supersetGroupId ? [
              {
                label: 'Criar Biset',
                onPress: () => {
                  const sourceTeId = sheet.teId!
                  setTimeout(() => setSupersetPicker({ visible: true, type: 'BISET', sourceTeId }), 350)
                },
              },
              {
                label: 'Criar Superset',
                onPress: () => {
                  const sourceTeId = sheet.teId!
                  setTimeout(() => setSupersetPicker({ visible: true, type: 'SUPERSET', sourceTeId }), 350)
                },
              },
            ] : []),
            ...(sheetTe?.supersetGroupId ? [
              {
                label: 'Desfazer Bi/Superset',
                destructive: true,
                onPress: () => {
                  api.trainingExercises.dissolveSuperset(sheetTe.supersetGroupId!)
                    .then(() => qc.invalidateQueries({ queryKey: ['workout', workoutId] }))
                    .catch(() => showToast('Erro ao desfazer superset'))
                },
              },
            ] : []),
            {
              label: 'Remover exercício',
              destructive: true,
              onPress: () => {
                const teId = sheet.teId
                if (!teId) return
                setConfirmRemoveTe({ visible: true, teId })
              },
            },
            { label: 'Cancelar', cancel: true, onPress: () => {} },
          ]
        })()}
      />

      <RestPickerModal
        visible={restPicker.visible}
        initialSeconds={restPicker.teId != null ? (localRestSeconds[restPicker.teId] ?? null) : null}
        onConfirm={secs => { if (restPicker.teId) handleRestConfirm(restPicker.teId, secs) }}
        onClose={() => setRestPicker({ visible: false, teId: null })}
      />

      <ConfirmModal
        visible={confirmRemoveTe.visible}
        title="Remover exercício"
        message="Tem certeza que deseja remover este exercício?"
        confirmText="Remover"
        destructive
        onConfirm={() => {
          if (confirmRemoveTe.teId) {
            api.trainingExercises.delete(confirmRemoveTe.teId)
              .then(() => qc.invalidateQueries({ queryKey: ['workout', workoutId] }))
              .catch(() => showToast('Erro ao remover exercício'))
          }
          setConfirmRemoveTe({ visible: false, teId: null })
        }}
        onCancel={() => setConfirmRemoveTe({ visible: false, teId: null })}
      />

      <ConfirmModal
        visible={confirmDeleteSet.visible}
        title="Excluir série"
        message="Tem certeza que deseja excluir esta série?"
        confirmText="Excluir"
        destructive
        onConfirm={() => {
          if (confirmDeleteSet.teId && confirmDeleteSet.setId)
            handleDeleteSet(confirmDeleteSet.teId, confirmDeleteSet.setId)
          setConfirmDeleteSet({ visible: false, teId: null, setId: null })
        }}
        onCancel={() => setConfirmDeleteSet({ visible: false, teId: null, setId: null })}
      />

      <ConfirmModal
        visible={confirmRemoveLastSet.visible}
        title="Remover última série"
        message="Remover a última série deste exercício?"
        confirmText="Remover"
        destructive
        onConfirm={() => {
          if (confirmRemoveLastSet.teId) handleRemoveLastSet(confirmRemoveLastSet.teId)
          setConfirmRemoveLastSet({ visible: false, teId: null })
        }}
        onCancel={() => setConfirmRemoveLastSet({ visible: false, teId: null })}
      />

      <TechniquePickerSheet
        visible={techniquePicker.visible}
        currentSetType={currentTechSet?.setType ?? 'WORKING'}
        currentTechnique={currentTechSet?.technique ?? 'NONE'}
        currentConfig={currentTechSet?.techniqueConfig ?? null}
        onConfirm={sel => {
          if (techniquePicker.teId && techniquePicker.setId)
            handleTechniqueChange(techniquePicker.teId, techniquePicker.setId, sel)
        }}
        onClose={() => setTechniquePicker({ visible: false, teId: null, setId: null })}
      />

      <SupersetPickerModal
        visible={supersetPicker.visible}
        type={supersetPicker.type}
        sourceTeId={supersetPicker.sourceTeId ?? ''}
        exercises={exercises}
        onPick={(targetTeId) => {
          if (supersetPicker.sourceTeId) {
            api.trainingExercises.createSuperset({
              workoutId,
              exerciseIds: [supersetPicker.sourceTeId, targetTeId],
              type: supersetPicker.type,
            })
              .then(() => qc.invalidateQueries({ queryKey: ['workout', workoutId] }))
              .catch(() => showToast('Erro ao criar superset'))
          }
          setSupersetPicker({ visible: false, type: 'BISET', sourceTeId: null })
        }}
        onClose={() => setSupersetPicker({ visible: false, type: 'BISET', sourceTeId: null })}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 18, paddingTop: 4, paddingBottom: 10, gap: 8,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerTitle: {
    flex: 1, color: '#F0F0F5', fontSize: 19, fontWeight: '500', paddingVertical: 4,
  },
  savePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  notesInput: {
    color: '#8A8A9A', fontSize: 13,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, minHeight: 36,
  },
  sectionDivider: { height: 1, backgroundColor: '#2A2A35', marginBottom: 12 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '500', marginTop: 8 },
  emptySub: { color: '#8A8A9A', fontSize: 14 },
  emptyBtn: {
    marginTop: 16, height: 46, paddingHorizontal: 28,
    borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(41,121,255,0.35)',
    backgroundColor: 'rgba(41,121,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyBtnText: { color: '#4FC3F7', fontSize: 15, fontWeight: '500' },

  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 110 },

  card: {
    backgroundColor: '#1E1E24',
    borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  cardSuperset: { borderLeftWidth: 3, borderLeftColor: '#4FC3F7' },
  cardSupersetFirst: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  cardSupersetLast: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  imgContainer: {
    width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardMid: { flex: 1 },
  exName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  equipPill: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5, alignSelf: 'flex-start',
  },
  equipPillText: { color: '#8A8A9A', fontSize: 11 },
  dotBtn: { padding: 4, flexShrink: 0 },

  exerciseNotesInput: {
    color: '#8A8A9A', fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6,
    backgroundColor: 'rgba(42,42,53,0.6)', borderRadius: 8, minHeight: 30,
  },

  setActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 4, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: '#252530', paddingTop: 8,
  },
  setActionBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: '#2A2A35',
    justifyContent: 'center', alignItems: 'center',
  },
  setActionBtnDisabled: { opacity: 0.3 },
  addSerieBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32,
  },
  addSerieText: { color: '#4FC3F7', fontSize: 13 },

  restRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#252530',
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9,
  },
  restLabel: { flex: 1, color: '#8A8A9A', fontSize: 13 },
  restValue: { color: '#F0F0F5', fontSize: 13, fontWeight: '500' },

  supersetBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(79,195,247,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  supersetBadgeText: { color: '#4FC3F7', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  fab: { position: 'absolute', left: 16, right: 16 },
  fabBtn: {
    height: 46, borderRadius: 12,
    backgroundColor: '#1E1E24',
    borderWidth: 1, borderColor: '#2A2A35',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  fabText: { color: '#4FC3F7', fontSize: 14, fontWeight: '500' },
})

const sr = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    width: 28, height: 28, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  repsInput: {
    flex: 1, height: 40,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8, textAlign: 'center', color: '#F0F0F5', fontSize: 15, fontWeight: '500',
  },
  timesText: { width: 14, textAlign: 'center', color: '#2A2A35', fontSize: 13 },
  weightInput: {
    flex: 1.2, height: 40,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8, textAlign: 'center', color: '#F0F0F5', fontSize: 15, fontWeight: '500',
  },
  kgText: { width: 18, color: '#555560', fontSize: 11 },
  volumeHint: { color: '#8A8A9A', fontSize: 10, marginTop: 3, marginLeft: 35 },
  backOffHint: { color: '#FF5252', fontSize: 11, marginTop: 3, marginLeft: 35, opacity: 0.7 },
})

const exp = StyleSheet.create({
  wrap: { marginTop: 8, marginLeft: 35 },
  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  sepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  sepText: { color: '#4A4A5A', fontSize: 10, marginHorizontal: 8 },
  block: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  blockMr: { backgroundColor: 'rgba(123,97,255,0.1)' },
  blockLabel: { color: '#8A8A9A', fontSize: 12 },
  failBtn: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: '#3A3A4A',
    backgroundColor: 'transparent',
  },
  failBtnActive: { backgroundColor: '#FF5252', borderColor: '#FF5252' },
  failBtnText: { color: '#4A4A5A', fontSize: 11, fontWeight: '500' },
  failBtnTextActive: { color: '#fff' },
})

const vc = StyleSheet.create({
  text: { color: '#3A3A4A', fontSize: 11, marginBottom: 8, marginLeft: 2 },
  valid: { color: '#00E676' },
})

const rp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1E1E24',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingBottom: 36, paddingHorizontal: 24,
  },
  handle: { width: 36, height: 4, backgroundColor: '#2A2A35', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { color: '#F0F0F5', fontSize: 17, fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#4A4A5A', fontSize: 12, textAlign: 'center', marginBottom: 24 },
  wheels: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 4 },
  colon: { color: '#8A8A9A', fontSize: 30, fontWeight: '200', marginHorizontal: 4 },
  unit: { color: '#4A4A5A', fontSize: 12, marginLeft: 10, alignSelf: 'center' },
  confirmBtn: { height: 50, borderRadius: 12, backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})

const wh = StyleSheet.create({
  wrap: { height: WHEEL_H * 3, overflow: 'hidden', width: 72 },
  selection: {
    position: 'absolute', top: WHEEL_H, left: 4, right: 4, height: WHEEL_H,
    backgroundColor: 'rgba(41,121,255,0.12)', borderRadius: 8,
  },
  item: { height: WHEEL_H, justifyContent: 'center', alignItems: 'center' },
  itemText: { color: '#3A3A4A', fontSize: 20 },
  itemActive: { color: '#F0F0F5', fontSize: 26, fontWeight: '600' },
})
