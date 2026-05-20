import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Image, ActivityIndicator, Modal, Pressable, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSessionStore } from '../../store/sessionStore'
import { ExercisePickerModal } from './ExercisePickerModal'
import { showToast } from '../../components/Toast'
import * as Haptics from 'expo-haptics'
import { api } from '../../lib/api'
import type {
  ExecutionExerciseRecord, ExecutionSetLogRecord,
  PlannedSetTechnique, SetType, TechniqueConfig,
} from '../../lib/api'
import type { AppStackParamList } from '../../navigation/AppNavigator'

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
const DEFAULT_STYLE = { borderColor: '#2A2A35', badgeBg: '#2A2A35', badgeText: '#8A8A9A', badge: '' }

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

// ─── Elapsed time formatter ───────────────────────────────────────────────────

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ─── Rest timer hook ──────────────────────────────────────────────────────────

function useRestTimer(seconds: number, onEnd: () => void) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRemaining(seconds)
    if (seconds <= 0) return
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          onEnd()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [seconds])

  return remaining
}

// ─── PR Badge ─────────────────────────────────────────────────────────────────

function PRBadge() {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 100 }).start()
  }, [])
  return (
    <Animated.View style={[ex.prBadge, { transform: [{ scale: anim }] }]}>
      <Text style={ex.prText}>🏆 PR</Text>
    </Animated.View>
  )
}

// ─── Check button ─────────────────────────────────────────────────────────────

function CheckButton({ checked, onPress, size = 36 }: { checked: boolean; onPress: () => void; size?: number }) {
  const anim = useRef(new Animated.Value(1)).current
  function handlePress() {
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.75, duration: 80, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
    ]).start()
    onPress()
  }
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View style={[ex.check, { width: size, height: size, borderRadius: size / 2 }, checked && ex.checkDone, { transform: [{ scale: anim }] }]}>
        {checked && <Ionicons name="checkmark" size={size * 0.55} color="#fff" />}
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── Simple set row ───────────────────────────────────────────────────────────

