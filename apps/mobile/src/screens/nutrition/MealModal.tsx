import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator,
  Animated, Dimensions, Keyboard, ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import type { MealRecord } from '../../lib/api'

const { width: SCREEN_W } = Dimensions.get('window')

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

// The plan stores an hour slot (0–23), so the picker is a plain grid of hours.
// A native time dialog can't be used here: this component lives inside an RN
// Modal, which is its own window on Android, and the platform dialog opens
// behind it — invisible, with no error.
const HOURS = Array.from({ length: 24 }, (_, i) => i)

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
  const [hour, setHour] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const scale = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '')
      const h = editing?.targetTimeHour
      const valid = typeof h === 'number' && h >= 0 && h <= 23 ? h : null
      setHour(valid)
      setPickerOpen(false)
      setSaving(false)
      scale.setValue(0.92)
      Animated.spring(scale, {
        toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true,
      }).start()
    }
  }, [visible, editing])

  const canSave = name.trim().length > 0

  function openPicker() {
    if (pickerOpen) { setPickerOpen(false); return }
    Keyboard.dismiss()
    setPickerOpen(true)
  }

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), targetTimeHour: hour })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[s.card, { transform: [{ scale }] }]}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{isEdit ? 'Editar Refeição' : 'Nova Refeição'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { marginTop: 0 }]}>Nome *</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Café da manhã, Almoço..."
              placeholderTextColor="#4A4A5A"
              autoFocus
            />
            <Text style={s.label}>Horário (opcional)</Text>
            <TouchableOpacity
              style={[s.input, s.timeField, pickerOpen && s.timeFieldOpen]}
              onPress={openPicker}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color={hour != null ? '#4FC3F7' : '#4A4A5A'} />
              <Text style={[s.timeValue, hour == null && s.timePlaceholder]}>
                {hour != null ? fmtHour(hour) : 'Selecionar horário'}
              </Text>
              {hour != null ? (
                <TouchableOpacity
                  onPress={() => { setHour(null); setPickerOpen(false) }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color="#555560" />
                </TouchableOpacity>
              ) : (
                <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#555560" />
              )}
            </TouchableOpacity>

            {pickerOpen && (
              <View style={s.pickerPanel}>
                <ScrollView
                  style={s.pickerScroll}
                  contentContainerStyle={s.pickerGrid}
                  keyboardShouldPersistTaps="handled"
                >
                  {HOURS.map((h) => {
                    const selected = h === hour
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[s.hourChip, selected && s.hourChipOn]}
                        onPress={() => { setHour(h); setPickerOpen(false) }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.hourText, selected && s.hourTextOn]}>{fmtHour(h)}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            <View style={{ height: 20 }} />
            <TouchableOpacity style={[s.btnWrap, !canSave && s.btnDisabled]} onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient
                colors={canSave ? ['#2979FF', '#1565C0'] : ['#2A2A35', '#2A2A35']}
                style={s.btn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isEdit ? 'Salvar' : 'Criar Refeição'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
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
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '500' },

  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  input: {
    height: 52,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#F0F0F5',
    fontSize: 15,
  },

  timeField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeFieldOpen: { borderColor: '#2979FF' },
  timeValue: { flex: 1, color: '#F0F0F5', fontSize: 15 },
  timePlaceholder: { color: '#4A4A5A' },

  pickerPanel: {
    marginTop: 8,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 12,
    paddingTop: 4,
    overflow: 'hidden',
  },
  pickerScroll: { maxHeight: 196 },
  pickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12,
  },
  hourChip: {
    width: 62, height: 38,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: '#2A2A35',
    backgroundColor: '#1E1E24',
  },
  hourChipOn: { borderColor: '#2979FF', backgroundColor: 'rgba(41,121,255,0.14)' },
  hourText: { color: '#8A8A9A', fontSize: 14, fontVariant: ['tabular-nums'] },
  hourTextOn: { color: '#4FC3F7', fontWeight: '600' },

  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.35 },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
