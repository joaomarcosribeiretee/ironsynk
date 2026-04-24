import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>

const GOAL_LABELS: Record<string, string> = {
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Forca',
  FAT_LOSS: 'Perda de gordura',
  ENDURANCE: 'Resistencia',
  HEALTH: 'Saude',
  PERFORMANCE: 'Performance',
}

export function ProfileScreen({ navigation }: Props) {
  const { user, setUser, logout } = useAuthStore()
  const profile = user?.profile
  const isTrainer = user?.role === 'TRAINER'

  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const opacity = useSharedValue(0)
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 280 })
  }, [])

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('')
  }

  async function handleAvatarPress() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissao necessaria', 'Permita o acesso a galeria nas configuracoes.')
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
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

    const formData = new FormData()
    formData.append('avatar', { uri, name: `avatar.${ext}`, type: mimeType } as unknown as Blob)

    setAvatarUploading(true)
    try {
      await api.profile.uploadAvatar(formData)
      const { user: updated } = await api.auth.me()
      setUser(updated)
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Nao foi possivel enviar a foto.'))
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handlePrivacyToggle() {
    const newValue = !(profile?.isPrivate ?? false)
    setPrivacyLoading(true)
    try {
      await api.profile.update({ isPrivate: newValue })
      const { user: updated } = await api.auth.me()
      setUser(updated)
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Nao foi possivel atualizar a privacidade.'))
    } finally {
      setPrivacyLoading(false)
    }
  }

  function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ])
  }

  const displayName = profile?.name || 'Sem nome'
  const initials = getInitials(displayName)
  const isPrivate = profile?.isPrivate ?? false

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Meu Perfil</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar + name */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} disabled={avatarUploading}>
              {/* Gradient ring */}
              <LinearGradient
                colors={['#4FC3F7', '#2979FF', '#1A237E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatarInner}>
                  {profile?.avatar ? (
                    <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </View>
              </LinearGradient>
              {/* Camera overlay */}
              <View style={styles.cameraOverlay}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.cameraIcon}>📷</Text>
                )}
              </View>
            </TouchableOpacity>

            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>

            {isTrainer && (
              <View style={styles.trainerBadge}>
                <Text style={styles.trainerBadgeText}>Personal Trainer</Text>
              </View>
            )}
          </View>

          {/* Stats — athletes only */}
          {!isTrainer && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>ESTATISTICAS</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {profile?.weightKg ? `${profile.weightKg}` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Peso (kg)</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {profile?.heightCm ? `${profile.heightCm}` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Altura (cm)</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                    {profile?.goal ? GOAL_LABELS[profile.goal] ?? profile.goal : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Objetivo</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bio */}
          {!!profile?.bio && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>BIO</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          )}

          {/* Settings */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CONFIGURACOES</Text>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => Alert.alert('Em breve', 'Edicao de perfil chegara na proxima versao.')}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsRowLabel}>Editar Perfil</Text>
              <Text style={styles.settingsRowChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRow}>
              <Text style={styles.settingsRowLabel}>Perfil Privado</Text>
              <Switch
                value={isPrivate}
                onValueChange={handlePrivacyToggle}
                disabled={privacyLoading}
                trackColor={{ false: '#2A2A35', true: 'rgba(41,121,255,0.5)' }}
                thumbColor={isPrivate ? '#2979FF' : '#4A4A5A'}
              />
            </View>
          </View>

          {/* Sign out — text only */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
            <Text style={styles.signOutText}>Sair da conta</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141418',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    color: '#4FC3F7',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#F0F0F5',
    fontSize: 17,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarInitials: {
    color: '#F0F0F5',
    fontSize: 40,
    fontWeight: '700',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2979FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#141418',
  },
  cameraIcon: {
    fontSize: 14,
  },
  displayName: {
    color: '#F0F0F5',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  emailText: {
    color: '#8A8A9A',
    fontSize: 13,
    marginBottom: 10,
  },
  trainerBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.4)',
    marginTop: 2,
  },
  trainerBadgeText: {
    color: '#4FC3F7',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#8A8A9A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#F0F0F5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  statLabel: {
    color: '#8A8A9A',
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#2A2A35',
  },
  bioText: {
    color: '#F0F0F5',
    fontSize: 14,
    lineHeight: 21,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingsRowLabel: {
    color: '#F0F0F5',
    fontSize: 15,
  },
  settingsRowChevron: {
    color: '#8A8A9A',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#2A2A35',
    marginVertical: 12,
  },
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF5252',
    fontSize: 15,
    fontWeight: '600',
  },
})
