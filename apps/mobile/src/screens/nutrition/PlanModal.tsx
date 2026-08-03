import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import type { DietGoal, NutritionPlanRecord } from '../../lib/api'

const { width: SCREEN_W } = Dimensions.get('window')

const GOALS: { key: DietGoal; label: string }[] = [
  { key: 'BULK', label: 'Bulk' },
  { key: 'CUT', label: 'Cutting' },
  { key: 'MAINTENANCE', label: 'Manutenção' },
  { key: 'RECOMP', label: 'Recomp' },
  { key: 'HEALTH', label: 'Saúde' },
]

// Creating a plan asks for a name and nothing else — meals, foods and goal are
// all configured afterwards, so the goal selector only shows when editing.
// Macro totals stay derived from the foods added to meals.
export type PlanFormData = { name: string; goal?: DietGoal | null }

type Props = {
  visible: boolean
  editing?: NutritionPlanRecord | null
  onClose: () => void
  onSave: (data: PlanFormData) => Promise<void>
}

export function PlanModal({ visible, editing, onClose, onSave }: Props) {
  const isEdit = !!editing

  const [name, setName] = useState('')
  const [goal, setGoal] = useState<DietGoal | null>(null)
  const [saving, setSaving] = useState(false)

  const scale = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '')
      setGoal(editing?.goal ?? null)
      setSaving(false)
      scale.setValue(0.92)
      Animated.spring(scale, {
        toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true,
      }).start()
    }
  }, [visible, editing])

  const canSave = name.trim().length > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave(isEdit ? { name: name.trim(), goal } : { name: name.trim() })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View style={[s.card, { transform: [{ scale }] }]}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{isEdit ? 'Editar Plano' : 'Novo Plano'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { marginTop: 0 }]}>Nome</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Nome do plano"
              placeholderTextColor="#4A4A5A"
              autoFocus
            />

            {isEdit && (
              <>
                <Text style={s.label}>Objetivo (opcional)</Text>
                <View style={s.goalRow}>
                  {GOALS.map((g) => {
                    const active = goal === g.key
                    return (
                      <TouchableOpacity
                        key={g.key}
                        onPress={() => setGoal(active ? null : g.key)}
                        style={[s.goalChip, active && s.goalChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.goalChipText, active && s.goalChipTextActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            )}

            <View style={s.btnSpacer} />
            <TouchableOpacity style={[s.btnWrap, !canSave && s.btnDisabled]} onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient
                colors={canSave ? ['#2979FF', '#1565C0'] : ['#2A2A35', '#2A2A35']}
                style={s.btn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isEdit ? 'Salvar alterações' : 'Criar Plano'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: SCREEN_W - 48,
    backgroundColor: '#1E1E24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '500' },

  btnSpacer: { height: 14 },

  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 14 },
  input: {
    height: 48,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#F0F0F5',
    fontSize: 15,
  },

  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
  },
  goalChipActive: { backgroundColor: 'rgba(41,121,255,0.15)', borderColor: '#2979FF' },
  goalChipText: { color: '#8A8A9A', fontSize: 13, fontWeight: '500' },
  goalChipTextActive: { color: '#4FC3F7' },

  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.4 },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
