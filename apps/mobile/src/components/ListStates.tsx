import React from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

/**
 * The three states every social list can land in. Kept in one file so the feed,
 * comments, search and follow lists never drift apart visually.
 */

export function ListLoading({ label }: { label?: string }) {
  return (
    <View style={s.block}>
      <ActivityIndicator color="#4FC3F7" />
      {!!label && <Text style={s.sub}>{label}</Text>}
    </View>
  )
}

export function ListEmpty({
  icon = 'sparkles-outline',
  title,
  sub,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  sub?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={s.block}>
      <View style={s.iconCircle}>
        <Ionicons name={icon} size={24} color="#4A4A5A" />
      </View>
      <Text style={s.title}>{title}</Text>
      {!!sub && <Text style={s.sub}>{sub}</Text>}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity style={s.action} onPress={onAction} activeOpacity={0.85}>
          <Text style={s.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function ListError({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <View style={s.block}>
      <View style={[s.iconCircle, s.iconCircleError]}>
        <Ionicons name="cloud-offline-outline" size={24} color="#FF5252" />
      </View>
      <Text style={s.title}>Não foi possível carregar</Text>
      <Text style={s.sub}>{message ?? 'Verifique sua conexão e tente novamente.'}</Text>
      {!!onRetry && (
        <TouchableOpacity style={s.action} onPress={onRetry} activeOpacity={0.85}>
          <Ionicons name="refresh" size={15} color="#4FC3F7" />
          <Text style={s.actionText}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  block: { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleError: { borderColor: 'rgba(255,82,82,0.25)' },
  title: { color: '#F0F0F5', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  sub: { color: '#8A8A9A', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
    backgroundColor: '#1E1E24',
  },
  actionText: { color: '#4FC3F7', fontSize: 13.5, fontWeight: '700' },
})
