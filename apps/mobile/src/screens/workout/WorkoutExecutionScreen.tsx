import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Modal, Pressable, Animated,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExerciseCardShell, cardMetaStyles, cardBodyStyles, CARD_IMG_SIZE } from '../../components/ExerciseCardShell'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as SecureStore from 'expo-secure-store'
import { useSessionStore } from '../../store/sessionStore'
import { ExercisePickerModal } from './ExercisePickerModal'
import { TechniquePickerSheet, TechniqueSelection } from './TechniquePickerSheet'
import { showToast } from '../../components/Toast'
import * as Haptics from 'expo-haptics'
import { api } from '../../lib/api'
import type {
  ExecutionExerciseRecord, ExecutionSetLogRecord,
  PlannedSetTechnique, SetType, TechniqueConfig,
} from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'

const REST_TIMER_TIP_KEY = 'rest_timer_tip_seen_v1'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<AppStackParamList>
type RouteProps = RouteProp<AppStackParamList, 'WorkoutExecution'>

// ─── Tech style palette ───────────────────────────────────────────────────────

const TECH_STYLE: Record<string, { borderColor: string; badgeBg: string; badgeText: string; badge: string }> = {
  WARMUP:       { borderColor: '#FFB300', badgeBg: '#2A2200', badgeText: '#FFB300', badge: 'W' },
  FEEDER:       { borderColor: '#4FC3F7', badgeBg: '#002233', badgeText: '#4FC3F7', badge: 'F' },
  REST_PAUSE:   { borderColor: '#2979FF', badgeBg: '#001A3A', badgeText: '#4FC3F7', badge: 'RP' },
  MUSCLE_ROUND: { borderColor: '#7B61FF', badgeBg: '#1A1030', badgeText: '#A78BFA', badge: 'MR' },
  CLUSTER_SET:  { borderColor: '#00E676', badgeBg: '#002210', badgeText: '#00E676', badge: 'CS' },
  BACK_OFF:     { borderColor: '#F97316', badgeBg: '#2A1400', badgeText: '#F97316', badge: 'BO' },
  DROP_SET:     { borderColor: '#EF4444', badgeBg: '#2A0A0A', badgeText: '#EF4444', badge: 'DS' },
}
const DEFAULT_STYLE = { borderColor: '#252530', badgeBg: '#1E1E2C', badgeText: '#555560', badge: '' }

function getTechStyle(setType: SetType, technique: PlannedSetTechnique) {
  if (setType === 'WARMUP') return TECH_STYLE['WARMUP']!
  if (setType === 'FEEDER') return TECH_STYLE['FEEDER']!
  if (technique !== 'NONE') return TECH_STYLE[technique] ?? DEFAULT_STYLE
  return DEFAULT_STYLE
}

function getBadge(setType: SetType, technique: PlannedSetTechnique, idx: number) {
  if (setType === 'WARMUP') return 'W'
  if (setType === 'FEEDER') return 'F'
  if (technique !== 'NONE') return TECH_STYLE[technique]?.badge ?? String(idx + 1)
  return String(idx + 1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

// ─── Done button (rounded-rect, replaces round circle) ───────────────────────

function DoneButton({ checked, onPress, size = 38 }: { checked: boolean; onPress: () => void; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current
  // Start at 1 (opacity=0, scale=2) so the ring is invisible until first check press
  const ring = useRef(new Animated.Value(1)).current

  function handlePress() {
    if (!checked) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.75, duration: 55, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1.0, friction: 3, tension: 280, useNativeDriver: true }),
      ]).start()
      ring.setValue(0)
      Animated.timing(ring, { toValue: 1, duration: 450, useNativeDriver: true }).start()
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }),
      ]).start()
    }
    onPress()
  }

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.0] })
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 0.2, 0] })

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: size, height: size, borderRadius: 9,
            backgroundColor: '#00E676',
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }}
        />
        <Animated.View style={[
          { width: size, height: size, borderRadius: 9, justifyContent: 'center', alignItems: 'center', transform: [{ scale }] },
          checked ? {
            backgroundColor: '#00E676',
            shadowColor: '#00E676',
            shadowOpacity: 0.45,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 5,
          } : {
            borderWidth: 1.5,
            borderColor: '#3A3A50',
            backgroundColor: 'rgba(255,255,255,0.03)',
          },
        ]}>
          {checked && <Ionicons name="checkmark" size={Math.round(size * 0.52)} color="#fff" />}
        </Animated.View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Simple set row ───────────────────────────────────────────────────────────

