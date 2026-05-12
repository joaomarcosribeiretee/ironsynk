import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WorkoutRecord } from '../../lib/api'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

type Props = {
  visible: boolean
  programId: string | null
  editingWorkout?: WorkoutRecord | null
  onClose: () => void
  onSave: (data: { name: string; description?: string }) => Promise<void>
}

export function WorkoutModal({ visible, editingWorkout, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets()
  const isEdit = !!editingWorkout

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const scale = useRef(new Animated.Value(0.92)).current
  const translateY = useRef(new Animated.Value(SCREEN_H)).current

  useEffect(() => {
    if (visible) {
      setName(editingWorkout?.name ?? '')
      setDescription(editingWorkout?.notes ?? '')
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
  }, [visible, isEdit, editingWorkout])

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

  const formFields = (
    <>
      <Text style={[s.label, { marginTop: 0 }]}>Nome *</Text>
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
          : <Text style={s.btnText}>{isEdit ? 'Salvar' : 'Criar Treino'}</Text>
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
                <Text style={s.sheetTitle}>Editar Treino</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#8A8A9A" />
                </TouchableOpacity>
              </View>
              {formFields}
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
              <Text style={s.cardTitle}>Novo Treino</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#8A8A9A" />
              </TouchableOpacity>
            </View>
            {formFields}
            <View style={{ height: 20 }} />
            {saveButton}
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

  drawer: {
    width: '100%',
    backgroundColor: '#1E1E24',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#2A2A35', alignSelf: 'center', marginBottom: 14 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: { color: '#F0F0F5', fontSize: 20, fontWeight: '500' },

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
  textArea: { height: 80, paddingTop: 14, paddingBottom: 14 },

  footer: { paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#2A2A35' },
  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.35 },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
