import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Modal, Pressable,
} from 'react-native'
import { ExerciseCardShell, cardMetaStyles, cardBodyStyles } from '../../components/ExerciseCardShell'
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
import { SetBadge, getTechStyle } from '../../components/SetBadge'
import { WorkoutInput } from '../../components/WorkoutInput'

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rp.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={confirm} />
        <View style={rp.sheet}>
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

type BlockData = { blockReps: string[]; blockWeights: string[]; failedAtBlock: number | null; dropWeight?: string }

function RestSeparator({ seconds }: { seconds: number }) {
  return (
    <View style={exp.sep}>
      <View style={exp.sepLine} />
      <Text style={exp.sepText}>{seconds}s</Text>
      <View style={exp.sepLine} />
    </View>
  )
}

function RestPauseExpansion({ config, blockReps, onBlockRepsChange }: {
  config: TechniqueConfig | null
  blockReps: string[]
  onBlockRepsChange: (idx: number, val: string) => void
}) {
  const c = config as Record<string, unknown> | null
  const failurePoints = Math.min(5, Math.max(1, Number(c?.['failurePoints'] ?? 3)))
  const rest = Number(c?.['restBetweenSeconds'] ?? 20)
  // index 0 = main set, 1..failurePoints = failure blocks
  const totalBlocks = failurePoints + 1
  return (
    <View style={exp.wrap}>
      {Array.from({ length: totalBlocks }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RestSeparator seconds={rest} />}
          <View style={exp.block}>
            <WorkoutInput
              width={96}
              value={blockReps[i] ?? ''}
              onChangeText={val => onBlockRepsChange(i, val)}
              placeholder="—"
              keyboardType="number-pad"
              unit="reps"
            />
            <Text style={exp.blockLabelRight}>{i === 0 ? 'Série Principal' : `Falha ${i}`}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

function ClusterSetExpansion({ config, blockReps, onBlockRepsChange }: {
  config: TechniqueConfig | null
  blockReps: string[]
  onBlockRepsChange: (idx: number, val: string) => void
}) {
  const c = config as Record<string, unknown> | null
  const blocks = Math.min(10, Math.max(2, Number(c?.['blocks'] ?? 4)))
  const rest = Number(c?.['restBetweenSeconds'] ?? 15)
  const repsPerBlock = c?.['repsPerBlock'] != null ? String(c['repsPerBlock']) : ''
  return (
    <View style={exp.wrap}>
      {Array.from({ length: blocks }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RestSeparator seconds={rest} />}
          <View style={exp.block}>
            <WorkoutInput
              width={96}
              value={blockReps[i] ?? ''}
              onChangeText={val => onBlockRepsChange(i, val)}
              placeholder={repsPerBlock || '—'}
              keyboardType="number-pad"
              unit="reps"
            />
            <Text style={exp.blockLabelRight}>Bloco {i + 1}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

function MuscleRoundExpansion({ config, blockReps, dropWeight, onBlockRepsChange, onDropWeightChange }: {
  config: TechniqueConfig | null
  blockReps: string[]
  dropWeight: string
  onBlockRepsChange: (idx: number, val: string) => void
  onDropWeightChange: (val: string) => void
}) {
  const c = config as Record<string, unknown> | null
  const blocks = Math.min(10, Math.max(4, Number(c?.['blocks'] ?? 6)))
  const rest = Number(c?.['restBetweenSeconds'] ?? 35)
  return (
    <View style={exp.wrap}>
      {/* Drop weight row — used from the failure block onward */}
      <View style={[exp.block, exp.blockMr, { marginBottom: 6 }]}>
        <Text style={[exp.blockLabel, { color: '#A78BFA' }]}>↓ Peso de queda</Text>
        <WorkoutInput
          width={96}
          value={dropWeight}
          onChangeText={onDropWeightChange}
          placeholder="—"
          keyboardType="decimal-pad"
          unit="kg"
        />
      </View>
      {/* Blocks — reps only; weight is determined during execution */}
      {Array.from({ length: blocks }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <RestSeparator seconds={rest} />}
          <View style={[exp.block, exp.blockMr]}>
            <WorkoutInput
              width={96}
              value={blockReps[i] ?? ''}
              onChangeText={val => onBlockRepsChange(i, val)}
              placeholder="—"
              keyboardType="number-pad"
              unit="reps"
            />
            <Text style={exp.blockLabelRight}>Bloco {i + 1}</Text>
          </View>
        </React.Fragment>
      ))}
      <Text style={exp.mrHint}>Marque o bloco da falha durante a execução</Text>
    </View>
  )
}

function DropSetExpansion({ config, blockReps, onBlockRepsChange }: {
  config: TechniqueConfig | null
  blockReps: string[]
  onBlockRepsChange: (idx: number, val: string) => void
}) {
  const c = config as Record<string, unknown> | null
  const drops = Math.min(10, Math.max(1, Number(c?.['drops'] ?? 2)))
  const totalBlocks = drops + 1
  return (
    <View style={exp.wrap}>
      {Array.from({ length: totalBlocks }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <View style={exp.sep}>
              <View style={[exp.sepLine, { backgroundColor: 'rgba(239,68,68,0.15)' }]} />
              <Text style={[exp.sepText, exp.dropSepText]}>↓ drop</Text>
              <View style={[exp.sepLine, { backgroundColor: 'rgba(239,68,68,0.15)' }]} />
            </View>
          )}
          {/* Reps block — weights are filled during execution */}
          <View style={[exp.block, exp.blockDrop]}>
            <Text style={exp.dsArrow}>→</Text>
            <Text style={exp.blockLabel}>{i === 0 ? 'Série Principal' : `Drop ${i}`}</Text>
            <WorkoutInput
              width={96}
              value={blockReps[i] ?? ''}
              onChangeText={val => onBlockRepsChange(i, val)}
              placeholder="—"
              keyboardType="number-pad"
              unit="reps"
            />
          </View>
        </React.Fragment>
      ))}
      <Text style={exp.dsHint}>Os pesos são definidos durante a execução · UMA série no volume</Text>
    </View>
  )
}

function MyoRepExpansion({ config }: { config: TechniqueConfig | null }) {
  const c = config as Record<string, unknown> | null
  const activationReps = Number(c?.['activationReps'] ?? 5)
  const activationRest = Number(c?.['activationRestSeconds'] ?? 40)
  const repsPerBlock = Number(c?.['repsPerBlock'] ?? 2)
  const restBetween = Number(c?.['restBetweenSeconds'] ?? 20)
  return (
    <View style={exp.wrap}>
      <View style={exp.myoRow}>
        <Text style={exp.myoRowLabel}>→ Ativação</Text>
        <Text style={exp.myoRowValue}>{activationReps} reps</Text>
      </View>
      <RestSeparator seconds={activationRest} />
      <View style={exp.myoRow}>
        <Text style={exp.myoRowLabel}>→ Mini-blocos</Text>
        <Text style={exp.myoRowValue}>{repsPerBlock} reps cada</Text>
      </View>
      <RestSeparator seconds={restBetween} />
      <Text style={exp.myoHint}>Qtd. de mini-blocos definida durante a execução</Text>
      <Text style={exp.dsHint}>Conta como UMA série no volume total</Text>
    </View>
  )
}

// ─── Technique summary helper ─────────────────────────────────────────────────

function buildDetailTechSummary(technique: PlannedSetTechnique, cfg: Record<string, unknown> | null): string | null {
  if (!cfg) return null
  switch (technique) {
    case 'REST_PAUSE': {
      const pts = (cfg['failurePoints'] as number) ?? 3
      const rest = (cfg['restBetweenSeconds'] as number) ?? 20
      return `${pts} pontos de falha · ${rest}s descanso`
    }
    case 'CLUSTER_SET': {
      const blks = (cfg['blocks'] as number) ?? 4
      const rpp = cfg['repsPerBlock'] as number | undefined
      const rest = (cfg['restBetweenSeconds'] as number) ?? 15
      return `${blks} blocos${rpp ? ` × ${rpp} reps` : ''} · ${rest}s`
    }
    case 'MUSCLE_ROUND': {
      const blks = (cfg['blocks'] as number) ?? 6
      const rest = (cfg['restBetweenSeconds'] as number) ?? 35
      const dropKg = cfg['dropWeightKg'] as number | null | undefined
      return `${blks} blocos · ${rest}s${dropKg != null ? ` · ↓ ${dropKg} kg` : ''}`
    }
    case 'DROP_SET': {
      const dw = cfg['dropWeights'] as (number | null)[] | undefined
      const drops = (cfg['drops'] as number) ?? 2
      if (dw && dw.some(w => w != null)) {
        return dw.map(w => (w != null ? `${w} kg` : '—')).join(' → ')
      }
      return `${drops + 1} drops`
    }
    case 'MYOREP': {
      const aReps = (cfg['activationReps'] as number) ?? 15
      const aRest = (cfg['activationRestSeconds'] as number) ?? 20
      const rpp = (cfg['repsPerBlock'] as number) ?? 5
      return `Ativ. ${aReps} reps · ${aRest}s · ${rpp}/bloco`
    }
    default: return null
  }
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({
  set, index, reps, weight, blockData, canDelete,
  onRepsChange, onWeightChange, onTechniqueTap, onDelete,
  onBlockRepsChange, onFailedAtBlock, onDropWeightChange,
}: {
  set: PlannedSetRecord
  index: number
  reps: string
  weight: string
  blockData: BlockData | undefined
  canDelete: boolean
  onRepsChange: (v: string) => void
  onWeightChange: (v: string) => void
  onTechniqueTap: () => void
  onDelete: () => void
  onBlockRepsChange: (idx: number, val: string) => void
  onFailedAtBlock: (idx: number) => void
  onDropWeightChange?: (val: string) => void
}) {
  const ts = getTechStyle(set.setType, set.technique)
  const volumeHint = getVolumeHint(set.setType)
  const hasLeftBorder = set.setType === 'WARMUP' || set.setType === 'FEEDER' || set.technique !== 'NONE'
  // Per-block techniques control reps inside blocks; MUSCLE_ROUND/MYOREP main weight shown in main row
  const hideReps = set.technique === 'CLUSTER_SET' || set.technique === 'MUSCLE_ROUND' || set.technique === 'REST_PAUSE' || set.technique === 'DROP_SET' || set.technique === 'MYOREP'
  const hideWeight = set.technique === 'DROP_SET'
  const isAdvanced = set.technique === 'REST_PAUSE' || set.technique === 'CLUSTER_SET' ||
    set.technique === 'MUSCLE_ROUND' || set.technique === 'DROP_SET' || set.technique === 'MYOREP'
  const summaryText = isAdvanced
    ? buildDetailTechSummary(set.technique, set.techniqueConfig as Record<string, unknown> | null)
    : null

  return (
    <View style={[sr.wrap, hasLeftBorder && { borderLeftWidth: 2, borderLeftColor: ts.borderColor }]}>
      <View style={sr.main}>
        <SetBadge setType={set.setType} technique={set.technique} index={index} onPress={onTechniqueTap} />

        {!hideReps && (
          <WorkoutInput
            flex={1}
            value={reps}
            onChangeText={onRepsChange}
            placeholder="—"
            keyboardType="number-pad"
            unit="reps"
          />
        )}
        {!hideReps && !hideWeight && <Text style={sr.timesText}>×</Text>}
        {!hideWeight && (
          <WorkoutInput
            flex={hideReps ? 1 : 1.2}
            value={weight}
            onChangeText={onWeightChange}
            placeholder="—"
            keyboardType="decimal-pad"
            unit="kg"
          />
        )}
        {hideReps && hideWeight && <View style={{ flex: 1 }} />}

        {canDelete && (
          <TouchableOpacity
            style={sr.deleteBtn}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color="#4A4A5A" />
          </TouchableOpacity>
        )}
      </View>

      {volumeHint && (
        <Text style={sr.volumeHint}>{volumeHint}</Text>
      )}

      {summaryText != null && (
        <View style={sr.techSummaryRow}>
          <View style={[sr.techSummaryAccent, { backgroundColor: ts.borderColor }]} />
          <Text style={[sr.techSummaryText, { color: ts.badgeText }]} numberOfLines={1}>{summaryText}</Text>
        </View>
      )}

      {set.setType === 'WORKING' && set.technique === 'REST_PAUSE' && (
        <RestPauseExpansion
          config={set.techniqueConfig}
          blockReps={blockData?.blockReps ?? []}
          onBlockRepsChange={onBlockRepsChange}
        />
      )}
      {set.setType === 'WORKING' && set.technique === 'CLUSTER_SET' && (
        <ClusterSetExpansion
          config={set.techniqueConfig}
          blockReps={blockData?.blockReps ?? []}
          onBlockRepsChange={onBlockRepsChange}
        />
      )}
      {set.setType === 'WORKING' && set.technique === 'MUSCLE_ROUND' && (
        <MuscleRoundExpansion
          config={set.techniqueConfig}
          blockReps={blockData?.blockReps ?? []}
          dropWeight={blockData?.dropWeight ?? ''}
          onBlockRepsChange={onBlockRepsChange}
          onDropWeightChange={onDropWeightChange ?? (() => {})}
        />
      )}
      {set.setType === 'WORKING' && set.technique === 'DROP_SET' && (
        <DropSetExpansion
          config={set.techniqueConfig}
          blockReps={blockData?.blockReps ?? []}
          onBlockRepsChange={onBlockRepsChange}
        />
      )}
      {set.setType === 'WORKING' && set.technique === 'MYOREP' && (
        <MyoRepExpansion config={set.techniqueConfig} />
      )}
    </View>
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
  const [localBlockData, setLocalBlockData] = useState<Record<string, BlockData>>({})
  const localBlockDataRef = useRef<Record<string, BlockData>>({})

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
        if (!next[te.id]) next[te.id] = te.sets
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
        if (next[te.id] === undefined) next[te.id] = te.restSeconds ?? null
      }
      return next
    })
    setLocalNotes(prev => {
      const next = { ...prev }
      for (const te of workout.exercises) {
        if (next[te.id] === undefined) next[te.id] = te.notes ?? ''
      }
      return next
    })

    // Initialize block data for technique sets
    const newBlockData: Record<string, BlockData> = {}
    for (const te of workout.exercises) {
      for (const s of te.sets) {
        if (localBlockDataRef.current[s.id]) continue
        const c = s.techniqueConfig as Record<string, unknown> | null
        if (s.technique === 'REST_PAUSE') {
          const fp = Number(c?.['failurePoints'] ?? 3)
          newBlockData[s.id] = {
            blockReps: (c?.['blockReps'] as string[] | undefined) ?? Array(fp + 1).fill(''),
            blockWeights: [],
            failedAtBlock: null,
          }
        } else if (s.technique === 'CLUSTER_SET') {
          const b = Number(c?.['blocks'] ?? 4)
          const rpp = c?.['repsPerBlock'] != null ? String(c['repsPerBlock']) : ''
          newBlockData[s.id] = {
            blockReps: (c?.['blockReps'] as string[] | undefined) ?? Array(b).fill(rpp),
            blockWeights: [],
            failedAtBlock: null,
          }
        } else if (s.technique === 'MUSCLE_ROUND') {
          const b = Number(c?.['blocks'] ?? 6)
          newBlockData[s.id] = {
            blockReps: (c?.['blockReps'] as string[] | undefined) ?? Array(b).fill(''),
            blockWeights: [],
            failedAtBlock: null,
            dropWeight: c?.['dropWeightKg'] != null ? String(c['dropWeightKg']) : '',
          }
        } else if (s.technique === 'DROP_SET') {
          const d = Number(c?.['drops'] ?? 2)
          const totalBlocks = d + 1
          // Weights are entered during execution, not planned here.
          newBlockData[s.id] = {
            blockReps: (c?.['blockReps'] as string[] | undefined) ?? Array(totalBlocks).fill(''),
            blockWeights: [],
            failedAtBlock: null,
          }
        }
      }
    }
    if (Object.keys(newBlockData).length > 0) {
      Object.assign(localBlockDataRef.current, newBlockData)
      setLocalBlockData(prev => ({ ...prev, ...newBlockData }))
    }
  }, [workout])

  function scheduleSetSave(setId: string, changes: { targetReps?: string | null; targetWeight?: number | null }) {
    if (setTimers.current[setId]) clearTimeout(setTimers.current[setId])
    setTimers.current[setId] = setTimeout(() => {
      api.plannedSets.update(setId, changes).catch(() => null)
      delete setTimers.current[setId]
    }, 800)
  }

  function scheduleBlockDataSave(
    setId: string,
    technique: PlannedSetTechnique,
    data: BlockData,
    existingConfig: TechniqueConfig | null,
  ) {
    const c = (existingConfig as Record<string, unknown>) ?? {}
    let newConfig: Record<string, unknown>
    switch (technique) {
      case 'REST_PAUSE':
        newConfig = { ...c, blockReps: data.blockReps }
        break
      case 'CLUSTER_SET':
        newConfig = { ...c, blockReps: data.blockReps }
        break
      case 'MUSCLE_ROUND': {
        newConfig = { ...c, blockReps: data.blockReps }
        const dropN = data.dropWeight != null ? parseFloat(data.dropWeight) : NaN
        if (!isNaN(dropN) && dropN > 0) newConfig['dropWeightKg'] = dropN
        break
      }
      case 'DROP_SET':
        // Only planned reps; weights are collected during execution.
        newConfig = { ...c, blockReps: data.blockReps }
        break
      case 'MYOREP':
        return // no block-level data to save for MYOREP
      default:
        return
    }
    const key = `${setId}_block`
    if (setTimers.current[key]) clearTimeout(setTimers.current[key])
    setTimers.current[key] = setTimeout(() => {
      api.plannedSets.update(setId, { techniqueConfig: newConfig as TechniqueConfig }).catch(() => null)
      delete setTimers.current[key]
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

  function handleBlockRepsChange(setId: string, blockIdx: number, val: string, set: PlannedSetRecord) {
    const cur = localBlockDataRef.current[setId] ?? { blockReps: [], blockWeights: [], failedAtBlock: null }
    const blockReps = [...cur.blockReps]
    while (blockReps.length <= blockIdx) blockReps.push('')
    blockReps[blockIdx] = val
    const next = { ...cur, blockReps }
    localBlockDataRef.current[setId] = next
    setLocalBlockData(prev => ({ ...prev, [setId]: next }))
    scheduleBlockDataSave(setId, set.technique, next, set.techniqueConfig)
  }

  function handleFailedAtBlock(setId: string, blockIdx: number, set: PlannedSetRecord) {
    const cur = localBlockDataRef.current[setId] ?? { blockReps: [], blockWeights: [], failedAtBlock: null }
    const newFailed = cur.failedAtBlock === blockIdx ? null : blockIdx
    const next = { ...cur, failedAtBlock: newFailed }
    localBlockDataRef.current[setId] = next
    setLocalBlockData(prev => ({ ...prev, [setId]: next }))
    scheduleBlockDataSave(setId, set.technique, next, set.techniqueConfig)
  }

  function handleMrDropWeightChange(setId: string, val: string, set: PlannedSetRecord) {
    const cur = localBlockDataRef.current[setId] ?? { blockReps: [], blockWeights: [], failedAtBlock: null }
    const next = { ...cur, dropWeight: val }
    localBlockDataRef.current[setId] = next
    setLocalBlockData(prev => ({ ...prev, [setId]: next }))
    scheduleBlockDataSave(setId, set.technique, next, set.techniqueConfig)
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
      setLocalSets(prev => {
        // Fall back to the set list from the query if this exercise has not been
        // seeded into localSets yet, so the set is always updated in place and
        // never dropped (e.g. switching technique back to NONE keeps it visible).
        const current = prev[teId] ?? localSets[teId] ?? []
        return { ...prev, [teId]: current.map(s => s.id === setId ? updated : s) }
      })

      // Reset block data for new technique
      const c = sel.config as Record<string, unknown> | null
      let newEntry: BlockData | undefined
      if (sel.technique === 'REST_PAUSE') {
        const fp = Number(c?.['failurePoints'] ?? 3)
        newEntry = { blockReps: Array(fp + 1).fill(''), blockWeights: [], failedAtBlock: null }
      } else if (sel.technique === 'CLUSTER_SET') {
        const b = Number(c?.['blocks'] ?? 4)
        const rpp = c?.['repsPerBlock'] != null ? String(c['repsPerBlock']) : ''
        newEntry = { blockReps: Array(b).fill(rpp), blockWeights: [], failedAtBlock: null }
      } else if (sel.technique === 'MUSCLE_ROUND') {
        const b = Number(c?.['blocks'] ?? 6)
        newEntry = { blockReps: Array(b).fill(''), blockWeights: [], failedAtBlock: null, dropWeight: '' }
      } else if (sel.technique === 'DROP_SET') {
        const d = Number(c?.['drops'] ?? 2)
        const totalBlocks = d + 1
        newEntry = {
          blockReps: Array(totalBlocks).fill(''),
          blockWeights: [],
          failedAtBlock: null,
        }
      }

      if (newEntry) {
        localBlockDataRef.current[setId] = newEntry
        setLocalBlockData(prev => ({ ...prev, [setId]: newEntry! }))
      } else {
        delete localBlockDataRef.current[setId]
        setLocalBlockData(prev => {
          const next = { ...prev }
          delete next[setId]
          return next
        })
      }
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
    await qc.invalidateQueries({ queryKey: ['workout', workoutId] })
    showToast('Treino salvo')
    navigation.goBack()
  }

  const exercises = workout?.exercises ?? []
  const existingExerciseIds = exercises.map(te => te.exercise.id)
  const totalSets = exercises.reduce((acc, te) => {
    const sets = localSets[te.id] ?? te.sets
    return acc + sets.length
  }, 0)
  const validSets = exercises.reduce((acc, te) => {
    const sets = localSets[te.id] ?? te.sets
    return acc + sets.filter(s => s.setType === 'WORKING').length
  }, 0)

  const currentTechSet = (() => {
    if (!techniquePicker.teId || !techniquePicker.setId) return null
    return (localSets[techniquePicker.teId] ?? []).find(s => s.id === techniquePicker.setId) ?? null
  })()

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.headerWrap}>
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
          />
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient colors={['#2979FF', '#1565C0']} style={s.savePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.saveText}>Salvar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <TextInput
          style={s.descInline}
          value={workoutNotes}
          onChangeText={handleWorkoutNotesChange}
          placeholder="Adicionar descrição..."
          placeholderTextColor="#3A3A4A"
          multiline
          numberOfLines={2}
          maxLength={300}
        />
      </View>

      {/* Fixed summary row */}
      <View style={s.headerMeta}>
        <Text style={s.headerMetaText}>
          {exercises.length} {exercises.length === 1 ? 'exercício' : 'exercícios'}
        </Text>
        <View style={s.headerMetaDot} />
        <Text style={s.headerMetaText}>
          {totalSets} {totalSets === 1 ? 'série' : 'séries'}
        </Text>
        <View style={s.headerMetaDot} />
        <Text style={s.headerMetaText}>{validSets} válidas</Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

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
                <ExerciseCardShell
                  key={te.id}
                  gifUrl={te.exercise.gifUrl ?? null}
                  name={te.exercise.name}
                  meta={
                    te.exercise.equipment ? (
                      <View style={cardMetaStyles.pill}>
                        <Text style={cardMetaStyles.pillText}>{txEquip(te.exercise.equipment)}</Text>
                      </View>
                    ) : null
                  }
                  rightSlot={
                    <TouchableOpacity style={s.dotBtn} onPress={() => setSheet({ visible: true, teId: te.id })}>
                      <Ionicons name="ellipsis-vertical" size={18} color="#8A8A9A" />
                    </TouchableOpacity>
                  }
                  topStrip={
                    isInSuperset ? (
                      <View style={s.supersetStrip}>
                        <Text style={s.supersetStripText}>
                          {te.technique === 'BISET' ? '⇅ BISET' : '⇅ SUPERSET'}
                        </Text>
                      </View>
                    ) : undefined
                  }
                  cardStyle={[
                    isInSuperset && { borderLeftWidth: 3, borderLeftColor: '#4FC3F7' },
                    isFirstInPair && { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
                    isLastInPair && { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
                  ]}
                  shadowStyle={[
                    isFirstInPair && { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
                    isLastInPair && { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
                    !isLastInPair && isInSuperset ? { marginBottom: 2 } : { marginBottom: 12 },
                  ]}
                >
                  <View style={s.cardBody}>
                    <View style={cardBodyStyles.observationWrap}>
                      <TextInput
                        style={cardBodyStyles.observationInput}
                        value={notes}
                        onChangeText={val => handleNotesChange(te.id, val)}
                        placeholder="Adicionar observação..."
                        placeholderTextColor="#3A3A4A"
                        multiline
                        blurOnSubmit
                      />
                    </View>

                    <VolumeCounter sets={sets} />

                    {sets.map((set, i) => {
                      const rw = localRepsWeight[set.id] ?? { reps: set.targetReps ?? '', weight: set.targetWeight != null ? String(set.targetWeight) : '' }
                      const bd = localBlockData[set.id]
                      return (
                        <SetRow
                          key={set.id}
                          set={set}
                          index={i}
                          reps={rw.reps}
                          weight={rw.weight}
                          blockData={bd}
                          canDelete={sets.length > 1}
                          onRepsChange={v => handleRepsChange(set.id, v)}
                          onWeightChange={v => handleWeightChange(set.id, v)}
                          onTechniqueTap={() => setTechniquePicker({ visible: true, teId: te.id, setId: set.id })}
                          onDelete={() => {
                            if (sets.length > 1)
                              setConfirmDeleteSet({ visible: true, teId: te.id, setId: set.id })
                          }}
                          onBlockRepsChange={(idx, val) => handleBlockRepsChange(set.id, idx, val, set)}
                          onFailedAtBlock={idx => handleFailedAtBlock(set.id, idx, set)}
                          onDropWeightChange={val => handleMrDropWeightChange(set.id, val, set)}
                        />
                      )
                    })}

                    <TouchableOpacity
                      style={cardBodyStyles.addSetBtn}
                      onPress={() => handleAddSet(te.id)}
                      disabled={addingSet[te.id]}
                      activeOpacity={0.7}
                    >
                      {addingSet[te.id] ? (
                        <ActivityIndicator size="small" color="#555560" />
                      ) : (
                        <>
                          <Ionicons name="add-circle-outline" size={14} color="#8A8A9A" />
                          <Text style={cardBodyStyles.addSetText}>Adicionar série</Text>
                        </>
                      )}
                    </TouchableOpacity>

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
                </ExerciseCardShell>
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
        onConfirm={(targetTeIds) => {
          if (supersetPicker.sourceTeId) {
            api.trainingExercises.createSuperset({
              workoutId,
              exerciseIds: [supersetPicker.sourceTeId, ...targetTeIds],
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

  headerWrap: {
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 18, paddingTop: 4, paddingBottom: 4, gap: 8,
  },
  descInline: {
    color: '#6A6A7A', fontSize: 12, fontStyle: 'italic', lineHeight: 17,
    paddingLeft: 54, paddingRight: 18, paddingBottom: 6,
    maxHeight: 38,
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
  sectionDivider: { height: 1, backgroundColor: '#2A2A35', marginBottom: 8 },
  summaryText: {
    color: '#555560', fontSize: 11, textAlign: 'right',
    paddingHorizontal: 4, marginBottom: 10,
  },

  headerMeta: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 8, gap: 6,
  },
  headerMetaText: { color: '#555560', fontSize: 12 },
  headerMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3A3A4A' },


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

  cardBody: { paddingHorizontal: 10, paddingBottom: 10 },

  dotBtn: { padding: 4, flexShrink: 0 },

  supersetStrip: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(79,195,247,0.08)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(79,195,247,0.15)',
  },
  supersetStripText: { color: '#4FC3F7', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  restRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#252530',
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9,
  },
  restLabel: { flex: 1, color: '#8A8A9A', fontSize: 13 },
  restValue: { color: '#F0F0F5', fontSize: 13, fontWeight: '500' },

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
    borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timesText: { width: 14, textAlign: 'center', color: '#2A2A35', fontSize: 13 },
  volumeHint: { color: '#8A8A9A', fontSize: 10, marginTop: 3, marginLeft: 42 },
  deleteBtn: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },
  techSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 3,
    paddingBottom: 4,
  },
  techSummaryAccent: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
    flexShrink: 0,
  },
  techSummaryText: {
    fontSize: 11,
    letterSpacing: 0.2,
    flex: 1,
    opacity: 0.75,
  },
})

const exp = StyleSheet.create({
  wrap: { marginTop: 8, marginLeft: 35 },
  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  sepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  sepText: { color: '#4A4A5A', fontSize: 10, marginHorizontal: 8 },
  dropSepText: { color: '#EF4444', fontSize: 10, opacity: 0.7 },

  block: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  blockMr: { backgroundColor: 'rgba(123,97,255,0.1)' },
  blockDrop: { backgroundColor: 'rgba(239,68,68,0.08)' },
  blockAfterFailure: { opacity: 0.45 },
  blockLabel: { color: '#8A8A9A', fontSize: 12, flex: 1 },
  blockLabelRight: { color: '#8A8A9A', fontSize: 12, textAlign: 'right' },

  failBtn: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: '#3A3A4A',
  },
  failBtnActive: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' },
  failBtnText: { color: '#4A4A5A', fontSize: 13 },
  failBtnTextActive: { color: '#EF4444' },

  blockMrFailed: { backgroundColor: 'rgba(255,82,82,0.1)' },
  failCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#333344',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  failCircleActive: { backgroundColor: '#FF5252', borderColor: '#FF5252' },
  mrHint: { color: '#555560', fontSize: 11, marginTop: 8, textAlign: 'center' },

  // DROP_SET structured layout
  dsArrow: { color: 'rgba(239,68,68,0.45)', fontSize: 11, width: 14 },
  dsHint: { color: '#555560', fontSize: 11, marginTop: 8, textAlign: 'center' },

  // MYOREP informational expansion
  myoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(244,114,182,0.06)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  myoRowLabel: { color: '#F472B6', fontSize: 12 },
  myoRowValue: { color: '#F0F0F5', fontSize: 12, fontWeight: '500' },
  myoHint: { color: '#555560', fontSize: 11, marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
})

const vc = StyleSheet.create({
  text: { color: '#3A3A4A', fontSize: 11, marginBottom: 8, marginLeft: 2 },
  valid: { color: '#00E676' },
})

const rp = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    width: '85%',
    paddingTop: 24, paddingBottom: 28, paddingHorizontal: 24,
  },
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
