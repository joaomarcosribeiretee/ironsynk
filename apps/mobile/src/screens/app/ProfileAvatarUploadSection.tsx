import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

type Props = { nameForInitials: string }

export function ProfileAvatarUploadSection({ nameForInitials }: Props) {
  const { user, setUser } = useAuthStore()
  const profile = user?.profile
  const storedUri = profile?.avatar ?? null

  const [localUri, setLocalUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Show local pick immediately; fall back to stored URL
  const displayUri = localUri ?? storedUri

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permissão', 'Precisamos acessar suas fotos para alterar o avatar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    const uri = asset.uri
    const mimeType =
      asset.mimeType ??
      (uri.toLowerCase().endsWith('.png') ? 'image/png'
        : uri.toLowerCase().endsWith('.webp') ? 'image/webp'
        : 'image/jpeg')

    const ext =
      mimeType === 'image/png' ? 'png'
        : mimeType === 'image/webp' ? 'webp'
        : 'jpg'

    // Optimistic: show local image instantly
    setLocalUri(uri)
    setUploading(true)

    try {
      const form = new FormData()
      form.append('avatar', { uri, name: `avatar.${ext}`, type: mimeType } as unknown as Blob)
      await api.profile.uploadAvatar(form)
      const { data: { user: updated } } = await api.auth.me()
      setUser(updated)
      setLocalUri(null) // let stored URL take over
    } catch (err) {
      setLocalUri(null) // revert to old photo
      Alert.alert('Falha ao atualizar foto', getFriendlyErrorMessage(err, 'Tente novamente.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={pickAndUpload}
      disabled={uploading}
      activeOpacity={0.85}
    >
      <View style={[s.avatarOuter, uploading && s.avatarUploading]}>
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={s.avatarImg} resizeMode="cover" />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.initials}>{initialsFromName(nameForInitials)}</Text>
          </View>
        )}
        {uploading && (
          <View style={s.spinnerOverlay}>
            <ActivityIndicator size="small" color="#4FC3F7" />
          </View>
        )}
      </View>
      <Text style={s.changeText}>Alterar foto</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20 },
  avatarOuter: {
    width: 88, height: 88, borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1E1E24',
    borderWidth: 2, borderColor: '#2A2A35',
    marginBottom: 10,
  },
  avatarUploading: { borderColor: '#4FC3F7' },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1E1E24',
  },
  initials: { color: '#F0F0F5', fontSize: 28, fontWeight: '700' },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,24,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  changeText: { color: '#4FC3F7', fontSize: 14, fontWeight: '600' },
})
