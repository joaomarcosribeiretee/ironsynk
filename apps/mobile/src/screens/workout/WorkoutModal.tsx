import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { WorkoutRecord } from '../../lib/api'

type Props = {
  visible: boolean
  programId: string | null
  editingWorkout?: WorkoutRecord | null
  onClose: () => void
  onSave: (data: { name: string; description?: string }) => Promise<void>
}

export function WorkoutModal({ visible, editingWorkout, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!editingWorkout

  useEffect(() => {
    if (visible) {
      setName(editingWorkout?.name ?? '')
      setDescription(editingWorkout?.notes ?? '')
      setSaving(false)
    }
  }, [visible, editingWorkout])

  const canSave = name.trim().length > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined })
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
          <Text style={s.title}>{isEdit ? 'Editar Treino' : 'Novo Treino'}</Text>

          <Text style={s.label}>Nome *</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Push A, Peito e Tríceps..."
            placeholderTextColor="#4A4A5A"
            autoFocus
          />

          <Text style={s.label}>Descrição (opcional)</Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Notas sobre o treino..."
            placeholderTextColor="#4A4A5A"
            multiline
            numberOfLines={2}
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
                : <Text style={s.btnText}>{isEdit ? 'Salvar alterações' : 'Criar Treino'}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1E1E24', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2A2A35', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#F0F0F5', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#F0F0F5', fontSize: 15, marginBottom: 16,
  },
  textArea: { height: 64, paddingTop: 12 },
  btnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  btnDisabled: { opacity: 0.4 },
  btn: { paddingVertical: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