type SetRowProps = {
  set: ExecutionSetLogRecord
  index: number
  restSeconds: number | null
  onChecked: (setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onRestEnd: () => void
  onRemove: () => void
  onTechniqueTap: () => void
}

function SimpleSetRow({ set, index, onChecked, onRemove, onTechniqueTap }: SetRowProps) {
  const [reps, setReps] = useState(set.repsCompleted != null && set.repsCompleted > 0 ? String(set.repsCompleted) : '')
  const [weight, setWeight] = useState(set.weightKg != null && set.weightKg > 0 ? String(set.weightKg) : '')
  const [repsFocused, setRepsFocused] = useState(false)
  const [weightFocused, setWeightFocused] = useState(false)
  const ts = getTechStyle(set.setType, set.technique)
  const badge = getBadge(set.setType, set.technique, index)
  const isNonVolume = set.setType === 'WARMUP' || set.setType === 'FEEDER'
  const hasAccent = isNonVolume || set.technique === 'BACK_OFF'
  const flashAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (set.isChecked) {
      flashAnim.setValue(0.35)
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start()
    }
  }, [set.isChecked])

  function handleCheck() {
    const r = reps ? parseInt(reps, 10) : 0
    const w = weight ? parseFloat(weight) : 0
    onChecked(set.id, r, w, null)
  }

  return (
    <View style={[
      ex.setRowOuter,
      hasAccent && { borderLeftWidth: 2, borderLeftColor: ts.borderColor, paddingLeft: 6, marginLeft: 2 },
    ]}>
      <View style={[ex.setRow, set.isChecked && ex.setRowDone]}>
        <TouchableOpacity
          onPress={onTechniqueTap}
          activeOpacity={0.7}
          style={[ex.badge, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}
        >
          <Text style={[ex.badgeText, { color: ts.badgeText }]}>{badge}</Text>
        </TouchableOpacity>

        <View style={ex.inputsGroup}>
          <View style={ex.inputCol}>
            <Text style={ex.inputFieldLabel}>REPS</Text>
            {set.isChecked ? (
              <View style={[ex.inputFieldWrap, ex.inputFieldWrapDone]}>
                <Ionicons name="repeat-outline" size={14} color="#555560" />
                <Text style={ex.inputDone}>{reps || '—'}</Text>
              </View>
            ) : (
              <View style={[ex.inputFieldWrap, repsFocused && ex.inputFieldWrapFocused]}>
                <Ionicons name="repeat-outline" size={14} color={repsFocused ? '#4FC3F7' : '#555560'} />
                <TextInput
                  style={ex.repsInput}
                  value={reps}
                  onChangeText={setReps}
                  placeholder="—"
                  placeholderTextColor="#4A4A5A"
                  selectionColor="#4FC3F7"
                  keyboardType="number-pad"
                  onFocus={() => setRepsFocused(true)}
                  onBlur={() => setRepsFocused(false)}
                />
              </View>
            )}
          </View>

          <View style={ex.inputCol}>
            <Text style={ex.inputFieldLabel}>KG</Text>
            {set.isChecked ? (
              <View style={[ex.inputFieldWrap, ex.inputFieldWrapDone]}>
                <Ionicons name="barbell-outline" size={14} color="#555560" />
                <Text style={ex.inputDone}>{weight || '—'}</Text>
              </View>
            ) : (
              <View style={[ex.inputFieldWrap, weightFocused && ex.inputFieldWrapFocused]}>
                <Ionicons name="barbell-outline" size={14} color={weightFocused ? '#4FC3F7' : '#555560'} />
                <TextInput
                  style={ex.weightInput}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="—"
                  placeholderTextColor="#4A4A5A"
                  selectionColor="#4FC3F7"
                  keyboardType="decimal-pad"
                  onFocus={() => setWeightFocused(true)}
                  onBlur={() => setWeightFocused(false)}
                />
              </View>
            )}
          </View>
        </View>

        <DoneButton checked={set.isChecked} onPress={handleCheck} />

        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }} style={ex.removeSetBtn}>
          <Ionicons name="close" size={13} color="#2E2E3E" />
        </TouchableOpacity>
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ex.completionFlash, { opacity: flashAnim }]} />
      {isNonVolume && <Text style={ex.nonVolNote}>Não conta para o volume</Text>}
    </View>
  )
}

// ─── Technique set row ────────────────────────────────────────────────────────
// Only for techniques with block expansion: REST_PAUSE, CLUSTER_SET, MUSCLE_ROUND, DROP_SET.
// Visual style matches WorkoutDetailScreen expansion components.

