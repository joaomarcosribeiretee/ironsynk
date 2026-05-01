import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

type Props = {
  visible: boolean
  onConfirm: () => void
  onDismissForever: () => void
}

export function FreeWorkoutInfoModal({ visible, onConfirm, onDismissForever }: Props) {
  const tips = [
    'Adicione exercícios a qualquer momento',
    'Anote carga e repetições de cada série',
    'Ao finalizar, você pode postar no feed',
  ]

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          <LinearGradient colors={['#4FC3F7', '#2979FF']} style={s.iconCircle}>
            <Ionicons name="flash" size={24} color="#fff" />
          </LinearGradient>

          <Text style={s.title}>Treino Livre</Text>
          <Text style={s.desc}>
            Sem programa, sem pressão. Adicione exercícios conforme você treina e anote suas cargas.
            A sessão fica salva no seu histórico automaticamente.
          </Text>

          <View style={s.divider} />

          <View style={s.tips}>
            {tips.map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={s.tipDot} />
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.btnWrap} onPress={onConfirm} activeOpacity={0.85}>
            <LinearGradient colors={['#4FC3F7', '#2979FF']} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.btnText}>Entendido, vamos lá!</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismissForever} style={s.skipBtn}>
            <Text style={s.skipText}>Não mostrar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: '#1E1E24', borderRadius: 24, padding: 28,
    width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A35',
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { color: '#F0F0F5', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  desc: { color: '#8A8A9A', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  divider: { width: '100%', height: 1, backgroundColor: '#2A2A35', marginBottom: 16 },
  tips: { width: '100%', gap: 10, marginBottom: 24 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4FC3F7' },
  tipText: { color: '#8A8A9A', fontSize: 14, flex: 1 },
  btnWrap: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  btn: { paddingVertical: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipBtn: { marginTop: 14, paddingVertical: 4 },
  skipText: { color: '#8A8A9A', fontSize: 13 },
})
