import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import type { MealRecord } from '../../lib/api'

const { width: SCREEN_W } = Dimensions.get('window')

export type MealFormData = { name: string; targetTimeHour?: number | null }

type Props = {
  visible: boolean
  editing?: MealRecord | null
  onClose: () => void
  onSave: (data: MealFormData) => Promise<void>
}

export function MealModal({ visible, editing, onClose, onSave }: Props) {
  const isEdit = !!editing
  const [name, setName] = useState('')
  const [hour, setHour] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '')
      setHour(editing?.targetTimeHour != null ? String(editing.targetTimeHour) : '')
      setSaving(false)
    }
  }, [visible, editing])

  const canSave = name.trim().length > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const h = parseInt(hour, 10)
      await onSave({
        name: name.trim(),
        targetTimeHour: Number.isInteger(h) && h >= 0 && h <= 23 ? h : null,
      })
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
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{isEdit ? 'Editar refeição' : 'Nova refeição'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { marginTop: 0 }]}>Nome</Text>
            <TextInput
              style={s.input} value={name} onChangeText={setName}
              placeholder="Ex: Café da manhã" placeholderTextColor="#4A4A5A" autoFocus={!isEdit}
            />
            <Text style={s.label}>Horário (opcional, 0–23)</Text>
            <TextInput
              style={s.input} value={hour} onChangeText={setHour}
              keyboardType="numeric" placeholder="Ex: 8" placeholderTextColor="#4A4A5A" maxLength={2}
            />

            <View style={{ height: 16 }} />
            <TouchableOpacity style={[s.btnWrap, !canSave && s.btnDisabled]} onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient colors={canSave ? ['#2979FF', '#1565C0'] : ['#2A2A35', '#2A2A35']} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isEdit ? 'Salvar' : 'Adicionar'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: SCREEN_W - 48, backgroundColor: '#1E1E24', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A35', padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '500' },
  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 14 },
  input: {
    height: 48, backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35',
    borderRadius: 12, paddingHorizontal: 16, color: '#F0F0F5', fontSize: 15,
  },
  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.4 },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
