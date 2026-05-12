import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable, Dimensions } from 'react-native'

const { width: SCREEN_W } = Dimensions.get('window')

type Props = {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  visible, title, message, confirmText = 'Confirmar', destructive, onConfirm, onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.divider} />
          <View style={s.buttons}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <View style={s.vDivider} />
            <TouchableOpacity style={s.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={[s.confirmText, destructive && s.destructiveText]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 40,
  },
  card: {
    width: SCREEN_W - 80,
    backgroundColor: '#1E1E24',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A35',
    overflow: 'hidden',
  },
  title: {
    color: '#F0F0F5',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  message: {
    color: '#8A8A9A',
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  divider: { height: 1, backgroundColor: '#2A2A35' },
  vDivider: { width: 1, backgroundColor: '#2A2A35', alignSelf: 'stretch' },
  buttons: { flexDirection: 'row' },
  cancelBtn: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center' },
  confirmBtn: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: '#8A8A9A', fontSize: 16, fontWeight: '500' },
  confirmText: { color: '#4FC3F7', fontSize: 16, fontWeight: '600' },
  destructiveText: { color: '#FF5252' },
})
