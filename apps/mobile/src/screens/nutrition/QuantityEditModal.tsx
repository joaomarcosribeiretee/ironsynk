import React, { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { MealFoodRecord } from '../../lib/api'

const { width: SCREEN_W } = Dimensions.get('window')

type Props = {
  mealFood: MealFoodRecord | null
  saving: boolean
  onClose: () => void
  onSave: (id: string, quantityG: number) => Promise<void>
}

// Lightweight gram-quantity editor for a food already in a meal.
export function QuantityEditModal({ mealFood, saving, onClose, onSave }: Props) {
  const [qty, setQty] = useState('')
  useEffect(() => { if (mealFood) setQty(String(mealFood.quantityG)) }, [mealFood])
  if (!mealFood) return null

  const parsed = parseFloat(qty.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed > 0

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={s.card}>
            <Text style={s.title} numberOfLines={1}>{mealFood.food.name}</Text>
            <Text style={s.label}>Quantidade (g)</Text>
            <TextInput style={s.input} value={qty} onChangeText={setQty} keyboardType="numeric" autoFocus placeholderTextColor="#4A4A5A" />
            <TouchableOpacity style={[s.btnWrap, !valid && { opacity: 0.4 }]} disabled={!valid || saving} onPress={() => valid && onSave(mealFood.id, parsed)} activeOpacity={0.85}>
              <LinearGradient colors={['#2979FF', '#1565C0']} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salvar</Text>}
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
  card: { width: SCREEN_W - 72, backgroundColor: '#1E1E24', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A35', padding: 20 },
  title: { color: '#F0F0F5', fontSize: 16, fontWeight: '600' },
  label: { color: '#8A8A9A', fontSize: 12, fontWeight: '400', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { height: 48, backgroundColor: '#141418', borderWidth: 1, borderColor: '#2A2A35', borderRadius: 12, paddingHorizontal: 16, color: '#F0F0F5', fontSize: 16 },
  btnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 18 },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
})
