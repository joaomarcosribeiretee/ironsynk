import React, { useEffect, useRef } from 'react'
import {
  View, Text, Modal, StyleSheet, Animated,
  Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SCREEN_W } = Dimensions.get('window')

export type SheetAction = {
  label: string
  onPress: () => void
  destructive?: boolean
  cancel?: boolean
}

type Props = {
  visible: boolean
  title?: string
  actions: SheetAction[]
  onClose: () => void
}

export function ActionSheet({ visible, title, actions, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const scale = useRef(new Animated.Value(0.95)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      scale.setValue(0.95)
      opacity.setValue(0)
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  const mainActions = actions.filter(a => !a.cancel)
  const cancelAction = actions.find(a => a.cancel)

  function handlePress(action: SheetAction) {
    onClose()
    action.onPress()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[s.sheetWrap, { opacity, transform: [{ scale }] }]}>
          {/* Main actions group */}
          <View style={s.group}>
            {title && (
              <View style={s.titleRow}>
                <Text style={s.titleText} numberOfLines={1}>{title}</Text>
              </View>
            )}
            {mainActions.map((action, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
                onPress={() => handlePress(action)}
              >
                <Text style={[s.btnText, action.destructive && s.destructiveText]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cancel — separate with gap */}
          {cancelAction && (
            <View style={s.cancelGroup}>
              <Pressable
                style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
                onPress={() => { onClose(); cancelAction.onPress?.() }}
              >
                <Text style={s.cancelText}>{cancelAction.label}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheetWrap: {
    width: SCREEN_W - 32,
  },
  group: {
    backgroundColor: '#141418',
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  cancelGroup: {
    marginTop: 8,
    backgroundColor: '#141418',
    borderRadius: 20,
    padding: 16,
  },
  titleRow: {
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A35',
  },
  titleText: { color: '#8A8A9A', fontSize: 15, fontWeight: '400', textAlign: 'center' },
  btn: {
    height: 58,
    backgroundColor: '#1E1E24',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPressed: { backgroundColor: '#2A2A35' },
  btnText: { color: '#F0F0F5', fontSize: 17, fontWeight: '500' },
  destructiveText: { color: '#FF5252' },
  cancelText: { color: '#8A8A9A', fontSize: 17, fontWeight: '500' },
})