type TechSetRowProps = {
  set: ExecutionSetLogRecord
  index: number
  onChecked: (setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onRemove: () => void
  onTechniqueTap: () => void
}

type BlockData = { reps: string; weight: string; failed?: boolean }

function TechSetRow({ set, index, onChecked, onRemove, onTechniqueTap }: TechSetRowProps) {
  const ts = getTechStyle(set.setType, set.technique)
  const badge = getBadge(set.setType, set.technique, index)
  const cfg = set.techniqueConfig as Record<string, unknown> | null

  const initBlocks = useCallback((): BlockData[] => {
    if (!cfg) return [{ reps: '', weight: '' }]
    if (set.technique === 'REST_PAUSE') {
      const pts = cfg['execPoints'] as { reps: null | number; weightKg: null | number }[] | undefined
      // +1 because index 0 is the main set; 1..failurePoints are failure blocks
      const count = ((cfg['failurePoints'] as number) ?? 3) + 1
      // weight is shared via mainWeight — blocks only track reps
      return (pts ?? Array.from({ length: count }, () => ({ reps: null, weightKg: null }))).map(p => ({
        reps: p.reps != null ? String(p.reps) : '',
        weight: '',
      }))
    }
    if (set.technique === 'CLUSTER_SET') {
      const blks = cfg['execBlocks'] as { reps: null | number; weightKg: null | number }[] | undefined
      const count = (cfg['blocks'] as number) ?? 4
      // weight is shared via mainWeight — blocks only track reps
      return (blks ?? Array.from({ length: count }, () => ({ reps: null, weightKg: null }))).map(b => ({
        reps: b.reps != null ? String(b.reps) : '',
        weight: '',
      }))
    }
    if (set.technique === 'MUSCLE_ROUND') {
      const blks = cfg['execBlocks'] as { reps: null | number; weightKg: null | number; failed?: boolean }[] | undefined
      const count = (cfg['blocks'] as number) ?? 6
      return (blks ?? Array.from({ length: count }, () => ({ reps: null, weightKg: null, failed: undefined as boolean | undefined }))).map(b => ({
        reps: b.reps != null ? String(b.reps) : '',
        weight: b.weightKg != null ? String(b.weightKg) : '',
        failed: b.failed,
      }))
    }
    if (set.technique === 'DROP_SET') {
      const drops = cfg['execDrops'] as { weightKg: null | number; reps: null | number }[] | undefined
      const count = (cfg['drops'] as number) ?? 2
      return (drops ?? Array.from({ length: count }, () => ({ weightKg: null, reps: null }))).map(d => ({
        reps: d.reps != null ? String(d.reps) : '',
        weight: d.weightKg != null ? String(d.weightKg) : '',
      }))
    }
    return [{ reps: '', weight: '' }]
  }, [])

  const [blocks, setBlocks] = useState<BlockData[]>(initBlocks)
  const [rpWeightFocused, setRpWeightFocused] = useState(false)
  const restSec = cfg ? ((cfg['restBetweenSeconds'] as number) ?? 0) : 0

  // Shared load for techniques where all blocks use the same weight (CLUSTER, REST_PAUSE)
  const [mainWeight, setMainWeight] = useState<string>(() => {
    if (!cfg) return ''
    if (set.technique === 'CLUSTER_SET') {
      const blks = cfg['execBlocks'] as { weightKg: null | number }[] | undefined
      const w = blks?.[0]?.weightKg
      return w != null ? String(w) : ''
    }
    if (set.technique === 'REST_PAUSE') {
      const pts = cfg['execPoints'] as { weightKg: null | number }[] | undefined
      const w = pts?.[0]?.weightKg
      return w != null ? String(w) : ''
    }
    return ''
  })

  function updateBlock(i: number, field: 'reps' | 'weight', val: string) {
    setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, [field]: val }))
  }
  function toggleFailed(i: number) {
    setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, failed: !b.failed }))
  }

  function buildCfg(bks: BlockData[]): TechniqueConfig | null {
    if (!cfg) return null
    if (set.technique === 'REST_PAUSE')
      return { ...cfg, execPoints: bks.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(mainWeight) || null })) } as TechniqueConfig
    if (set.technique === 'CLUSTER_SET')
      return { ...cfg, execBlocks: bks.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(mainWeight) || null })) } as TechniqueConfig
    if (set.technique === 'MUSCLE_ROUND')
      return { ...cfg, execBlocks: bks.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(b.weight) || null, failed: !!b.failed })) } as TechniqueConfig
    if (set.technique === 'DROP_SET')
      return { ...cfg, execDrops: bks.map(b => ({ weightKg: parseFloat(b.weight) || null, reps: parseInt(b.reps, 10) || null })) } as TechniqueConfig
    return null
  }

  function handleDone() {
    if (set.technique === 'REST_PAUSE' || set.technique === 'CLUSTER_SET') {
      if (!mainWeight || parseFloat(mainWeight) <= 0) {
        showToast('Informe o peso antes de confirmar')
        return
      }
      if (blocks.some(b => !b.reps || parseInt(b.reps, 10) <= 0)) {
        showToast('Preencha as repetições de todos os blocos')
        return
      }
    }
    if (set.technique === 'MUSCLE_ROUND') {
      if (blocks.some(b => !b.reps || parseInt(b.reps, 10) <= 0)) {
        showToast('Preencha as repetições de todos os blocos')
        return
      }
      if (blocks.some(b => !b.weight || parseFloat(b.weight) <= 0)) {
        showToast('Informe o peso de todos os blocos')
        return
      }
    }
    if (set.technique === 'DROP_SET') {
      if (blocks.some(b => !b.reps || parseInt(b.reps, 10) <= 0)) {
        showToast('Preencha as repetições de todos os drops')
        return
      }
      if (blocks.some(b => !b.weight || parseFloat(b.weight) <= 0)) {
        showToast('Informe o peso de todos os drops')
        return
      }
    }
    const totalReps = blocks.reduce((sum, b) => sum + (parseInt(b.reps, 10) || 0), 0)
    const maxWeight = (set.technique === 'CLUSTER_SET' || set.technique === 'REST_PAUSE')
      ? (parseFloat(mainWeight) || 0)
      : blocks.reduce((mx, b) => Math.max(mx, parseFloat(b.weight) || 0), 0)
    onChecked(set.id, totalReps || null, maxWeight || null, buildCfg(blocks))
  }

  const showMainWeight = set.technique === 'CLUSTER_SET' || set.technique === 'REST_PAUSE'

  const blockLabel = (i: number) => {
    if (set.technique === 'REST_PAUSE') return i === 0 ? 'Série Principal' : `Falha ${i}`
    if (set.technique === 'DROP_SET') return `Drop ${i + 1}`
    return `Bloco ${i + 1}`
  }

  return (
    <View style={[ex.techSetWrap, { borderLeftColor: ts.borderColor }]}>
      {/* Header row — badge, label, optional shared weight, remove, done */}
      <View style={[ex.setRow, set.isChecked && ex.setRowDone]}>
        <TouchableOpacity
          onPress={onTechniqueTap}
          activeOpacity={0.7}
          style={[ex.badge, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}
        >
          <Text style={[ex.badgeText, { color: ts.badgeText }]}>{badge}</Text>
        </TouchableOpacity>
        <Text style={ex.techSetNum}>Série {index + 1}</Text>
        <View style={{ flex: 1 }} />
        {showMainWeight && (
          set.isChecked ? (
            <View style={ex.rpWeightWrap}>
              <Text style={ex.rpWeightLabel}>KG</Text>
              <Text style={ex.rpWeightDone}>{mainWeight || '—'}</Text>
            </View>
          ) : (
            <View style={[ex.rpWeightWrap, rpWeightFocused && ex.rpWeightWrapFocused]}>
              <Text style={ex.rpWeightLabel}>KG</Text>
              <TextInput
                style={ex.rpWeightInput}
                value={mainWeight}
                onChangeText={setMainWeight}
                placeholder="—"
                placeholderTextColor="#3A3A4A"
                selectionColor="#4FC3F7"
                keyboardType="decimal-pad"
                onFocus={() => setRpWeightFocused(true)}
                onBlur={() => setRpWeightFocused(false)}
              />
            </View>
          )
        )}
        <DoneButton checked={set.isChecked} onPress={handleDone} />
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }} style={ex.removeSetBtn}>
          <Ionicons name="close" size={13} color="#3A3A4A" />
        </TouchableOpacity>
      </View>

      {/* Technique blocks */}
      <View style={ex.techBlocks}>
        {blocks.map((block, bi) => (
          <View key={bi}>
            {/* Drop set: arrow connector between drops */}
            {bi > 0 && set.technique === 'DROP_SET' && (
              <View style={ex.dropConnector}>
                <View style={ex.dropConnectorLine} />
                <Text style={ex.dropConnectorLabel}>↓ drop</Text>
                <View style={ex.dropConnectorLine} />
              </View>
            )}
            {/* Other techniques: rest separator */}
            {bi > 0 && set.technique !== 'DROP_SET' && restSec > 0 && (
              <View style={ex.blockSep}>
                <View style={ex.blockSepLine} />
                <Text style={ex.blockSepLabel}>{restSec}s</Text>
                <View style={ex.blockSepLine} />
              </View>
            )}
            {bi > 0 && set.technique !== 'DROP_SET' && restSec === 0 && (
              <View style={ex.blockSepThin} />
            )}
            <View style={ex.blockRow}>
              <Text style={ex.blockLabel}>{blockLabel(bi)}</Text>
              <TextInput
                style={ex.blockInput}
                value={block.reps}
                onChangeText={v => updateBlock(bi, 'reps', v)}
                placeholder="reps"
                placeholderTextColor="#3A3A4A"
                selectionColor="#4FC3F7"
                keyboardType="number-pad"
              />
              {/* DROP_SET and MUSCLE_ROUND have per-block weights; CLUSTER/REST_PAUSE use mainWeight */}
              {(set.technique === 'DROP_SET' || set.technique === 'MUSCLE_ROUND') && (
                <>
                  <Text style={ex.blockX}>×</Text>
                  <TextInput
                    style={ex.blockInput}
                    value={block.weight}
                    onChangeText={v => updateBlock(bi, 'weight', v)}
                    placeholder="kg"
                    placeholderTextColor="#3A3A4A"
                    selectionColor="#4FC3F7"
                    keyboardType="decimal-pad"
                  />
                </>
              )}
              {set.technique === 'MUSCLE_ROUND' && (
                <TouchableOpacity
                  style={[ex.failDot, block.failed && ex.failDotActive]}
                  onPress={() => toggleFailed(bi)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {block.failed && <Ionicons name="close" size={10} color="#fff" />}
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {set.technique === 'MUSCLE_ROUND' && (
          <Text style={ex.mrHint}>Marque o bloco da falha</Text>
        )}
      </View>
    </View>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

type ExerciseCardProps = {
  exercise: ExecutionExerciseRecord
  onSetChecked: (execExId: string, setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onAddSet: (execExId: string) => void
  onRemoveSet: (execExId: string, setId: string) => void
  onRemoveExercise: (execExId: string) => void
  onUpdateNotes: (execExId: string, notes: string) => void
  onTechniqueTap: (execExId: string, setId: string) => void
}

// Techniques that need block-level expansion (mirrors WorkoutDetailScreen)
function needsBlockExpansion(t: PlannedSetTechnique) {
  return t === 'REST_PAUSE' || t === 'CLUSTER_SET' || t === 'MUSCLE_ROUND' || t === 'DROP_SET'
}

function ExerciseCard({ exercise, onSetChecked, onAddSet, onRemoveSet, onRemoveExercise, onUpdateNotes, onTechniqueTap }: ExerciseCardProps) {
  const [notes, setNotes] = useState(exercise.exerciseNotes ?? '')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => onUpdateNotes(exercise.id, val), 300)
  }

  return (
    <ExerciseCardShell
      gifUrl={exercise.exercise.gifUrl ?? null}
      name={exercise.exercise.name}
      meta={
        <View style={cardMetaStyles.row}>
          <Text style={cardMetaStyles.text}>{exercise.exercise.muscleGroup.toLowerCase()}</Text>
          <Text style={cardMetaStyles.dot}>·</Text>
          <Text style={cardMetaStyles.text}>{exercise.sets.length} {exercise.sets.length === 1 ? 'série' : 'séries'}</Text>
        </View>
      }
      rightSlot={
        <TouchableOpacity
          onPress={() => onRemoveExercise(exercise.id)}
          style={ex.removeExBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={15} color="#3A3A4A" />
        </TouchableOpacity>
      }
    >
      <View style={cardBodyStyles.observationWrap}>
        <TextInput
          style={cardBodyStyles.observationInput}
          value={notes}
          onChangeText={handleNotesChange}
          placeholder="Adicionar observação..."
          placeholderTextColor="#8A8A9A"
          selectionColor="#4FC3F7"
          multiline
        />
      </View>

      <View style={ex.setsWrap}>
        {exercise.sets.map((set, idx) => {
          if (needsBlockExpansion(set.technique)) {
            return (
              <TechSetRow
                key={set.id}
                set={set}
                index={idx}
                onChecked={(id, reps, weight, cfg) => onSetChecked(exercise.id, id, reps, weight, cfg)}
                onRemove={() => onRemoveSet(exercise.id, set.id)}
                onTechniqueTap={() => onTechniqueTap(exercise.id, set.id)}
              />
            )
          }
          return (
            <SimpleSetRow
              key={set.id}
              set={set}
              index={idx}
              restSeconds={null}
              onChecked={(id, reps, weight, cfg) => onSetChecked(exercise.id, id, reps, weight, cfg)}
              onRestEnd={() => {}}
              onRemove={() => onRemoveSet(exercise.id, set.id)}
              onTechniqueTap={() => onTechniqueTap(exercise.id, set.id)}
            />
          )
        })}

        <TouchableOpacity style={cardBodyStyles.addSetBtn} onPress={() => onAddSet(exercise.id)} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={14} color="#8A8A9A" />
          <Text style={cardBodyStyles.addSetText}>Adicionar série</Text>
        </TouchableOpacity>
      </View>
    </ExerciseCardShell>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function WorkoutExecutionScreen() {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<RouteProps>()
  const { workoutId } = route.params

  const insets = useSafeAreaInsets()
  const store = useSessionStore()
  const [isLoading, setIsLoading] = useState(true)
  const [cancelModal, setCancelModal] = useState(false)
  const [finishModal, setFinishModal] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [techniquePicker, setTechniquePicker] = useState<{
    visible: boolean; execExId: string | null; setId: string | null
  }>({ visible: false, execExId: null, setId: null })
  const [barRestRemaining, setBarRestRemaining] = useState(0)
  const [restPickerVisible, setRestPickerVisible] = useState(false)
  const [restTimerTipVisible, setRestTimerTipVisible] = useState(false)
  const [customRestInput, setCustomRestInput] = useState('')
  const barRestRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tipSeenRef = useRef(false)

  const session = store.session
  const sessionId = store.sessionId

  const currentExecSet = (() => {
    if (!techniquePicker.execExId || !techniquePicker.setId) return null
    const ex = session?.exercises.find(e => e.id === techniquePicker.execExId)
    return ex?.sets.find(s => s.id === techniquePicker.setId) ?? null
  })()

  useEffect(() => {
    SecureStore.getItemAsync(REST_TIMER_TIP_KEY).then(val => {
      tipSeenRef.current = val === 'true'
    })
    return () => { if (barRestRef.current) clearInterval(barRestRef.current) }
  }, [])

  function dismissRestTimerTip(dontShowAgain: boolean) {
    if (dontShowAgain) {
      tipSeenRef.current = true
      SecureStore.setItemAsync(REST_TIMER_TIP_KEY, 'true')
    }
    setRestTimerTipVisible(false)
  }

  function startBarRest(seconds: number) {
    if (barRestRef.current) clearInterval(barRestRef.current)
    setBarRestRemaining(seconds)
    barRestRef.current = setInterval(() => {
      setBarRestRemaining(prev => {
        if (prev <= 1) {
          clearInterval(barRestRef.current!)
          barRestRef.current = null
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function cancelBarRest() {
    if (barRestRef.current) { clearInterval(barRestRef.current); barRestRef.current = null }
    setBarRestRemaining(0)
  }

  useEffect(() => {
    async function init() {
      try {
        if (store.isActive && store.session) {
          const sessionMatchesRoute = workoutId
            ? store.session.workoutId === workoutId
            : store.session.isFreeWorkout
          if (sessionMatchesRoute) {
            setIsLoading(false)
            store.startTimer()
            return
          }
          // Active session is for a different workout — discard and start fresh
          store.clearSession()
        }
        const res = await api.sessions.start(workoutId ? { workoutId } : {})
        store.setSession(res.data.session)
        store.startTimer()
      } catch {
        showToast('Erro ao iniciar treino')
        navigation.goBack()
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  async function handleSetChecked(execExId: string, setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) {
    if (!sessionId) return
    const set = session?.exercises.find(e => e.id === execExId)?.sets.find(s => s.id === setId)
    if (!set) return
    const wasChecked = set.isChecked
    store.updateSet(execExId, setId, { isChecked: !wasChecked, repsCompleted: reps, weightKg: weight })
    try {
      await api.sessions.updateSet(sessionId, setId, {
        isChecked: !wasChecked, repsCompleted: reps, weightKg: weight, techniqueConfig: cfg,
      })
    } catch {
      store.updateSet(execExId, setId, { isChecked: wasChecked })
      showToast('Erro ao salvar série')
    }
  }

  async function handleSetTechniqueChange(execExId: string, setId: string, sel: TechniqueSelection) {
    if (!sessionId) return
    store.updateSet(execExId, setId, {
      setType: sel.setType,
      technique: sel.technique,
      techniqueConfig: sel.config,
    })
    try {
      await api.sessions.updateSet(sessionId, setId, {
        setType: sel.setType,
        technique: sel.technique,
        techniqueConfig: sel.config,
      })
    } catch {
      store.updateSet(execExId, setId, { setType: 'WORKING', technique: 'NONE' })
      showToast('Erro ao atualizar técnica')
    }
  }

  async function handleAddSet(execExId: string) {
    if (!sessionId) return
    try {
      const res = await api.sessions.addSet(sessionId, execExId)
      store.addSet(execExId, res.data.set)
    } catch {
      showToast('Erro ao adicionar série')
    }
  }

  async function handleRemoveSet(execExId: string, setId: string) {
    if (!sessionId) return
    store.removeSet(execExId, setId)
    try {
      await api.sessions.removeSet(sessionId, setId)
    } catch {
      showToast('Erro ao remover série')
    }
  }

  async function handleAddExercise(exerciseId: string) {
    if (!sessionId) return
    try {
      const res = await api.sessions.addExercise(sessionId, { exerciseId, setCount: 0 })
      store.addExercise(res.data.exercise)
    } catch {
      showToast('Erro ao adicionar exercício')
    }
  }

  async function handleRemoveExercise(execExId: string) {
    if (!sessionId) return
    store.removeExercise(execExId)
    try {
      await api.sessions.removeExercise(sessionId, execExId)
    } catch {
      showToast('Erro ao remover exercício')
    }
  }

  async function handleUpdateNotes(execExId: string, notes: string) {
    if (!sessionId) return
    store.updateExerciseNotes(execExId, notes || null)
    try {
      await api.sessions.updateExerciseNotes(sessionId, execExId, notes)
    } catch {}
  }

  async function handleCancel() {
    if (!sessionId) { store.clearSession(); navigation.goBack(); return }
    try {
      await api.sessions.cancel(sessionId)
    } catch {}
    store.clearSession()
    navigation.goBack()
  }

  async function handleFinish(applyChanges: boolean) {
    if (!sessionId) return
    setFinishModal(false)
    try {
      const res = await api.sessions.finish(sessionId, applyChanges)
      store.stopTimer()
      const finishedSession = res.data.session
      store.clearSession()
      navigation.replace('WorkoutPost', {
        sessionId: finishedSession.id,
        workoutName: finishedSession.workoutName ?? 'Treino Livre',
        durationMin: finishedSession.durationMin ?? 0,
        totalSets: finishedSession.totalSets ?? 0,
        totalValidSets: finishedSession.totalValidSets ?? 0,
        totalVolume: finishedSession.totalVolume ?? 0,
        exercises: finishedSession.exercises,
      })
    } catch {
      showToast('Erro ao finalizar treino')
    }
  }

  function onFinalizarPress() {
    if (session?.hasChanges && session?.workoutId) {
      setFinishModal(true)
    } else {
      handleFinish(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
          <Text style={s.loadingText}>Iniciando treino...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const exercises = session?.exercises ?? []

  const analyticsData = (() => {
    let totalVolume = 0
    let validSetsCount = 0
    const perExercise = exercises.map(ex => {
      let exVolume = 0
      let exValidSets = 0
      for (const set of ex.sets) {
        if (set.isChecked) {
          exVolume += (set.repsCompleted ?? 0) * (set.weightKg ?? 0)
          if (set.setType === 'WORKING') exValidSets++
        }
      }
      totalVolume += exVolume
      validSetsCount += exValidSets
      return { id: ex.id, name: ex.exercise.name, muscleGroup: ex.exercise.muscleGroup, volume: exVolume, validSets: exValidSets }
    }).filter(e => e.volume > 0 || e.validSets > 0)
    return { totalVolume, validSetsCount, perExercise }
  })()

  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0)
  const checkedSets = exercises.reduce((acc, e) => acc + e.sets.filter(s => s.isChecked).length, 0)
  const progress = totalSets > 0 ? checkedSets / totalSets : 0

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerWrap}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setCancelModal(true)} style={s.headerSideBtn}>
            <Ionicons name="close" size={22} color="#8A8A9A" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {session?.workoutName ?? 'Treino Livre'}
          </Text>
          <TouchableOpacity onPress={() => setAnalyticsOpen(true)} style={s.headerSideBtn}>
            <Ionicons name="stats-chart-outline" size={20} color="#8A8A9A" />
          </TouchableOpacity>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        scrollEventThrottle={16}
      >
        {exercises.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="barbell-outline" size={48} color="#2A2A35" />
            <Text style={s.emptyText}>Adicione um exercício para começar</Text>
          </View>
        )}

        {exercises.map(exercise => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onSetChecked={handleSetChecked}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onRemoveExercise={handleRemoveExercise}
            onUpdateNotes={handleUpdateNotes}
            onTechniqueTap={(execExId, setId) => setTechniquePicker({ visible: true, execExId, setId })}
          />
        ))}

        <TouchableOpacity style={s.addExBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color="#8A8A9A" />
          <Text style={s.addExText}>Adicionar exercício</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom control bar */}
      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={s.barSection}
          onPress={barRestRemaining > 0 ? cancelBarRest : () => {
            if (!tipSeenRef.current) {
              setRestTimerTipVisible(true)
            } else {
              setRestPickerVisible(true)
            }
          }}
          activeOpacity={0.7}
        >
          {barRestRemaining > 0 ? (
            <>
              <Text style={s.barRestCountdown}>
                {String(Math.floor(barRestRemaining / 60)).padStart(2, '0')}:{String(barRestRemaining % 60).padStart(2, '0')}
              </Text>
              <Text style={s.barSubLabel}>pular</Text>
            </>
          ) : (
            <>
              <Ionicons name="timer-outline" size={22} color="#555560" />
              <Text style={s.barSubLabel}>Descanso</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.barDivider} />

        <TouchableOpacity
          style={[s.barSection, { flex: 1.3 }]}
          onPress={() => store.isPaused ? store.resumeTimer() : store.pauseTimer()}
          activeOpacity={0.7}
        >
          <Text style={[s.barTimerText, store.isPaused && { color: '#555560' }]}>
            {formatElapsed(store.elapsedSeconds)}
          </Text>
          <View style={s.barTimerRow}>
            <Ionicons name={store.isPaused ? 'play-outline' : 'pause-outline'} size={11} color="#555560" />
            <Text style={s.barSubLabel}>{store.isPaused ? 'retomar' : 'pausar'}</Text>
          </View>
        </TouchableOpacity>

        <View style={s.barDivider} />

        <TouchableOpacity onPress={onFinalizarPress} activeOpacity={0.85} style={s.barFinishBtn}>
          <LinearGradient
            colors={['#2979FF', '#1565C0']}
            style={s.barFinishGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
            <Text style={s.barFinishText}>Finalizar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal visible={analyticsOpen} transparent animationType="fade" onRequestClose={() => setAnalyticsOpen(false)}>
        <View style={s.analyticsOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnalyticsOpen(false)} />
          <View style={s.analyticsModal}>
            <View style={s.analyticsHeader}>
              <Text style={s.analyticsTitle}>Análise da sessão</Text>
              <TouchableOpacity onPress={() => setAnalyticsOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="#555560" />
              </TouchableOpacity>
            </View>

            <View style={s.analyticsSummary}>
              <View style={s.analyticsCard}>
                <Text style={s.analyticsCardNum}>{formatVolume(analyticsData.totalVolume)}</Text>
                <Text style={s.analyticsCardUnit}>kg volume total</Text>
              </View>
              <View style={s.analyticsDivider} />
              <View style={s.analyticsCard}>
                <Text style={s.analyticsCardNum}>{analyticsData.validSetsCount}</Text>
                <Text style={s.analyticsCardUnit}>séries válidas</Text>
              </View>
            </View>

            {analyticsData.perExercise.length > 0 ? (
              <ScrollView style={s.analyticsScroll} showsVerticalScrollIndicator={false}>
                {analyticsData.perExercise.map((e, i) => (
                  <View key={e.id} style={[s.analyticsRow, i === analyticsData.perExercise.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.analyticsExName} numberOfLines={1}>{e.name}</Text>
                      <Text style={s.analyticsExMuscle}>{e.muscleGroup.toLowerCase()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {e.volume > 0 && <Text style={s.analyticsExVol}>{formatVolume(e.volume)} kg</Text>}
                      {e.validSets > 0 && (
                        <Text style={s.analyticsExSets}>{e.validSets} {e.validSets === 1 ? 'série' : 'séries'}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={s.analyticsEmpty}>
                <Text style={s.analyticsEmptyText}>Complete séries para ver análise</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={cancelModal} transparent animationType="fade" onRequestClose={() => setCancelModal(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCancelModal(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Cancelar treino?</Text>
            <Text style={s.modalBody}>Todo o progresso desta sessão será perdido.</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => setCancelModal(false)}>
              <Text style={s.modalBtnPrimaryText}>Continuar treinando</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnDanger} onPress={handleCancel}>
              <Text style={s.modalBtnDangerText}>Cancelar treino</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={finishModal} transparent animationType="fade" onRequestClose={() => setFinishModal(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFinishModal(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Alterações no treino</Text>
            <Text style={s.modalBody}>Você adicionou ou removeu exercícios. Deseja salvar as alterações no programa?</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => handleFinish(true)}>
              <Text style={s.modalBtnPrimaryText}>Salvar alterações</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtnPrimary, { backgroundColor: '#2A2A35' }]} onPress={() => handleFinish(false)}>
              <Text style={[s.modalBtnPrimaryText, { color: '#8A8A9A' }]}>Manter original</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={restPickerVisible} transparent animationType="fade" onRequestClose={() => setRestPickerVisible(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRestPickerVisible(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Tempo de descanso</Text>
            <Text style={s.modalBody}>Defina a duração do seu descanso</Text>
            <View style={s.restInputRow}>
              <TextInput
                style={s.restInput}
                value={customRestInput}
                onChangeText={setCustomRestInput}
                keyboardType="number-pad"
                placeholder="90"
                placeholderTextColor="#3A3A4A"
                selectionColor="#4FC3F7"
                autoFocus
              />
              <Text style={s.restInputUnit}>seg</Text>
            </View>
            <TouchableOpacity
              style={s.modalBtnPrimary}
              onPress={() => {
                const sec = parseInt(customRestInput, 10)
                if (sec > 0) { startBarRest(sec); setRestPickerVisible(false); setCustomRestInput('') }
              }}
            >
              <Text style={s.modalBtnPrimaryText}>Iniciar descanso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnDanger} onPress={() => setRestPickerVisible(false)}>
              <Text style={s.modalBtnDangerText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={restTimerTipVisible} transparent animationType="fade" onRequestClose={() => dismissRestTimerTip(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissRestTimerTip(false)} />
          <View style={s.modal}>
            <View style={s.restTipIconRow}>
              <Ionicons name="timer-outline" size={32} color="#4FC3F7" />
            </View>
            <Text style={s.modalTitle}>Temporizador de descanso</Text>
            <Text style={s.modalBody}>O timer de descanso é opcional e você controla quando ativá-lo. Após completar uma série, toque em Descanso para iniciar a contagem. Defina a duração que quiser.</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => dismissRestTimerTip(false)}>
              <Text style={s.modalBtnPrimaryText}>Entendido</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalBtnDanger, { backgroundColor: 'transparent' }]}
              onPress={() => dismissRestTimerTip(true)}
            >
              <Text style={[s.modalBtnDangerText, { color: '#555560' }]}>Não mostrar novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ExercisePickerModal
        visible={pickerOpen}
        existingExerciseIds={exercises.map(e => e.exerciseId)}
        onSelect={e => handleAddExercise(e.id)}
        onClose={() => setPickerOpen(false)}
      />

      <TechniquePickerSheet
        visible={techniquePicker.visible}
        currentSetType={currentExecSet?.setType ?? 'WORKING'}
        currentTechnique={currentExecSet?.technique ?? 'NONE'}
        currentConfig={currentExecSet?.techniqueConfig ?? null}
        onConfirm={sel => {
          if (techniquePicker.execExId && techniquePicker.setId)
            handleSetTechniqueChange(techniquePicker.execExId, techniquePicker.setId, sel)
        }}
        onClose={() => setTechniquePicker({ visible: false, execExId: null, setId: null })}
      />
    </SafeAreaView>
  )
}

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#8A8A9A', fontSize: 14 },

  headerWrap: { borderBottomWidth: 1, borderBottomColor: '#1E1E24' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  headerSideBtn: { width: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, color: '#F0F0F5', fontSize: 17, fontWeight: '500', textAlign: 'center' },
  progressTrack: { height: 2, backgroundColor: '#2A2A35' },
  progressFill: { height: 2, backgroundColor: '#4FC3F7' },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E1E24',
    backgroundColor: '#141418',
    gap: 6,
  },
  barSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  barDivider: { width: 1, height: 34, backgroundColor: '#252530' },
  barRestCountdown: { color: '#4FC3F7', fontSize: 22, fontFamily: 'monospace', fontWeight: '600' },
  barTimerText: { color: '#F0F0F5', fontSize: 22, fontFamily: 'monospace', fontWeight: '600' },
  barTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  barSubLabel: { color: '#555560', fontSize: 10 },
  barFinishBtn: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  barFinishGrad: { height: 54, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  barFinishText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  scroll: { paddingBottom: 16, paddingTop: 8, gap: 8, paddingHorizontal: 12 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#555560', fontSize: 14, textAlign: 'center' },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 2, paddingVertical: 14,
    borderWidth: 1, borderColor: '#252530', borderStyle: 'dashed', borderRadius: 14,
  },
  addExText: { color: '#8A8A9A', fontSize: 14, fontWeight: '500' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, gap: 10 },
  modalTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  modalBody: { color: '#8A8A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBtnPrimary: { height: 48, borderRadius: 14, backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalBtnDanger: { height: 48, borderRadius: 14, backgroundColor: 'rgba(255,82,82,0.10)', justifyContent: 'center', alignItems: 'center' },
  modalBtnDangerText: { color: '#FF5252', fontSize: 15, fontWeight: '600' },

  restInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 4 },
  restInput: {
    width: 100,
    height: 52,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#252530',
    borderRadius: 12,
    color: '#F0F0F5',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  restInputUnit: { color: '#8A8A9A', fontSize: 15 },
  restTipIconRow: { alignItems: 'center', marginBottom: 4 },

  analyticsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', paddingHorizontal: 20 },
  analyticsModal: {
    backgroundColor: '#1A1A22',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252530',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    maxHeight: '78%',
  },
  analyticsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  analyticsTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  analyticsSummary: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#252530',
  },
  analyticsCard: { flex: 1, alignItems: 'center', gap: 4 },
  analyticsCardNum: { color: '#4FC3F7', fontSize: 30, fontWeight: '700', fontFamily: 'monospace' },
  analyticsCardUnit: { color: '#8A8A9A', fontSize: 11 },
  analyticsDivider: { width: 1, backgroundColor: '#252530', marginHorizontal: 8 },
  analyticsScroll: { maxHeight: 300 },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E28',
    gap: 12,
  },
  analyticsExName: { color: '#F0F0F5', fontSize: 14, fontWeight: '500' },
  analyticsExMuscle: { color: '#555560', fontSize: 11, textTransform: 'capitalize', marginTop: 2 },
  analyticsExVol: { color: '#4FC3F7', fontSize: 14, fontWeight: '600' },
  analyticsExSets: { color: '#8A8A9A', fontSize: 11 },
  analyticsEmpty: { paddingVertical: 40, alignItems: 'center' },
  analyticsEmptyText: { color: '#555560', fontSize: 14 },
})

// ─── Exercise card styles ──────────────────────────────────────────────────────

const ex = StyleSheet.create({
  removeExBtn: {
    width: 30,
    height: CARD_IMG_SIZE + 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  setsWrap: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 10,
  },

  setRowOuter: {
    marginBottom: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },

  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  setRowDone: {
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.18)',
  },
  completionFlash: {
    backgroundColor: '#00E676',
    borderRadius: 10,
  },

  // Badge
  badge: {
    width: 34,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Inputs group — fills space between badge and action buttons
  inputsGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },

  // Input columns — equal flex, stretch children to full column width
  inputCol: {
    flex: 1,
    alignItems: 'stretch',
  },
  inputColLabel: {
    color: '#3A3A4A',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Label above each input field
  inputFieldLabel: {
    color: '#8A8A9A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },

  // Wrapper that holds icon + TextInput (or icon + done Text)
  inputFieldWrap: {
    height: 48,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  inputFieldWrapFocused: {
    borderColor: '#2979FF',
  },
  inputFieldWrapDone: {
    backgroundColor: '#141418',
    borderColor: '#2A2A35',
  },

  // Inputs — live inside inputFieldWrap, no border/bg of their own
  repsInput: {
    flex: 1,
    height: 48,
    color: '#F0F0F5',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  weightInput: {
    flex: 1,
    height: 48,
    color: '#F0F0F5',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  kgLabel: { color: '#3A3A4A', fontSize: 11 },
  inputDone: {
    flex: 1,
    color: 'rgba(0,230,118,0.8)',
    fontSize: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '600',
  },
  inputDoneWide: {},
  nonVolLabel: { color: '#3A3A4A', fontSize: 9, flexShrink: 0 },
  nonVolNote: { color: '#3A3A4A', fontSize: 9, marginLeft: 46, marginTop: 0, marginBottom: 2 },
  removeSetBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  techMainInput: {
    height: 36,
    width: 64,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    color: '#F0F0F5',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 4,
  },

  // Shared KG weight input for REST_PAUSE and CLUSTER_SET header row
  rpWeightWrap: {
    width: 68,
    height: 48,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 2,
  },
  rpWeightWrapFocused: {
    borderColor: '#2979FF',
  },
  rpWeightLabel: {
    color: '#8A8A9A',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rpWeightInput: {
    color: '#F0F0F5',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
    paddingVertical: 0,
  },
  rpWeightDone: {
    color: 'rgba(0,230,118,0.8)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  dropConnector: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  dropConnectorLine: { flex: 1, height: 1, backgroundColor: 'rgba(239,68,68,0.3)' },
  dropConnectorLabel: { color: '#EF4444', fontSize: 10, marginHorizontal: 6 },

  // Technique set
  techSetWrap: {
    borderLeftWidth: 2,
    marginLeft: 2,
    paddingLeft: 6,
    marginBottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  techSetNum: {
    color: '#555560',
    fontSize: 12,
  },

  // Block expansion — matches WorkoutDetailScreen exp.* style
  techBlocks: {
    marginTop: 4,
    marginLeft: 38,
    marginBottom: 4,
  },
  blockSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  blockSepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  blockSepLabel: { color: '#555560', fontSize: 10, marginHorizontal: 6 },
  blockSepThin: { height: 3 },
  blockRow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockLabel: { color: '#555560', fontSize: 11, flex: 1 },
  blockInput: {
    height: 36,
    width: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 5,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#F0F0F5',
    fontSize: 12,
    paddingVertical: 0,
  },
  blockX: { color: '#3A3A4A', fontSize: 11 },

  // Muscle round fail indicator
  failDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#333344',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failDotActive: { backgroundColor: '#FF5252', borderColor: '#FF5252' },
  mrHint: { color: '#555560', fontSize: 10, marginTop: 6, textAlign: 'center' },
})
