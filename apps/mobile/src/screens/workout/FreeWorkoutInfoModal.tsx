import React, { useEffect, useRef } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_W } = Dimensions.get('window')

const TIPS = [
  'Adicione qualquer exercício na hora',
  'Registre carga e repetições de cada série',
  'Poste no feed ao finalizar',
]

type Props = {
  visible: boolean
  onConfirm: () => void
  onDismissForever: () => void
}

export function FreeWorkoutInfoModal({ visible, onConfirm, onDismissForever }: Props) {
  const scale = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92)
      Animated.spring(scale, {
        toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true,
      }).start()
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <LinearGradient colors={['#2979FF', '#1A237E']} style={s.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="flash" size={24} color="#fff" />
          </LinearGradient>

          <Text style={s.title}>Treino Livre</Text>
          <Text style={s.desc}>
            Sem programa, sem pressão. Adicione exercícios conforme você treina e anote
            suas cargas em tempo real. A sessão fica salva no seu histórico automaticamente.
          </Text>

          <View style={s.divider} />

          <View style={s.tips}>
            {TIPS.map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={[s.tipDot, { backgroundColor: i === 0 ? '#4FC3F7' : i === 1 ? '#2979FF' : '#00E676' }]} />
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.btnWrap} onPress={onConfirm} activeOpacity={0.85}>
            <LinearGradient colors={['#2979FF', '#1565C0']} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.btnText}>Entendido, vamos treinar!</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismissForever} style={s.skipBtn} activeOpacity={0.7}>
            <Text style={s.skipText}>Não mostrar novamente</Text>
          </TouchableOpacity>
        </Animated.View>
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
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { color: '#F0F0F5', fontSize: 20, fontWeight: '500', marginBottom: 10 },
  desc: { color: '#8A8A9A', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  divider: { width: '100%', height: 1, backgroundColor: '#2A2A35', marginBottom: 16 },
  tips: { width: '100%', gap: 12, marginBottom: 24 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  tipText: { color: '#8A8A9A', fontSize: 14, flex: 1 },
  btnWrap: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  skipBtn: { marginTop: 14, paddingVertical: 4 },
  skipText: { color: '#8A8A9A', fontSize: 13 },
})
