import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/** Circular avatar with an initials fallback — the app has no placeholder image. */
export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null
  name?: string | null
  size?: number
}) {
  const style = { width: size, height: size, borderRadius: size / 2 }

  if (uri) {
    return <Image source={{ uri }} style={[s.base, style]} />
  }

  return (
    <View style={[s.base, s.fallback, style]}>
      <Text style={[s.initials, { fontSize: Math.max(11, size * 0.36) }]}>{getInitials(name)}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  base: { flexShrink: 0, backgroundColor: '#2A2A35' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#F0F0F5', fontWeight: '700' },
})
