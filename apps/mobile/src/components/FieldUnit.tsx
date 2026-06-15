import { Text, StyleSheet } from 'react-native'
import type { StyleProp, TextStyle } from 'react-native'

// Shared inline unit label for every set value field across the workout screens
// (execution, view, edit, read-only). Guarantees a reps / kg / s / drop value is
// never shown without saying what it represents. Compact by default; callers
// pass `style` to match local color and size.

export const FIELD_UNITS = {
  reps: 'reps',
  kg: 'kg',
  sec: 's',
  block: 'bloco',
  drop: 'drop',
} as const

export type FieldUnitKey = keyof typeof FIELD_UNITS

export function FieldUnit({ unit, style }: { unit: FieldUnitKey; style?: StyleProp<TextStyle> }) {
  return <Text style={[fu.base, style]} allowFontScaling>{FIELD_UNITS[unit]}</Text>
}

const fu = StyleSheet.create({
  base: { color: '#555560', fontSize: 11, fontWeight: '500' },
})
