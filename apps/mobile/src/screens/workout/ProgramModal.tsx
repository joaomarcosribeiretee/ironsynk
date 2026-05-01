import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { TrainingGoal, ProgramRecord } from '../../lib/api'

const GOAL_OPTIONS: { key: TrainingGoal; label: string }[] = [
  { key: 'HYPERTROPHY', label: 'Hipertrofia' },
  { key: 'STRENGTH', label: 'Força' },
  { key: 'FAT_LOSS', label: 'Emagrecimento' },
  { key: 'ENDURANCE', label: 'Resistência' },
  { key: 'HEALTH', label: 'Saúde' },
  { key: 'PERFORMANCE', label: 'Performance' },
]

type Props = {
  visible: boolean
  editingProgram?: ProgramRecord | null
  onClose: () => void
  onSave: (data: { name: string; goals: TrainingGoal[]; description?: string }) => Promise<void>
}

export function ProgramModal({ visible, editingProgram, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [goals, setGoals] = useState<TrainingGoal[]>([])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!editingProgram

  useEffect(() => {
    if (visible) {
      setName(editingProgram?.name ?? '')
      setGoals(editingProgram?.goals ?? [])
      setDescription(editingProgram?.description ?? '')
      setSaving(false)
    }
  }, [visible, editingProgram])

  function toggleGoal(goal: TrainingGoal) {
    setGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal])
  }

  const canSave = name.trim().length > 0 && goals.length > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), goals, description: description.trim() || undefined })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{isEdit ? 'Editar Programa' : 'Novo Programa'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Nome *</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: PPL Hipertrofia, ABC Volume..."
              placeholderTextColor="#4A4A5A"
              autoFocus={!isEdit}
            />

            <Text style={s.label}>Objetivo *</Text>
            <View style={s.goalsGrid}>
              {GOAL_OPTIONS.map(g => {
                const active = goals.includes(g.key)
                return (
                  <TouchableOpacity
                    key={g.key}
                    style={[s.goalChip, active && s.goalChipActive]}
                    onPress={() => toggleGoal(g.key)}
                    activeOpacity={0.75}
                  >
                    {active ? (
                      <LinearGradient colors={['#4FC3F7', '#2979FF']} style={s.goalChipGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={s.goalChipTextActive}>{g.label}</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={s.goalChipText}>{g.label}</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={s.label}>Descrição (opcional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Notas sobre o programa..."
              placeholderTextColor="#4A4A5A"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.btnWrap, !canSave && s.btnDisabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={canSave ? ['#4FC3F7', '#2979FF'] : ['#2A2A35', '#2A2A35']}
                style={s.btn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>{isEdit ? 'Salvar alterações' : 'Criar Programa'}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1E1E24', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2A2A35', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#F0F0F5', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#F0F0F5', fontSize: 15, marginBottom: 16,
  },
  textArea: { height: 80, paddingTop: 12 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  goalChip: {
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A35',
    backgroundColor: '#141418', overflow: 'hidden',
  },
  goalChipActive: { borderColor: '#2979FF' },
  goalChipGrad: { paddingHorizontal: 16, paddingVertical: 8 },
  goalChipText: { color: '#8A8A9A', fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
  goalChipTextActive: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btn: { paddingVertical: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
