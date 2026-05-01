import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { TrainingGoal, ProgramRecord } from '../../lib/api'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

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
  const insets = useSafeAreaInsets()
  const isEdit = !!editingProgram

  const [name, setName] = useState('')
  const [goals, setGoals] = useState<TrainingGoal[]>([])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const scale = useRef(new Animated.Value(0.92)).current
  const translateY = useRef(new Animated.Value(SCREEN_H)).current

  useEffect(() => {
    if (visible) {
      setName(editingProgram?.name ?? '')
      setGoals(editingProgram?.goals ?? [])
      setDescription(editingProgram?.description ?? '')
      setSaving(false)
      if (isEdit) {
        translateY.setValue(SCREEN_H)
        Animated.spring(translateY, {
          toValue: 0, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true,
        }).start()
      } else {
        scale.setValue(0.92)
        Animated.spring(scale, {
          toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true,
        }).start()
      }
    }
  }, [visible, isEdit, editingProgram])

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

  const formFields = (
    <>
      <Text style={s.label}>Nome *</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex: PPL, ABC, Upper Lower..."
        placeholderTextColor="#4A4A5A"
        autoFocus={!isEdit}
      />

      <Text style={s.label}>OBJETIVO *</Text>
      <View style={s.goalsGrid}>
        {GOAL_OPTIONS.map(g => {
          const active = goals.includes(g.key)
          return (
            <TouchableOpacity
              key={g.key}
              style={[s.goalChip, active && s.goalChipActive]}
              onPress={() => toggleGoal(g.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.goalChipText, active && s.goalChipTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {goals.length === 0 && name.trim().length > 0 && (
        <Text style={s.hint}>Seleciona pelo menos um objetivo</Text>
      )}

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
    </>
  )

  const saveButton = (
    <TouchableOpacity
      style={[s.btnWrap, !canSave && s.btnDisabled]}
      onPress={handleSave}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={canSave ? ['#2979FF', '#1565C0'] : ['#2A2A35', '#2A2A35']}
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
  )

  if (isEdit) {
    const bottomPad = Math.max(insets.bottom, 16)
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <Animated.View style={[s.drawer, { paddingBottom: bottomPad, transform: [{ translateY }] }]}>
              <View style={s.handle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>Editar Programa</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#8A8A9A" />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.scrollPad}
              >
                {formFields}
              </ScrollView>
              <View style={s.footer}>
                {saveButton}
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    )
  }

  // CREATE — centered modal
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[s.card, { transform: [{ scale }] }]}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Novo Programa</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: SCREEN_H * 0.62 }}
              contentContainerStyle={s.scrollPad}
            >
              {formFields}
              {saveButton}
              <View style={{ height: 4 }} />
            </ScrollView>
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

  // Centered modal card
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

  // Drawer
  drawer: {
    width: '100%',
    backgroundColor: '#1E1E24',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: SCREEN_H * 0.72,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2A2A35', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: { color: '#F0F0F5', fontSize: 18, fontWeight: '500' },

  scrollPad: { paddingBottom: 8 },

  // Shared form
  label: { color: '#8A8A9A', fontSize: 11, fontWeight: '500', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  hint: { color: '#FFB300', fontSize: 12, marginTop: -6, marginBottom: 12 },
  input: {
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#F0F0F5',
    fontSize: 15,
    marginBottom: 16,
  },
  textArea: { height: 72, paddingTop: 12 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  goalChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A35',
    backgroundColor: '#141418',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  goalChipActive: {
    backgroundColor: 'rgba(41,121,255,0.12)',
    borderColor: '#2979FF',
  },
  goalChipText: { color: '#8A8A9A', fontSize: 13 },
  goalChipTextActive: { color: '#4FC3F7', fontWeight: '500' },

  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A35' },
  btnWrap: { borderRadius: 12, overflow: 'hidden' },
  btnDisabled: { opacity: 0.35 },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
})
