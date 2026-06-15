import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable, Switch,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import type { SetType, PlannedSetTechnique, TechniqueConfig } from '../../lib/api'
import { WorkoutInput } from '../../components/WorkoutInput'

// ─── Technique metadata ───────────────────────────────────────────────────────

type TechniqueOption = {
  label: string
  description: string
  setType: SetType
  technique: PlannedSetTechnique
  hasConfig: boolean
  infoText: string
  seenKey: string
}

const OPTIONS: TechniqueOption[] = [
  {
    label: 'Working',
    description: 'Série de trabalho padrão',
    setType: 'WORKING', technique: 'NONE', hasConfig: false,
    infoText: '',
    seenKey: '',
  },
  {
    label: 'Aquecimento',
    description: 'Longe da falha — não conta no volume',
    setType: 'WARMUP', technique: 'NONE', hasConfig: false,
    infoText:
      'Série de aquecimento realizada longe da falha. Serve para preparar articulações e sistema nervoso para a carga de trabalho.\n\nNão é contabilizada no volume total.',
    seenKey: 'info_warmup',
  },
  {
    label: 'Feeder Set',
    description: 'Série de ajuste — não conta no volume',
    setType: 'FEEDER', technique: 'NONE', hasConfig: false,
    infoText:
      'Uma série de ativação com carga moderada e volume alto, realizada dias antes ou no início do treino do grupamento. O objetivo é aumentar o fluxo sanguíneo, melhorar a conexão mente-músculo e preparar o tecido sem gerar fadiga excessiva.\n\nNão conta no volume total do treino.',
    seenKey: 'info_feeder',
  },
  {
    label: 'Back-Off',
    description: 'Série com carga reduzida — apenas visual',
    setType: 'WORKING', technique: 'BACK_OFF', hasConfig: false,
    infoText:
      'Após as séries principais, realize uma série com carga reduzida. Diferenciada visualmente das séries principais.',
    seenKey: 'info_back_off',
  },
  {
    label: 'Rest-Pause',
    description: 'Até a falha, pause, repita',
    setType: 'WORKING', technique: 'REST_PAUSE', hasConfig: true,
    infoText:
      'Técnica de alta intensidade onde você leva a série próximo ou até a falha, descansa brevemente e retoma com o mesmo peso. Cada rodada é chamada de ponto de falha. O número de pontos de falha e o tempo de descanso entre eles são configuráveis.\n\nTudo conta como UMA série no volume total.',
    seenKey: 'info_rest_pause',
  },
  {
    label: 'Cluster Set',
    description: 'Blocos com breve descanso entre eles',
    setType: 'WORKING', technique: 'CLUSTER_SET', hasConfig: true,
    infoText:
      'Divida uma série em mini-blocos com breves pausas entre eles. Exemplo: 4 blocos de 5 reps com 15s de descanso — em vez de falhar em 12 reps contínuas, você completa 20 reps com a mesma carga e maior qualidade mecânica.\n\nO peso é o mesmo do início ao fim. Configure o número de blocos, as reps alvo por bloco e o descanso entre eles.\n\nConta como UMA série no volume total.',
    seenKey: 'info_cluster_set',
  },
  {
    label: 'Muscle Round',
    description: 'Blocos curtos com descanso mínimo',
    setType: 'WORKING', technique: 'MUSCLE_ROUND', hasConfig: true,
    infoText:
      'Execute blocos curtos de repetições com pausas mínimas entre eles. Use o peso principal nos primeiros blocos. Quando a falha ocorrer, marque o bloco — os blocos restantes são completados com o peso de queda (pré-definido por você). O objetivo é aumentar o total de reps a cada treino; quando atingir sua meta, aumente ambos os pesos.\n\nConfigure: blocos, reps por bloco, descanso entre blocos e peso de queda. O peso principal é definido na série.\n\nConta como UMA série no volume total.',
    seenKey: 'info_muscle_round',
  },
  {
    label: 'Myo Reps',
    description: 'Ativação + mini-blocos até a falha',
    setType: 'WORKING', technique: 'MYOREP', hasConfig: true,
    infoText:
      'Técnica criada por Borge Fagerli. Comece com uma série de ativação próximo à falha para recrutar o máximo de fibras. Descanse brevemente e execute mini-blocos no mesmo peso até não conseguir mais.\n\nExemplo: Cadeira extensora 40 kg — ativação: 15 reps. Descanse 20s. Mini-blocos: 4, 4, 3 reps (15s entre eles). Parou ao atingir a falha.\n\nConfigure: reps de ativação, descanso pós-ativação, reps por mini-bloco e descanso entre mini-blocos. Quantidade de mini-blocos determinada durante a execução.\n\nTudo conta como UMA série no volume total.',
    seenKey: 'info_myo_reps',
  },
  {
    label: 'Drop Set',
    description: 'Reduza a carga e continue sem descanso',
    setType: 'WORKING', technique: 'DROP_SET', hasConfig: true,
    infoText:
      'Ao atingir a falha (ou próximo dela), você reduz a carga imediatamente sem descanso e continua. Cada redução de carga é um "drop".\n\nExemplo: Rosca direta — Série Principal com 20 kg até a falha (10 reps). Drop 1: reduz para 15 kg, mais 8 reps. Drop 2: reduz para 10 kg, mais 6 reps.\n\nConfigure o número de drops e os pesos planejados para cada etapa. Durante a execução, apenas as repetições são registradas — os pesos já estão definidos.\n\nTudo conta como UMA série no volume total.',
    seenKey: 'info_drop_set',
  },
]

