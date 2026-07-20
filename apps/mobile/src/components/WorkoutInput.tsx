import { useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle, KeyboardTypeOptions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FieldUnit } from './FieldUnit'
import type { FieldUnitKey } from './FieldUnit'

// Single source of truth for the visual appearance of every workout value input
// across the app (execution, view, edit, technique config). Reps, weight, rest,
// activation reps, mini-block reps, drop weights, cluster/failure blocks — all
// share these tokens. Technique identity lives in the badge and accent only; the
// input itself is always visually neutral. Only width may vary, never the style.

export const WORKOUT_INPUT = {
  height: 44,
  radius: 10,
  paddingH: 10,
  bg: '#1E1E24',
  bgDone: '#1A1A20',
  border: '#2A2A35',
  borderFocus: '#2979FF',
  text: '#F0F0F5',
  textDone: '#B9FFD8',
  placeholder: '#4A4A5A',
  fontSize: 15,
} as const

type WorkoutInputProps = {
  value: string
  onChangeText?: (v: string) => void
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  // Completed sets render the value read-only and slightly de-emphasised.
  completed?: boolean
  editable?: boolean
  // Fixed width OR flex — the only dimension allowed to differ between inputs.
  width?: number
  flex?: number
  leadingIcon?: keyof typeof Ionicons.glyphMap
  unit?: FieldUnitKey
  maxLength?: number
  containerStyle?: StyleProp<ViewStyle>
}

export function WorkoutInput({
  value, onChangeText, placeholder, keyboardType, completed = false,
  editable = true, width, flex, leadingIcon, unit, maxLength, containerStyle,
}: WorkoutInputProps) {
  const [focused, setFocused] = useState(false)
  const sizeStyle = width != null ? { width } : { flex: flex ?? 1 }

  return (
    <View
      style={[
        wi.wrap,
        sizeStyle,
        focused && wi.wrapFocused,
        completed && wi.wrapDone,
        containerStyle,
      ]}
    >
      {leadingIcon && (
        <Ionicons
          name={leadingIcon}
          size={14}
          color={focused ? WORKOUT_INPUT.borderFocus : '#555560'}
        />
      )}
      {completed ? (
        <Text style={[wi.input, wi.inputDone]} numberOfLines={1}>{value || '—'}</Text>
      ) : (
        <TextInput
          style={wi.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={WORKOUT_INPUT.placeholder}
          selectionColor={WORKOUT_INPUT.borderFocus}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
      {unit && <FieldUnit unit={unit} style={wi.unit} />}
    </View>
  )
}

const wi = StyleSheet.create({
  wrap: {
    height: WORKOUT_INPUT.height,
    backgroundColor: WORKOUT_INPUT.bg,
    borderWidth: 1,
    borderColor: WORKOUT_INPUT.border,
    borderRadius: WORKOUT_INPUT.radius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: WORKOUT_INPUT.paddingH,
    gap: 6,
  },
  wrapFocused: { borderColor: WORKOUT_INPUT.borderFocus },
  wrapDone: { backgroundColor: WORKOUT_INPUT.bgDone },
  input: {
    flex: 1,
    height: '100%',
    color: WORKOUT_INPUT.text,
    fontSize: WORKOUT_INPUT.fontSize,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 0,
  },
  inputDone: {
    color: WORKOUT_INPUT.textDone,
    textAlignVertical: 'center',
    fontWeight: '600',
  },
  unit: { color: '#555560' },
})
