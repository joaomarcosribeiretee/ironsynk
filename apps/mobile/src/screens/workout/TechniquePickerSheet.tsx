import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable, TextInput, Switch,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import type { SetType, PlannedSetTechnique, TechniqueConfig } from '../../lib/api'

// ─── Technique metadata ───────────────────────────────────────────────────────

type TechniqueOption = {
  label: string
  description: string
  setType: SetType
  technique: PlannedSetTechnique
  hasConfig: boolean
  infoText: string
}

const OPTIONS: TechniqueOption[] = [
  {
    label: 'Working',
    description: 'Série de trabalho padrão',
    setType: 'WORKING', technique: 'NONE', hasConfig: false,
    infoText: '',
  },
  {
    label: 'Aquecimento',
    description: 'Não conta para o volume',
    setType: 'WARMUP', technique: 'NONE', hasConfig: false,
    infoText: '',
  },
  {
    label: 'Feeder',
    description: 'Série leve de ativação — não conta para volume',
    setType: 'FEEDER', technique: 'NONE', hasConfig: false,
    infoText: '',
  },
  {
    label: 'Rest-Pause',
    description: 'Até a falha, pause, repita',
    setType: 'WORKING', technique: 'REST_PAUSE', hasConfig: true,
    infoText:
      'Você vai até a falha momentânea, descansa brevemente e continua com o mesmo peso. Cada pausa é chamada de "ponto de falha".\n\nExemplo: 12 reps → falha → 20s → +5 reps → 20s → +3 reps.',
  },
  {
    label: 'Muscle Round',
    description: 'Blocos curtos com descanso mínimo',
    setType: 'WORKING', technique: 'MUSCLE_ROUND', hasConfig: true,
    infoText:
      'Múltiplos blocos de poucas repetições com descanso muito curto entre eles. Mantém alta ativação muscular sem usar carga muito elevada.\n\nUse 50–60% do seu peso de trabalho normal.',
  },
  {
    label: 'Cluster Set',
    description: 'Blocos com breve descanso entre eles',
    setType: 'WORKING', technique: 'CLUSTER_SET', hasConfig: true,
    infoText:
      'Divide a série em blocos menores com breve descanso. Permite usar cargas maiores e acumular mais volume de qualidade.\n\nExemplo: 4 blocos de 4 reps com 15s de descanso.',
  },
  {
    label: 'Back-Off',
    description: 'Série extra com carga reduzida',
    setType: 'WORKING', technique: 'BACK_OFF', hasConfig: true,
    infoText:
      'Após as séries principais, realize uma série extra com carga reduzida (percentual). Aumenta volume total sem sobrecarregar o sistema nervoso central.',
  },
]

// ─── Config field validation helpers ─────────────────────────────────────────

function isIntInRange(val: string, min: number, max: number) {
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= min && n <= max && String(n) === val.trim()
}

// ─── ConfigInput ──────────────────────────────────────────────────────────────

function ConfigInput({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  suffix?: string
}) {
  const valid = isIntInRange(value, min, max)
  return (
    <View style={ci.wrap}>
      <Text style={ci.label}>{label}</Text>
      <View style={ci.row}>
        <TextInput
          style={[ci.input, !valid && ci.inputError]}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={4}
          placeholderTextColor="#4A4A5A"
          placeholder={`${min}–${max}`}
        />
        {suffix ? <Text style={ci.suffix}>{suffix}</Text> : null}
      </View>
      {!valid && (
        <Text style={ci.hint}>{min}–{max}</Text>
      )}
    </View>
  )
}

const ci = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: { color: '#8A8A9A', fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 10,
    color: '#F0F0F5',
    fontSize: 16,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: '#FF5252' },
  suffix: { color: '#8A8A9A', fontSize: 14, width: 28 },
  hint: { color: '#FF5252', fontSize: 11, marginTop: 4 },
})

// ─── TechniquePickerSheet ─────────────────────────────────────────────────────

type SheetState = 'list' | 'info' | 'config'

export type TechniqueSelection = {
  setType: SetType
  technique: PlannedSetTechnique
  config: TechniqueConfig | null
}

interface TechniquePickerSheetProps {
  visible: boolean
  currentSetType: SetType
  currentTechnique: PlannedSetTechnique
  currentConfig: TechniqueConfig | null
  onConfirm: (selection: TechniqueSelection) => void
  onClose: () => void
}