// ─── Config field validation ──────────────────────────────────────────────────

function isIntInRange(val: string, min: number, max: number) {
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= min && n <= max && String(n) === val.trim()
}

// ─── ConfigInput ──────────────────────────────────────────────────────────────

function ConfigInput({
  label, value, onChange, min, max, suffix,
}: {
  label: string; value: string; onChange: (v: string) => void
  min: number; max: number; suffix?: string
}) {
  const valid = isIntInRange(value, min, max)
  return (
    <View style={ci.wrap}>
      <Text style={ci.label}>{label}</Text>
      <View style={ci.row}>
        <WorkoutInput
          flex={1}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={4}
          placeholder={`${min}–${max}`}
          containerStyle={!valid ? ci.inputError : undefined}
        />
        {suffix ? <Text style={ci.suffix}>{suffix}</Text> : null}
      </View>
      {!valid && <Text style={ci.hint}>{min}–{max}</Text>}
    </View>
  )
}

const ci = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: { color: '#8A8A9A', fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  visible, currentSetType, currentTechnique, currentConfig, onConfirm, onClose,
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
  const [mrRepsPerBlock, setMrRepsPerBlock] = useState('6')
  const [mrRest, setMrRest] = useState('35')
  // CLUSTER_SET
  const [csBlocks, setCsBlocks] = useState('4')
  const [csRepsPerBlock, setCsRepsPerBlock] = useState('5')
  const [csRest, setCsRest] = useState('15')
  // MYOREP
  const [myoActivationReps, setMyoActivationReps] = useState('5')
  const [myoActivationRest, setMyoActivationRest] = useState('40')
  const [myoRepsPerBlock, setMyoRepsPerBlock] = useState('2')
  const [myoRestBetween, setMyoRestBetween] = useState('20')
  // DROP_SET — weights are entered during Workout Execution, not here
  const [dsDrops, setDsDrops] = useState('2')

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
      if (currentTechnique === 'REST_PAUSE') {
        if (c['failurePoints']) setRpFailure(String(c['failurePoints']))
        if (c['restBetweenSeconds']) setRpRest(String(c['restBetweenSeconds']))
      }
      if (currentTechnique === 'MUSCLE_ROUND') {
        if (c['blocks']) setMrBlocks(String(c['blocks']))
        if (c['repsPerBlock']) setMrRepsPerBlock(String(c['repsPerBlock']))
        if (c['restBetweenSeconds']) setMrRest(String(c['restBetweenSeconds']))
      }
      if (currentTechnique === 'CLUSTER_SET') {
        if (c['blocks']) setCsBlocks(String(c['blocks']))
        if (c['repsPerBlock']) setCsRepsPerBlock(String(c['repsPerBlock']))
        if (c['restBetweenSeconds']) setCsRest(String(c['restBetweenSeconds']))
      }
      if (currentTechnique === 'MYOREP') {
        if (c['activationReps']) setMyoActivationReps(String(c['activationReps']))
        if (c['activationRestSeconds']) setMyoActivationRest(String(c['activationRestSeconds']))
        if (c['repsPerBlock']) setMyoRepsPerBlock(String(c['repsPerBlock']))
        if (c['restBetweenSeconds']) setMyoRestBetween(String(c['restBetweenSeconds']))
      }
      if (currentTechnique === 'DROP_SET') {
        if (c['drops']) setDsDrops(String(c['drops']))
      }
    }
  }, [visible])

  async function markSeen(key: string) {
    if (!key) return
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
    const alreadySeen = seenKeys.has(opt.seenKey)
    setState(alreadySeen ? 'config' : 'info')
  }

  function handleInfoOpen(opt: TechniqueOption) {
    setSelectedOption(opt)
    setDontShowAgain(seenKeys.has(opt.seenKey))
    setState('info')
  }

  function handleInfoContinue() {
    if (dontShowAgain && selectedOption.seenKey) markSeen(selectedOption.seenKey)
    if (selectedOption.hasConfig) {
      setState('config')
    } else {
      setState('list')
    }
  }

  function isConfigValid(): boolean {
    switch (selectedOption.technique) {
      case 'REST_PAUSE':
        return isIntInRange(rpFailure, 1, 5) && isIntInRange(rpRest, 5, 60)
      case 'MUSCLE_ROUND':
        return isIntInRange(mrBlocks, 4, 10) && isIntInRange(mrRepsPerBlock, 1, 10) && isIntInRange(mrRest, 20, 60)
      case 'CLUSTER_SET':
        return isIntInRange(csBlocks, 2, 10) && isIntInRange(csRepsPerBlock, 1, 20) && isIntInRange(csRest, 5, 60)
      case 'MYOREP':
        return isIntInRange(myoActivationReps, 5, 30) && isIntInRange(myoActivationRest, 10, 60) &&
               isIntInRange(myoRepsPerBlock, 1, 10) && isIntInRange(myoRestBetween, 5, 45)
      case 'DROP_SET':
        return isIntInRange(dsDrops, 1, 10)
      default:
        return true
    }
  }

  function buildConfig(): TechniqueConfig | null {
    switch (selectedOption.technique) {
      case 'REST_PAUSE':
        return { failurePoints: parseInt(rpFailure), restBetweenSeconds: parseInt(rpRest) }
      case 'MUSCLE_ROUND':
        return { blocks: parseInt(mrBlocks), repsPerBlock: parseInt(mrRepsPerBlock), restBetweenSeconds: parseInt(mrRest) }
      case 'CLUSTER_SET':
        return { blocks: parseInt(csBlocks), repsPerBlock: parseInt(csRepsPerBlock), restBetweenSeconds: parseInt(csRest) }
      case 'MYOREP':
        return {
          activationReps: parseInt(myoActivationReps),
          activationRestSeconds: parseInt(myoActivationRest),
          repsPerBlock: parseInt(myoRepsPerBlock),
          restBetweenSeconds: parseInt(myoRestBetween),
        }
      case 'DROP_SET':
        // Only the drop count is planned; weights are filled during execution.
        return { drops: parseInt(dsDrops) }
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>

          {/* ── LIST ── */}
          {state === 'list' && (
            <>
              <View style={s.titleRow}>
                <Text style={s.title}>Tipo de série</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={20} color="#4A4A5A" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
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
                      {opt.infoText !== '' && (
                        <TouchableOpacity
                          style={s.infoBtn}
                          onPress={() => handleInfoOpen(opt)}
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
              {selectedOption.hasConfig && (
                <View style={s.dontShowRow}>
                  <Text style={s.dontShowLabel}>Não mostrar novamente</Text>
                  <Switch
                    value={dontShowAgain}
                    onValueChange={setDontShowAgain}
                    trackColor={{ false: '#2A2A35', true: '#2979FF' }}
                    thumbColor="#F0F0F5"
                  />
                </View>
              )}
              <TouchableOpacity style={s.confirmBtn} onPress={handleInfoContinue} activeOpacity={0.85}>
                <Text style={s.confirmText}>{selectedOption.hasConfig ? 'Configurar' : 'Entendido'}</Text>
              </TouchableOpacity>
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
                  onPress={() => { setDontShowAgain(seenKeys.has(selectedOption.seenKey)); setState('info') }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={20} color="#4A4A5A" />
                </TouchableOpacity>
              </View>
              <Text style={s.title}>Configurar {selectedOption.label}</Text>

              {selectedOption.technique === 'REST_PAUSE' && (
                <>
                  <ConfigInput label="Blocos extras (falhas)" value={rpFailure} onChange={setRpFailure} min={1} max={5} />
                  <ConfigInput label="Descanso entre blocos" value={rpRest} onChange={setRpRest} min={5} max={60} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'MUSCLE_ROUND' && (
                <>
                  <ConfigInput label="Blocos" value={mrBlocks} onChange={setMrBlocks} min={4} max={10} />
                  <ConfigInput label="Reps por bloco" value={mrRepsPerBlock} onChange={setMrRepsPerBlock} min={1} max={10} />
                  <ConfigInput label="Descanso entre blocos" value={mrRest} onChange={setMrRest} min={20} max={60} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'CLUSTER_SET' && (
                <>
                  <ConfigInput label="Blocos" value={csBlocks} onChange={setCsBlocks} min={2} max={10} />
                  <ConfigInput label="Reps por bloco" value={csRepsPerBlock} onChange={setCsRepsPerBlock} min={1} max={20} />
                  <ConfigInput label="Descanso entre blocos" value={csRest} onChange={setCsRest} min={5} max={60} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'MYOREP' && (
                <>
                  <ConfigInput label="Reps de ativação" value={myoActivationReps} onChange={setMyoActivationReps} min={5} max={30} />
                  <ConfigInput label="Descanso pós-ativação" value={myoActivationRest} onChange={setMyoActivationRest} min={10} max={60} suffix="s" />
                  <ConfigInput label="Reps por mini-bloco" value={myoRepsPerBlock} onChange={setMyoRepsPerBlock} min={1} max={10} />
                  <ConfigInput label="Descanso entre mini-blocos" value={myoRestBetween} onChange={setMyoRestBetween} min={5} max={45} suffix="s" />
                </>
              )}

              {selectedOption.technique === 'DROP_SET' && (
                <>
                  <ConfigInput
                    label="Número de drops"
                    value={dsDrops}
                    onChange={setDsDrops}
                    min={1}
                    max={10}
                  />
                  <Text style={s.dropHint}>Os pesos de cada drop são definidos durante a execução do treino.</Text>
                </>
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    paddingTop: 22,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
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
    height: 50, borderRadius: 12,
    backgroundColor: '#2979FF',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnDisabled: { backgroundColor: '#1A2A4A' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dropHint: { color: '#555560', fontSize: 12, lineHeight: 17, marginTop: -8, marginBottom: 20 },
})