type SetRowProps = {
  set: ExecutionSetLogRecord
  index: number
  isPR: boolean
  restSeconds: number | null
  onChecked: (setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onRestEnd: () => void
  onRemove: () => void
}

function SimpleSetRow({ set, index, isPR, restSeconds, onChecked, onRestEnd, onRemove }: SetRowProps) {
  const [reps, setReps] = useState(set.repsCompleted != null ? String(set.repsCompleted) : '')
  const [weight, setWeight] = useState(set.weightKg != null ? String(set.weightKg) : '')
  const [showRest, setShowRest] = useState(false)
  const ts = getTechStyle(set.setType, set.technique)
  const badge = getBadge(set.setType, set.technique, index)
  const isNonVolume = set.setType === 'WARMUP' || set.setType === 'FEEDER'

  const remainingRest = useRestTimer(showRest && restSeconds ? restSeconds : 0, () => {
    setShowRest(false)
    onRestEnd()
  })

  function handleCheck() {
    const r = reps ? parseInt(reps, 10) : null
    const w = weight ? parseFloat(weight) : null
    if (!set.isChecked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onChecked(set.id, r, w, null)
    if (!set.isChecked && restSeconds && restSeconds > 0) setShowRest(true)
  }

  return (
    <View>
      <View style={[ex.setRow, set.isChecked && ex.setRowDone]}>
        <CheckButton checked={set.isChecked} onPress={handleCheck} />

        <View style={[ex.badge, { backgroundColor: ts.badgeBg }]}>
          <Text style={[ex.badgeText, { color: ts.badgeText }]}>{badge}</Text>
        </View>

        <Text style={ex.setNum}>{index + 1}</Text>

        {set.isChecked ? (
          <>
            <Text style={ex.inputDone}>{reps || '—'}</Text>
            <Text style={ex.inputSep}>×</Text>
            <Text style={ex.inputDone}>{weight || '—'}</Text>
            <Text style={ex.kgLabel}>kg</Text>
          </>
        ) : (
          <>
            <TextInput
              style={ex.repsInput}
              value={reps}
              onChangeText={setReps}
              placeholder="—"
              placeholderTextColor="#333344"
              keyboardType="number-pad"
            />
            <Text style={ex.inputSep}>×</Text>
            <TextInput
              style={ex.weightInput}
              value={weight}
              onChangeText={setWeight}
              placeholder="—"
              placeholderTextColor="#333344"
              keyboardType="decimal-pad"
            />
            <Text style={ex.kgLabel}>kg</Text>
          </>
        )}

        {isPR && <PRBadge />}

        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 4 }}>
          <Ionicons name="close" size={14} color="#3A3A4A" />
        </TouchableOpacity>
      </View>

      {isNonVolume && (
        <Text style={ex.volumeHint}>Não conta no volume</Text>
      )}

      {showRest && restSeconds && restSeconds > 0 && (
        <TouchableOpacity onPress={() => setShowRest(false)} style={ex.restTimer}>
          <Text style={ex.restTimerText}>
            Descanso: {String(Math.floor(remainingRest / 60)).padStart(2, '0')}:{String(remainingRest % 60).padStart(2, '0')}
          </Text>
          <Text style={ex.restSkip}>pular</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Technique set row (with sub-blocks) ──────────────────────────────────────

type TechSetRowProps = {
  set: ExecutionSetLogRecord
  index: number
  isPR: boolean
  onChecked: (setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onRemove: () => void
}

function TechSetRow({ set, index, isPR, onChecked, onRemove }: TechSetRowProps) {
  const ts = getTechStyle(set.setType, set.technique)
  const badge = getBadge(set.setType, set.technique, index)
  const cfg = set.techniqueConfig as Record<string, unknown> | null

  // Initialize local block state from techniqueConfig
  type BlockData = { reps: string; weight: string; checked: boolean; failed?: boolean }
  const initBlocks = useCallback((): BlockData[] => {
    if (!cfg) return [{ reps: '', weight: '', checked: false }]
    if (set.technique === 'REST_PAUSE') {
      const pts = cfg['execPoints'] as { reps: null | number; weightKg: null | number; checked: boolean }[] | undefined
      return (pts ?? Array.from({ length: (cfg['failurePoints'] as number) ?? 3 }, () => ({ reps: null, weightKg: null, checked: false }))).map(p => ({
        reps: p.reps != null ? String(p.reps) : '',
        weight: p.weightKg != null ? String(p.weightKg) : '',
        checked: p.checked,
      }))
    }
    if (set.technique === 'CLUSTER_SET' || set.technique === 'MUSCLE_ROUND') {
      const blks = cfg['execBlocks'] as { reps: null | number; weightKg: null | number; checked: boolean; failed?: boolean }[] | undefined
      const count = (cfg['blocks'] as number) ?? 3
      return (blks ?? Array.from({ length: count }, () => ({ reps: null, weightKg: null, checked: false, failed: false }))).map(b => ({
        reps: b.reps != null ? String(b.reps) : '',
        weight: b.weightKg != null ? String(b.weightKg) : '',
        checked: b.checked,
        failed: b.failed,
      }))
    }
    if (set.technique === 'DROP_SET') {
      const drops = cfg['execDrops'] as { weightKg: null | number; reps: null | number; checked: boolean }[] | undefined
      const count = (cfg['drops'] as number) ?? 2
      return (drops ?? Array.from({ length: count }, () => ({ weightKg: null, reps: null, checked: false }))).map(d => ({
        reps: d.reps != null ? String(d.reps) : '',
        weight: d.weightKg != null ? String(d.weightKg) : '',
        checked: d.checked,
      }))
    }
    return [{ reps: '', weight: '', checked: false }]
  }, [])

  const [blocks, setBlocks] = useState<BlockData[]>(initBlocks)
  const restSec = cfg ? ((cfg['restBetweenSeconds'] as number) ?? 0) : 0

  function toggleBlock(i: number) {
    setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, checked: !b.checked }))
  }
  function toggleFailed(i: number) {
    setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, failed: b.failed ? false : true }))
  }
  function updateBlock(i: number, field: 'reps' | 'weight', val: string) {
    setBlocks(prev => prev.map((b, bi) => bi !== i ? b : { ...b, [field]: val }))
  }

  const allChecked = blocks.every(b => b.checked)

  function handleParentCheck() {
    if (!set.isChecked && !allChecked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Mark all blocks done, then fire parent check
    const updated = blocks.map(b => ({ ...b, checked: true }))
    setBlocks(updated)
    const totalReps = updated.reduce((sum, b) => sum + (parseInt(b.reps, 10) || 0), 0)
    const maxWeight = updated.reduce((mx, b) => Math.max(mx, parseFloat(b.weight) || 0), 0)
    const techCfg = buildUpdatedCfg(updated)
    onChecked(set.id, totalReps || null, maxWeight || null, techCfg)
  }

  function buildUpdatedCfg(updated: BlockData[]): TechniqueConfig | null {
    if (!cfg) return null
    if (set.technique === 'REST_PAUSE') {
      return {
        ...cfg,
        execPoints: updated.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(b.weight) || null, checked: b.checked })),
      } as TechniqueConfig
    }
    if (set.technique === 'CLUSTER_SET') {
      return {
        ...cfg,
        execBlocks: updated.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(b.weight) || null, checked: b.checked })),
      } as TechniqueConfig
    }
    if (set.technique === 'MUSCLE_ROUND') {
      return {
        ...cfg,
        execBlocks: updated.map(b => ({ reps: parseInt(b.reps, 10) || null, weightKg: parseFloat(b.weight) || null, checked: b.checked, failed: !!b.failed })),
      } as TechniqueConfig
    }
    if (set.technique === 'DROP_SET') {
      return {
        ...cfg,
        execDrops: updated.map(b => ({ weightKg: parseFloat(b.weight) || null, reps: parseInt(b.reps, 10) || null, checked: b.checked })),
      } as TechniqueConfig
    }
    return null
  }

  const blockLabel = (i: number) => {
    if (set.technique === 'REST_PAUSE') return `Falha ${i + 1}`
    if (set.technique === 'DROP_SET') return `Drop ${i + 1}`
    return `Bloco ${i + 1}`
  }

  return (
    <View style={[ex.techSetWrap, { borderLeftColor: ts.borderColor }]}>
      {/* Parent row - badge + summary + parent check */}
      <View style={ex.setRow}>
        <CheckButton checked={set.isChecked || allChecked} onPress={handleParentCheck} />
        <View style={[ex.badge, { backgroundColor: ts.badgeBg }]}>
          <Text style={[ex.badgeText, { color: ts.badgeText }]}>{badge}</Text>
        </View>
        <Text style={[ex.setNum, { flex: 1 }]}>{index + 1}</Text>
        {isPR && <PRBadge />}
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={14} color="#3A3A4A" />
        </TouchableOpacity>
      </View>

      {/* Sub-blocks */}
      {blocks.map((block, bi) => (
        <View key={bi}>
          {bi > 0 && restSec > 0 && (
            <View style={ex.restSep}>
              <View style={ex.restDots} />
              <Text style={ex.restSecText}>{restSec}s</Text>
              <View style={ex.restDots} />
            </View>
          )}
          <View style={[ex.blockRow, block.checked && ex.blockRowDone]}>
            <CheckButton checked={block.checked} onPress={() => toggleBlock(bi)} size={26} />
            <Text style={ex.blockLabel}>{blockLabel(bi)}</Text>
            {block.checked ? (
              <>
                <Text style={[ex.inputDone, ex.inputDoneSm]}>{block.reps || '—'}</Text>
                <Text style={[ex.inputSep, { fontSize: 12 }]}>×</Text>
                <Text style={[ex.inputDone, ex.inputDoneSm]}>{block.weight || '—'}</Text>
                <Text style={[ex.kgLabel, { fontSize: 11 }]}>kg</Text>
              </>
            ) : (
              <>
                <TextInput style={ex.repsInputSm} value={block.reps} onChangeText={v => updateBlock(bi, 'reps', v)} placeholder="—" placeholderTextColor="#333344" keyboardType="number-pad" />
                <Text style={[ex.inputSep, { fontSize: 12 }]}>×</Text>
                <TextInput style={ex.weightInputSm} value={block.weight} onChangeText={v => updateBlock(bi, 'weight', v)} placeholder="—" placeholderTextColor="#333344" keyboardType="decimal-pad" />
                <Text style={[ex.kgLabel, { fontSize: 11 }]}>kg</Text>
              </>
            )}
            {set.technique === 'MUSCLE_ROUND' && (
              <TouchableOpacity
                style={[ex.failCircle, block.failed && ex.failCircleActive]}
                onPress={() => toggleFailed(bi)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {block.failed && <Text style={ex.failCircleX}>✗</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

type ExerciseCardProps = {
  exercise: ExecutionExerciseRecord
  prSets: Set<string>
  onSetChecked: (execExId: string, setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) => void
  onAddSet: (execExId: string) => void
  onRemoveSet: (execExId: string, setId: string) => void
  onRemoveExercise: (execExId: string) => void
  onUpdateNotes: (execExId: string, notes: string) => void
}

function ExerciseCard({ exercise, prSets, onSetChecked, onAddSet, onRemoveSet, onRemoveExercise, onUpdateNotes }: ExerciseCardProps) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(exercise.exerciseNotes ?? '')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => onUpdateNotes(exercise.id, val), 300)
  }

  const restSeconds = null // TODO: could derive from exerciseRestSeconds if stored

  return (
    <View style={ex.card}>
      {/* Exercise header */}
      <View style={ex.cardHeader}>
        <View style={ex.imgWrap}>
          {exercise.exercise.gifUrl ? (
            <Image source={{ uri: exercise.exercise.gifUrl }} style={ex.img} resizeMode="cover" />
          ) : (
            <View style={[ex.img, ex.imgPlaceholder]}>
              <Ionicons name="barbell-outline" size={28} color="#3A3A4A" />
            </View>
          )}
          <LinearGradient colors={['transparent', '#1E1E24']} style={ex.imgFade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        </View>

        <View style={ex.cardHeaderRight}>
          <Text style={ex.exerciseName} numberOfLines={2}>{exercise.exercise.name}</Text>
          <Text style={ex.muscleTag}>{exercise.exercise.muscleGroup.toLowerCase()}</Text>
          <View style={ex.cardHeaderActions}>
            <TouchableOpacity style={ex.notesBtn} onPress={() => setNotesOpen(v => !v)}>
              <Text style={ex.notesBtnText}>{notes.trim() ? 'Obs ✓' : 'Obs +'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => onRemoveExercise(exercise.id)} style={ex.removeExBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#555560" />
        </TouchableOpacity>
      </View>

      {/* Notes inline */}
      {notesOpen && (
        <View style={ex.notesWrap}>
          <TextInput
            style={ex.notesInput}
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="Observações deste exercício..."
            placeholderTextColor="#4A4A5A"
            multiline
            autoFocus
          />
        </View>
      )}

      {/* Set rows */}
      <View style={ex.setsWrap}>
        <View style={ex.setsHeader}>
          <Text style={[ex.setsHeaderCell, { flex: 0.4 }]}>#</Text>
          <Text style={[ex.setsHeaderCell, { flex: 1 }]}>Reps</Text>
          <Text style={[ex.setsHeaderCell, { flex: 1.2 }]}>Kg</Text>
        </View>

        {exercise.sets.map((set, idx) => {
          const isTech = set.technique !== 'NONE'
          if (isTech) {
            return (
              <TechSetRow
                key={set.id}
                set={set}
                index={idx}
                isPR={prSets.has(set.id)}
                onChecked={(id, reps, weight, cfg) => onSetChecked(exercise.id, id, reps, weight, cfg)}
                onRemove={() => onRemoveSet(exercise.id, set.id)}
              />
            )
          }
          return (
            <SimpleSetRow
              key={set.id}
              set={set}
              index={idx}
              isPR={prSets.has(set.id)}
              restSeconds={restSeconds}
              onChecked={(id, reps, weight, cfg) => onSetChecked(exercise.id, id, reps, weight, cfg)}
              onRestEnd={() => {}}
              onRemove={() => onRemoveSet(exercise.id, set.id)}
            />
          )
        })}

        <View style={ex.setActionsRow}>
          <TouchableOpacity style={ex.setActionBtn} onPress={() => onAddSet(exercise.id)} activeOpacity={0.7}>
            <Ionicons name="add" size={14} color="#4FC3F7" />
            <Text style={ex.setActionText}>+ série</Text>
          </TouchableOpacity>
          {exercise.sets.length > 0 && (
            <TouchableOpacity style={ex.setActionBtn} onPress={() => onRemoveSet(exercise.id, exercise.sets[exercise.sets.length - 1]!.id)} activeOpacity={0.7}>
              <Ionicons name="remove" size={14} color="#555560" />
              <Text style={[ex.setActionText, { color: '#555560' }]}>- série</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function WorkoutExecutionScreen() {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<RouteProps>()
  const { workoutId } = route.params

  const store = useSessionStore()
  const [isLoading, setIsLoading] = useState(true)
  const [prSets, setPrSets] = useState<Set<string>>(new Set())
  const [cancelModal, setCancelModal] = useState(false)
  const [finishModal, setFinishModal] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const session = store.session
  const sessionId = store.sessionId

  // Start or resume session on mount
  useEffect(() => {
    async function init() {
      try {
        if (store.isActive && store.session) {
          setIsLoading(false)
          store.startTimer()
          return
        }
        const res = await api.sessions.start(workoutId ? { workoutId } : {})
        store.setSession(res.data.session)
        store.startTimer()
      } catch (e) {
        showToast('Erro ao iniciar treino')
        navigation.goBack()
      } finally {
        setIsLoading(false)
      }
    }
    init()
    return () => { /* timer keeps running if screen unmounts mid-session */ }
  }, [])

  // ── Set check ──
  async function handleSetChecked(execExId: string, setId: string, reps: number | null, weight: number | null, cfg: TechniqueConfig | null) {
    if (!sessionId) return
    const set = session?.exercises.find(e => e.id === execExId)?.sets.find(s => s.id === setId)
    if (!set) return

    const wasChecked = set.isChecked
    store.updateSet(execExId, setId, { isChecked: !wasChecked, repsCompleted: reps, weightKg: weight })

    try {
      const res = await api.sessions.updateSet(sessionId, setId, {
        isChecked: !wasChecked,
        repsCompleted: reps,
        weightKg: weight,
        techniqueConfig: cfg,
      })
      if (res.data.isPR) {
        setPrSets(prev => new Set([...prev, setId]))
      }
    } catch {
      store.updateSet(execExId, setId, { isChecked: wasChecked })
      showToast('Erro ao salvar série')
    }
  }

  // ── Add set ──
  async function handleAddSet(execExId: string) {
    if (!sessionId) return
    try {
      const res = await api.sessions.addSet(sessionId, execExId)
      store.addSet(execExId, res.data.set)
    } catch {
      showToast('Erro ao adicionar série')
    }
  }

  // ── Remove set ──
  async function handleRemoveSet(execExId: string, setId: string) {
    if (!sessionId) return
    store.removeSet(execExId, setId)
    try {
      await api.sessions.removeSet(sessionId, setId)
    } catch {
      showToast('Erro ao remover série')
    }
  }

  // ── Add exercise ──
  async function handleAddExercise(exerciseId: string) {
    if (!sessionId) return
    setPickerOpen(false)
    try {
      const res = await api.sessions.addExercise(sessionId, { exerciseId, setCount: 3 })
      store.addExercise(res.data.exercise)
    } catch {
      showToast('Erro ao adicionar exercício')
    }
  }

  // ── Remove exercise ──
  async function handleRemoveExercise(execExId: string) {
    if (!sessionId) return
    store.removeExercise(execExId)
    try {
      await api.sessions.removeExercise(sessionId, execExId)
    } catch {
      showToast('Erro ao remover exercício')
    }
  }

  // ── Update exercise notes ──
  async function handleUpdateNotes(execExId: string, notes: string) {
    if (!sessionId) return
    store.updateExerciseNotes(execExId, notes || null)
    try {
      await api.sessions.updateExerciseNotes(sessionId, execExId, notes)
    } catch {}
  }

  // ── Cancel ──
  async function handleCancel() {
    if (!sessionId) { store.clearSession(); navigation.goBack(); return }
    try {
      await api.sessions.cancel(sessionId)
    } catch {}
    store.clearSession()
    navigation.goBack()
  }

  // ── Finish ──
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
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const checkedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.isChecked).length, 0)
  const progress = totalSets > 0 ? checkedSets / totalSets : 0

  return (
    <SafeAreaView style={s.safe}>
      {/* Sticky header */}
      <View style={s.headerWrap}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setCancelModal(true)} style={s.headerSideBtn}>
            <Ionicons name="close" size={22} color="#8A8A9A" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {session?.workoutName ?? 'Treino Livre'}
          </Text>
          <Text style={s.timer}>{formatElapsed(store.elapsedSeconds)}</Text>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
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
            prSets={prSets}
            onSetChecked={handleSetChecked}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onRemoveExercise={handleRemoveExercise}
            onUpdateNotes={handleUpdateNotes}
          />
        ))}

        <TouchableOpacity style={s.addExBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color="#4FC3F7" />
          <Text style={s.addExText}>Adicionar exercício</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Finalizar footer */}
      <View style={s.footer}>
        <TouchableOpacity onPress={onFinalizarPress} activeOpacity={0.85} style={s.footerBtn}>
          <LinearGradient colors={['#2979FF', '#1565C0']} style={s.footerBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.footerBtnText}>Finalizar treino</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Cancel modal */}
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

      {/* Finish with changes modal */}
      <Modal visible={finishModal} transparent animationType="fade" onRequestClose={() => setFinishModal(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFinishModal(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>Alterações no treino</Text>
            <Text style={s.modalBody}>Você adicionou ou removeu exercícios durante o treino. Deseja salvar essas alterações no programa?</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => handleFinish(true)}>
              <Text style={s.modalBtnPrimaryText}>Salvar alterações</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtnPrimary, { backgroundColor: '#2A2A35' }]} onPress={() => handleFinish(false)}>
              <Text style={[s.modalBtnPrimaryText, { color: '#8A8A9A' }]}>Manter original</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ExercisePickerModal
        visible={pickerOpen}
        existingExerciseIds={exercises.map(e => e.exerciseId)}
        onSelect={ex => handleAddExercise(ex.id)}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  timer: { width: 56, color: '#4FC3F7', fontSize: 13, fontFamily: 'monospace', textAlign: 'right' },
  progressTrack: { height: 3, backgroundColor: '#2A2A35' },
  progressFill: { height: 3, backgroundColor: '#4FC3F7' },
  footer: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1E1E24' },
  footerBtn: { borderRadius: 14, overflow: 'hidden' },
  footerBtnGradient: { height: 50, justifyContent: 'center', alignItems: 'center' },
  footerBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  scroll: { paddingBottom: 60, paddingTop: 12, gap: 12, paddingHorizontal: 14 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#555560', fontSize: 14, textAlign: 'center' },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#2A2A35', borderStyle: 'dashed', borderRadius: 14,
  },
  addExText: { color: '#4FC3F7', fontSize: 14, fontWeight: '500' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, gap: 12 },
  modalTitle: { color: '#F0F0F5', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  modalBody: { color: '#8A8A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBtnPrimary: { height: 50, borderRadius: 14, backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalBtnDanger: { height: 50, borderRadius: 14, backgroundColor: 'rgba(255,82,82,0.12)', justifyContent: 'center', alignItems: 'center' },
  modalBtnDangerText: { color: '#FF5252', fontSize: 15, fontWeight: '600' },
})

const ex = StyleSheet.create({
  // Card
  card: {
    backgroundColor: '#1E1E24', borderRadius: 16, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', minHeight: 88,
  },
  imgWrap: { width: 88, height: 88, flexShrink: 0, position: 'relative' },
  img: { width: 88, height: 88, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  imgPlaceholder: { backgroundColor: '#222230', justifyContent: 'center', alignItems: 'center' },
  imgFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 },
  cardHeaderRight: { flex: 1, paddingHorizontal: 12, gap: 3 },
  exerciseName: { color: '#F0F0F5', fontSize: 15, fontWeight: '500', lineHeight: 20 },
  muscleTag: { color: '#8A8A9A', fontSize: 11 },
  cardHeaderActions: { flexDirection: 'row', marginTop: 4 },
  notesBtn: {
    borderWidth: 1, borderColor: '#2A2A35', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  notesBtnText: { color: '#8A8A9A', fontSize: 11 },
  removeExBtn: { padding: 12 },

  // Notes
  notesWrap: { paddingHorizontal: 12, paddingBottom: 10 },
  notesInput: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 10, padding: 10, color: '#F0F0F5', fontSize: 13, minHeight: 60,
  },

  // Sets area
  setsWrap: { backgroundColor: '#141418', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  setsHeader: { flexDirection: 'row', paddingBottom: 4 },
  setsHeaderCell: { color: '#3A3A4A', fontSize: 11, textAlign: 'center' },

  // Set row
  setRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8,
    borderRadius: 8, paddingHorizontal: 2,
  },
  setRowDone: { backgroundColor: 'rgba(0,230,118,0.06)' },

  check: {
    borderWidth: 2, borderColor: '#2A2A35', justifyContent: 'center', alignItems: 'center',
  },
  checkDone: { backgroundColor: '#00E676', borderColor: '#00E676' },

  badge: {
    minWidth: 28, height: 20, borderRadius: 5,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontSize: 9, fontWeight: '700' },
  setNum: { color: '#555560', fontSize: 13, width: 18, textAlign: 'center' },

  repsInput: {
    width: 64, height: 40, backgroundColor: '#1A1A22',
    borderWidth: 1, borderColor: '#2A2A35', borderRadius: 8,
    color: '#F0F0F5', fontSize: 16, textAlign: 'center',
  },
  weightInput: {
    width: 76, height: 40, backgroundColor: '#1A1A22',
    borderWidth: 1, borderColor: '#2A2A35', borderRadius: 8,
    color: '#F0F0F5', fontSize: 16, textAlign: 'center',
  },
  inputSep: { color: '#555560', fontSize: 14 },
  kgLabel: { color: '#555560', fontSize: 12 },
  inputDone: { color: '#8A8A9A', fontSize: 16, width: 56, textAlign: 'center' },
  inputDoneSm: { fontSize: 13, width: 44 },

  volumeHint: { color: '#3A3A4A', fontSize: 10, paddingLeft: 52, paddingBottom: 2 },

  // Rest timer
  restTimer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 6, marginHorizontal: 4,
    backgroundColor: 'rgba(79,195,247,0.07)', borderRadius: 8, marginBottom: 4,
  },
  restTimerText: { color: '#4FC3F7', fontSize: 13 },
  restSkip: { color: '#555560', fontSize: 11 },

  // PR badge
  prBadge: {
    backgroundColor: '#1A1500', borderWidth: 1, borderColor: '#FFB300',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  prText: { color: '#FFB300', fontSize: 10, fontWeight: '700' },

  // Serie actions row
  setActionsRow: { flexDirection: 'row', gap: 0, marginTop: 4 },
  setActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10,
  },
  setActionText: { color: '#4FC3F7', fontSize: 13 },

  // Technique set wrap
  techSetWrap: {
    borderLeftWidth: 2, marginLeft: 4, paddingLeft: 8, marginVertical: 2,
  },
  blockRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 7,
    borderRadius: 8, paddingHorizontal: 2,
  },
  blockRowDone: { backgroundColor: 'rgba(0,230,118,0.06)' },
  blockLabel: { color: '#555560', fontSize: 11, width: 44 },
  repsInputSm: {
    width: 52, height: 34, backgroundColor: '#1A1A22',
    borderWidth: 1, borderColor: '#2A2A35', borderRadius: 7,
    color: '#F0F0F5', fontSize: 14, textAlign: 'center',
  },
  weightInputSm: {
    width: 62, height: 34, backgroundColor: '#1A1A22',
    borderWidth: 1, borderColor: '#2A2A35', borderRadius: 7,
    color: '#F0F0F5', fontSize: 14, textAlign: 'center',
  },

  // Rest separator
  restSep: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, gap: 6, paddingLeft: 36 },
  restDots: { flex: 1, height: 1, backgroundColor: '#2A2A35' },
  restSecText: { color: '#3A3A4A', fontSize: 10 },

  // Muscle round failure
  failCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#333344',
    justifyContent: 'center', alignItems: 'center',
  },
  failCircleActive: { backgroundColor: '#FF5252', borderColor: '#FF5252' },
  failCircleX: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