export function TechniquePickerSheet({
  visible,
  currentSetType,
  currentTechnique,
  currentConfig,
  onConfirm,
  onClose,
}: TechniquePickerSheetProps) {
  const [state, setState] = useState<SheetState>('list')
  const [selectedOption, setSelectedOption] = useState<TechniqueOption>(OPTIONS[0]!)
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set())
  const [dontShowAgain, setDontShowAgain] = useState(false)

  // REST_PAUSE
  const [rpFailure, setRpFailure] = useState('3')
  const [rpRest, setRpRest] = useState('20')
  // MUSCLE_ROUND
  const [mrBlocks, setMrBlocks] = useState('6')
  const [mrReps, setMrReps] = useState('6')
  const [mrRest, setMrRest] = useState('30')
  // CLUSTER_SET
  const [csBlocks, setCsBlocks] = useState('4')
  const [csReps, setCsReps] = useState('4')
  const [csRest, setCsRest] = useState('15')
  // BACK_OFF
  const [boPercent, setBoPercent] = useState('60')

  useEffect(() => {
    if (!visible) return
    setState('list')
    const match = OPTIONS.find(o => o.setType === currentSetType && o.technique === currentTechnique)
    setSelectedOption(match ?? OPTIONS[0]!)
    setDontShowAgain(false)

    SecureStore.getItemAsync('technique_seen').then(val => {
      if (val) setSeenKeys(new Set(JSON.parse(val) as string[]))
    }).catch(() => {})

    const c = currentConfig as Record<string, unknown> | null
    if (c) {
      if (c['failurePoints']) setRpFailure(String(c['failurePoints']))
      if (c['restBetweenSeconds'] && currentTechnique === 'REST_PAUSE') setRpRest(String(c['restBetweenSeconds']))
      if (c['blocks'] && currentTechnique === 'MUSCLE_ROUND') setMrBlocks(String(c['blocks']))
      if (c['repsPerBlock'] && currentTechnique === 'MUSCLE_ROUND') setMrReps(String(c['repsPerBlock']))
      if (c['restBetweenSeconds'] && currentTechnique === 'MUSCLE_ROUND') setMrRest(String(c['restBetweenSeconds']))
      if (c['blocks'] && currentTechnique === 'CLUSTER_SET') setCsBlocks(String(c['blocks']))
      if (c['repsPerBlock'] && currentTechnique === 'CLUSTER_SET') setCsReps(String(c['repsPerBlock']))
      if (c['restBetweenSeconds'] && currentTechnique === 'CLUSTER_SET') setCsRest(String(c['restBetweenSeconds']))
      if (c['percentage']) setBoPercent(String(c['percentage']))
    }
  }, [visible])

  async function markSeen(key: string) {
    const next = new Set([...seenKeys, key])
    setSeenKeys(next)
    await SecureStore.setItemAsync('technique_seen', JSON.stringify([...next])).catch(() => {})
  }

  function handleOptionSelect(opt: TechniqueOption) {
    if (!opt.hasConfig) {
      onConfirm({ setType: opt.setType, technique: opt.technique, config: null })
      onClose()
      return
    }
    setSelectedOption(opt)
    setDontShowAgain(false)
    const alreadySeen = seenKeys.has(opt.technique)
    setState(alreadySeen ? 'config' : 'info')
  }

  function handleInfoContinue() {
    if (dontShowAgain) markSeen(selectedOption.technique)
    setState('config')
  }

  function isConfigValid(): boolean {
    switch (selectedOption.technique) {
      case 'REST_PAUSE':
        return isIntInRange(rpFailure, 2, 4) && isIntInRange(rpRest, 5, 60)
      case 'MUSCLE_ROUND':
        return isIntInRange(mrBlocks, 4, 8) && isIntInRange(mrReps, 1, 10) && isIntInRange(mrRest, 20, 60)
      case 'CLUSTER_SET':
        return isIntInRange(csBlocks, 2, 6) && isIntInRange(csReps, 1, 15) && isIntInRange(csRest, 5, 30)
      case 'BACK_OFF':
        return isIntInRange(boPercent, 40, 80)
      default:
        return true
    }
  }

  function buildConfig(): TechniqueConfig | null {
    switch (selectedOption.technique) {
      case 'REST_PAUSE':
        return { failurePoints: parseInt(rpFailure), restBetweenSeconds: parseInt(rpRest) }
      case 'MUSCLE_ROUND':
        return { blocks: parseInt(mrBlocks), repsPerBlock: parseInt(mrReps), restBetweenSeconds: parseInt(mrRest) }
      case 'CLUSTER_SET':
        return { blocks: parseInt(csBlocks), repsPerBlock: parseInt(csReps), restBetweenSeconds: parseInt(csRest) }
      case 'BACK_OFF':
        return { percentage: parseInt(boPercent) }
      default:
        return null
    }
  }

  function handleApply() {
    if (!isConfigValid()) return
    onConfirm({ setType: selectedOption.setType, technique: selectedOption.technique, config: buildConfig() })
    onClose()
  }

  const isActive = (opt: TechniqueOption) =>
    opt.setType === currentSetType && opt.technique === currentTechnique

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* ── LIST ── */}
          {state === 'list' && (
            <>
              <Text style={s.title}>Tipo de série</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.row, isActive(opt) && s.rowActive]}
                    onPress={() => handleOptionSelect(opt)}
                    activeOpacity={0.7}
                  >
                    <View style={s.rowInfo}>
                      <Text style={s.rowLabel}>{opt.label}</Text>
                      <Text style={s.rowDesc}>{opt.description}</Text>
                    </View>
                    <View style={s.rowRight}>
                      {opt.hasConfig && (
                        <TouchableOpacity
                          style={s.infoBtn}
                          onPress={() => {
                            setSelectedOption(opt)
                            setDontShowAgain(seenKeys.has(opt.technique))
                            setState('info')
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="information-circle-outline" size={18} color="#4A4A5A" />
                        </TouchableOpacity>
                      )}
                      {isActive(opt) ? (
                        <Ionicons name="checkmark-circle" size={20} color="#4FC3F7" />
                      ) : opt.hasConfig ? (
                        <Ionicons name="chevron-forward" size={16} color="#3A3A4A" />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* ── INFO ── */}
          {state === 'info' && (
            <>
              <TouchableOpacity style={s.backRow} onPress={() => setState('list')} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={16} color="#8A8A9A" />
                <Text style={s.backText}>Voltar</Text>
              </TouchableOpacity>
              <Text style={s.title}>{selectedOption.label}</Text>
              <Text style={s.infoText}>{selectedOption.infoText}</Text>
              <View style={s.dontShowRow}>
                <Text style={s.dontShowLabel}>Não mostrar novamente</Text>
                <Switch
                  value={dontShowAgain}
                  onValueChange={setDontShowAgain}
                  trackColor={{ false: '#2A2A35', true: '#2979FF' }}
                  thumbColor="#F0F0F5"
                />
              </View>
              {selectedOption.hasConfig ? (
                <TouchableOpacity style={s.confirmBtn} onPress={handleInfoContinue} activeOpacity={0.85}>
                  <Text style={s.confirmText}>Configurar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.confirmBtn} onPress={() => setState('list')} activeOpacity={0.85}>
                  <Text style={s.confirmText}>Entendido</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── CONFIG ── */}
          {state === 'config' && (
            <>
              <View style={s.configHeader}>
                <TouchableOpacity style={s.backRow} onPress={() => setState('list')} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={16} color="#8A8A9A" />
                  <Text style={s.backText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setDontShowAgain(seenKeys.has(selectedOption.technique)); setState('info') }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={20} color="#4A4A5A" />
                </TouchableOpacity>
              </View>
              <Text style={s.title}>Configurar {selectedOption.label}</Text>

              {selectedOption.technique === 'REST_PAUSE' && (
                <>
                  <ConfigInput label="Pontos de falha" value={rpFailure} onChange={setRpFailure} min={2} max={4} />
                  <ConfigInput label="Descanso entre falhas" value={rpRest} onChange={setRpRest} min={5} max={60} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'MUSCLE_ROUND' && (
                <>
                  <ConfigInput label="Blocos" value={mrBlocks} onChange={setMrBlocks} min={4} max={8} />
                  <ConfigInput label="Reps por bloco" value={mrReps} onChange={setMrReps} min={1} max={10} />
                  <ConfigInput label="Descanso entre blocos" value={mrRest} onChange={setMrRest} min={20} max={60} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'CLUSTER_SET' && (
                <>
                  <ConfigInput label="Blocos" value={csBlocks} onChange={setCsBlocks} min={2} max={6} />
                  <ConfigInput label="Reps por bloco" value={csReps} onChange={setCsReps} min={1} max={15} />
                  <ConfigInput label="Descanso entre blocos" value={csRest} onChange={setCsRest} min={5} max={30} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'BACK_OFF' && (
                <ConfigInput label="% da carga principal" value={boPercent} onChange={setBoPercent} min={40} max={80} suffix="%" />
              )}

              <TouchableOpacity
                style={[s.confirmBtn, !isConfigValid() && s.confirmBtnDisabled]}
                onPress={handleApply}
                activeOpacity={0.85}
                disabled={!isConfigValid()}
              >
                <Text style={s.confirmText}>Aplicar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E1E24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: '#2A2A35',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#F0F0F5',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A20',
  },
  rowActive: {
    backgroundColor: 'rgba(79,195,247,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  rowInfo: { flex: 1 },
  rowLabel: { color: '#F0F0F5', fontSize: 15, fontWeight: '500' },
  rowDesc: { color: '#555560', fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoBtn: { padding: 2 },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backText: { color: '#8A8A9A', fontSize: 14 },

  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoText: {
    color: '#8A8A9A',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  dontShowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  dontShowLabel: { color: '#8A8A9A', fontSize: 14 },

  confirmBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2979FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: '#1A2A4A',
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
