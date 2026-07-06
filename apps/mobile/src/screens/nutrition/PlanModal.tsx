import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { DietGoal, NutritionPlanRecord } from '../../lib/api'

const GOALS: { key: DietGoal; label: string }[] = [
  { key: 'BULK', label: 'Bulk' },
  { key: 'CUT', label: 'Cutting' },
  { key: 'MAINTENANCE', label: 'Manutenção' },
  { key: 'RECOMP', label: 'Recomp' },
  { key: 'HEALTH', label: 'Saúde' },
]

export type PlanFormData = {
  name: string
  goal?: DietGoal | null
  targetCalories?: number | null
  targetProteinG?: number | null
  targetCarbsG?: number | null
  targetFatG?: number | null
}

type Props = {
  visible: boolean
  editing?: NutritionPlanRecord | null
  onClose: () => void
  onSave: (data: PlanFormData) => Promise<void>
}

function toNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function PlanModal({ visible, editing, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets()
  const isEdit = !!editing

  const [name, setName] = useState('')
  const [goal, setGoal] = useState<DietGoal | null>(null)
  const [cal, setCal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '')
      setGoal(editing?.goal ?? null)
      setCal(editing?.targetCalories != null ? String(editing.targetCalories) : '')
      setProtein(editing?.targetProteinG != null ? String(editing.targetProteinG) : '')
      setCarbs(editing?.targetCarbsG != null ? String(editing.targetCarbsG) : '')
      setFat(editing?.targetFatG != null ? String(editing.targetFatG) : '')
      setSaving(false)
    }
  }, [visible, editing])

  const canSave = name.trim().length > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        goal,
        targetCalories: toNum(cal),
        targetProteinG: toNum(protein),
        targetCarbsG: toNum(carbs),
        targetFatG: toNum(fat),
      })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const bottomPad = Math.max(insets.bottom, 16)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View style={[s.drawer, { paddingBottom: bottomPad }]}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{isEdit ? 'Editar plano' : 'Novo plano'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollPad}>
              <Text style={[s.label, { marginTop: 0 }]}>Nome</Text>
              <TextInput
                style={s.input} value={name} onChangeText={setName}
                placeholder="Ex: Cutting 2000 kcal" placeholderTextColor="#4A4A5A" autoFocus={!isEdit}
              />

              <Text style={s.label}>Objetivo</Text>
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

              <Text style={s.label}>Metas diárias (opcional)</Text>
              <View style={s.targetRow}>
                <View style={s.targetCol}>
                  <Text style={s.miniLabel}>Calorias</Text>
                  <TextInput style={s.input} value={cal} onChangeText={setCal} keyboardType="numeric" placeholder="kcal" placeholderTextColor="#4A4A5A" />
                </View>
                <View style={s.targetCol}>
                  <Text style={s.miniLabel}>Proteína (g)</Text>
                  <TextInput style={s.input} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="g" placeholderTextColor="#4A4A5A" />
                </View>
              </View>
              <View style={s.targetRow}>
                <View style={s.targetCol}>
                  <Text style={s.miniLabel}>Carbo (g)</Text>
                  <TextInput style={s.input} value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="g" placeholderTextColor="#4A4A5A" />
                </View>
                <View style={s.targetCol}>
                  <Text style={s.miniLabel}>Gordura (g)</Text>
                  <TextInput style={s.input} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="g" placeholderTextColor="#4A4A5A" />
                </View>
              </View>

              <View style={{ height: 20 }} />
              <TouchableOpacity style={[s.btnWrap, !canSave && s.btnDisabled]} onPress={handleSave} activeOpacity={0.85}>
                <LinearGradient colors={canSave ? ['#2979FF', '#1565C0'] : ['#2A2A35', '#2A2A35']} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isEdit ? 'Salvar alterações' : 'Criar plano'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  drawer: {
    width: '100%', backgroundColor: '#1E1E24',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '88%',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#2A2A35', alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { color: '#F0F0F5', fontSize: 20, fontWeight: '500' },
  scrollPad: { paddingBottom: 24 },

  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 18 },
  miniLabel: { color: '#8A8A9A', fontSize: 11, marginBottom: 6 },
  input: {
    height: 48, backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingHorizontal: 16, color: '#F0F0F5', fontSize: 15,
  },

  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
  },
  goalChipActive: { backgroundColor: 'rgba(41,121,255,0.15)', borderColor: '#2979FF' },
  goalChipText: { color: '#8A8A9A', fontSize: 13, fontWeight: '500' },
  goalChipTextActive: { color: '#4FC3F7' },

  targetRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  targetCol: { flex: 1 },

  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.4 },
  btn: { height: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
