import React, { useCallback, useEffect, useRef, useState } from 'react'
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
  Animated as RNAnimated,
  Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import type { TrainerProfileRecord, ProfileRecord } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>
type AthleteTab = 'desempenho' | 'historico' | 'sobre'
type TrainerTab = 'profissional' | 'sobre'

const GOAL_LABELS: Record<string, string> = {
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Força',
  FAT_LOSS: 'Perda de gordura',
  ENDURANCE: 'Resistência',
  HEALTH: 'Saúde',
  PERFORMANCE: 'Performance',
}
const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
}

// Phase 5: populated from social API
const MOCK_SOCIAL = { following: 0, followers: 0 }
// Phase 2: populated from training API
const MOCK_PERF = { weeklyVolume: 0, totalWorkouts: 0, currentStreak: 0, uniqueExercises: 0, totalPRs: 0 }

// ─── Sub-components ────────────────────────────────────────────────────

function MetricCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={{ fontSize: 36, marginBottom: 12 }}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  )
}

function DesempenhoTab() {
  return (
    <View style={s.tabContent}>
      <SectionTitle>ESTA SEMANA</SectionTitle>
      <View style={s.metricsGrid}>
        <MetricCard value={`${MOCK_PERF.weeklyVolume} kg`} label="Volume Total" />
        <MetricCard value={MOCK_PERF.totalWorkouts} label="Treinos" />
        <MetricCard value={MOCK_PERF.uniqueExercises} label="Exercícios" />
      </View>

      <SectionTitle>GERAL</SectionTitle>
      <View style={s.metricsGrid}>
        <MetricCard value={`${MOCK_PERF.currentStreak} dias`} label="Sequência" />
        <MetricCard value={MOCK_PERF.totalPRs} label="PRs" />
        <MetricCard value={MOCK_PERF.totalWorkouts} label="Total Treinos" />
      </View>

      <SectionTitle>PRs RECENTES</SectionTitle>
      <EmptyState
        icon="🏆"
        title="Nenhum PR registrado"
        sub="Complete treinos para registrar seus records pessoais"
      />
    </View>
  )
}

function HistoricoTab() {
  return (
    <View style={s.tabContent}>
      <EmptyState
        icon="📋"
        title="Sem histórico ainda"
        sub="Comece um treino para ver seu histórico aqui"
      />
    </View>
  )
}

function TrainerProfTab({ trainerProfile }: { trainerProfile: TrainerProfileRecord | null | undefined }) {
  return (
    <View style={s.tabContent}>
      <SectionTitle>BIO PROFISSIONAL</SectionTitle>
      <View style={s.infoCard}>
        <Text style={trainerProfile?.bio ? s.infoText : s.infoTextEmpty}>
          {trainerProfile?.bio ?? 'Nenhuma bio adicionada ainda.'}
        </Text>
      </View>

      <SectionTitle>STATUS</SectionTitle>
      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Text style={s.infoRowLabel}>Aceitando alunos</Text>
          <View style={[
            s.statusBadge,
            trainerProfile?.acceptingClients ? s.statusBadgeGreen : s.statusBadgeRed,
          ]}>
            <Text style={[
              s.statusBadgeText,
              trainerProfile?.acceptingClients ? s.statusBadgeTextGreen : s.statusBadgeTextRed,
            ]}>
              {trainerProfile?.acceptingClients ? 'Sim' : 'Não'}
            </Text>
          </View>
        </View>
        {!!trainerProfile?.cref && (
          <>
            <View style={s.infoDivider} />
            <View style={s.infoRow}>
              <Text style={s.infoRowLabel}>CREF</Text>
              <Text style={s.infoRowValue}>{trainerProfile.cref}</Text>
            </View>
          </>
        )}
      </View>

      {trainerProfile?.specialties && trainerProfile.specialties.length > 0 && (
        <>
          <SectionTitle>ESPECIALIDADES</SectionTitle>
          <View style={s.chipsRow}>
            {trainerProfile.specialties.map((sp) => (
              <View key={sp} style={s.chip}>
                <Text style={s.chipText}>{sp}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function SobreTab({
  profile,
  isTrainer,
  isPrivate,
  privacyLoading,
  onPrivacyToggle,
  onLogout,
}: {
  profile: ProfileRecord | null | undefined
  isTrainer: boolean
  isPrivate: boolean
  privacyLoading: boolean
  onPrivacyToggle: () => void
  onLogout: () => void
}) {
  return (
    <View style={s.tabContent}>
      {!isTrainer && (
        <>
          <SectionTitle>DADOS PESSOAIS</SectionTitle>
          <View style={s.infoCard}>
            {[
              { label: 'Peso', value: profile?.weightKg ? `${profile.weightKg} kg` : null },
              { label: 'Altura', value: profile?.heightCm ? `${profile.heightCm} cm` : null },
              { label: 'Objetivo', value: profile?.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : null },
              { label: 'Experiência', value: profile?.experience ? (EXPERIENCE_LABELS[profile.experience] ?? profile.experience) : null },
              { label: 'Dias/semana', value: profile?.daysPerWeek ? `${profile.daysPerWeek}x` : null },
              { label: 'Academia', value: profile?.gymName ?? null },
            ]
              .filter((r) => r.value !== null)
              .map((row, i, arr) => (
                <View key={row.label}>
                  <View style={s.infoRow}>
                    <Text style={s.infoRowLabel}>{row.label}</Text>
                    <Text style={s.infoRowValue}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={s.infoDivider} />}
                </View>
              ))
            }
          </View>
        </>
      )}

      <SectionTitle>CONFIGURAÇÕES</SectionTitle>
      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Text style={s.infoRowLabel}>Perfil Privado</Text>
          <Switch
            value={isPrivate}
            onValueChange={onPrivacyToggle}
            disabled={privacyLoading}
            trackColor={{ false: '#2A2A35', true: 'rgba(41,121,255,0.5)' }}
            thumbColor={isPrivate ? '#2979FF' : '#4A4A5A'}
          />
        </View>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
        <Text style={s.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Main screen ────────────────────────────────────────────────────────

export function ProfileScreen({ navigation }: Props) {
  const { user, setUser, logout } = useAuthStore()
  const profile = user?.profile
  const trainerProfile = user?.trainerProfile
  const isTrainer = user?.role === 'TRAINER'

  const [athleteTab, setAthleteTab] = useState<AthleteTab>('desempenho')
  const [trainerTab, setTrainerTab] = useState<TrainerTab>('profissional')
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const opacity = useRef(new RNAnimated.Value(0)).current

  useEffect(() => {
    RNAnimated.timing(opacity, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [])

  // Refresh user data when coming back from Edit screens
  useFocusEffect(
    useCallback(() => {
      api.auth.me()
        .then(({ data: { user: updated } }) => setUser(updated))
        .catch(() => null)
    }, [])
  )

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
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.')
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
      const { data: { user: updated } } = await api.auth.me()
      setUser(updated)
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Não foi possível enviar a foto.'))
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handlePrivacyToggle() {
    setPrivacyLoading(true)
    try {
      await api.profile.update({ isPrivate: !(profile?.isPrivate ?? false) })
      const { data: { user: updated } } = await api.auth.me()
      setUser(updated)
    } catch (err) {
      Alert.alert('Erro', getFriendlyErrorMessage(err, 'Não foi possível atualizar.'))
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
  const isPrivate = profile?.isPrivate ?? false

  const athleteTabs: { key: AthleteTab; label: string }[] = [
    { key: 'desempenho', label: 'DESEMPENHO' },
    { key: 'historico', label: 'HISTÓRICO' },
    { key: 'sobre', label: 'SOBRE' },
  ]
  const trainerTabs: { key: TrainerTab; label: string }[] = [
    { key: 'profissional', label: 'PROFISSIONAL' },
    { key: 'sobre', label: 'SOBRE' },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <RNAnimated.View style={{ flex: 1, opacity }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 56 }} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
              <Text style={s.headerBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Meu Perfil</Text>
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => navigation.navigate(isTrainer ? 'EditTrainerProfile' : 'EditAthleteProfile')}
            >
              <Text style={{ color: '#4FC3F7', fontSize: 13, fontWeight: '600' }}>Editar</Text>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={s.hero}>
            {/* Avatar — square, gradient border, cyan glow */}
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} disabled={avatarUploading}>
              <LinearGradient
                colors={['#4FC3F7', '#2979FF', '#1A237E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatarFrame}
              >
                <View style={s.avatarInner}>
                  {profile?.avatar ? (
                    <Image source={{ uri: profile.avatar }} style={s.avatarImg} />
                  ) : (
                    <Text style={s.avatarInitials}>{getInitials(displayName)}</Text>
                  )}
                </View>
              </LinearGradient>
              <View style={s.cameraOverlay}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 10 }}>📷</Text>
                }
              </View>
            </TouchableOpacity>

            {/* Info column: name + email + role badge + stats */}
            <View style={s.heroInfo}>
              <Text style={s.heroName} numberOfLines={1}>{displayName}</Text>
              <Text style={s.heroEmail} numberOfLines={1}>{user?.email}</Text>
              {isTrainer && (
                <View style={s.trainerBadge}>
                  <Text style={s.trainerBadgeText}>Personal Trainer</Text>
                </View>
              )}
              <View style={s.heroStats}>
                {!isTrainer && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatNum}>{MOCK_PERF.totalWorkouts}</Text>
                    <Text style={s.heroStatLbl}>Treinos</Text>
                  </View>
                )}
                <View style={s.heroStat}>
                  <Text style={s.heroStatNum}>{MOCK_SOCIAL.followers}</Text>
                  <Text style={s.heroStatLbl}>Seguidores</Text>
                </View>
                <View style={s.heroStat}>
                  <Text style={s.heroStatNum}>{MOCK_SOCIAL.following}</Text>
                  <Text style={s.heroStatLbl}>Seguindo</Text>
                </View>
              </View>
            </View>
          </View>

          {!!profile?.bio && (
            <Text style={s.bioText} numberOfLines={3}>{profile.bio}</Text>
          )}

          {/* Tabs */}
          <View style={s.tabBar}>
            {(isTrainer ? trainerTabs : athleteTabs).map((tab) => {
              const active = isTrainer
                ? trainerTab === (tab.key as TrainerTab)
                : athleteTab === (tab.key as AthleteTab)
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[s.tabItem, active && s.tabItemActive]}
                  onPress={() => {
                    if (isTrainer) setTrainerTab(tab.key as TrainerTab)
                    else setAthleteTab(tab.key as AthleteTab)
                  }}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Tab content */}
          {isTrainer ? (
            <>
              {trainerTab === 'profissional' && <TrainerProfTab trainerProfile={trainerProfile} />}
              {trainerTab === 'sobre' && (
                <SobreTab
                  profile={profile}
                  isTrainer={isTrainer}
                  isPrivate={isPrivate}
                  privacyLoading={privacyLoading}
                  onPrivacyToggle={handlePrivacyToggle}
                  onLogout={handleLogout}
                />
              )}
            </>
          ) : (
            <>
              {athleteTab === 'desempenho' && <DesempenhoTab />}
              {athleteTab === 'historico' && <HistoricoTab />}
              {athleteTab === 'sobre' && (
                <SobreTab
                  profile={profile}
                  isTrainer={isTrainer}
                  isPrivate={isPrivate}
                  privacyLoading={privacyLoading}
                  onPrivacyToggle={handlePrivacyToggle}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </ScrollView>
      </RNAnimated.View>
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerBtn: {
    width: 40, height: 40, backgroundColor: '#1E1E24',
    borderRadius: 12, borderWidth: 1, borderColor: '#2A2A35',
    justifyContent: 'center', alignItems: 'center',
  },
  headerBtnText: { color: '#4FC3F7', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#F0F0F5', fontSize: 17, fontWeight: '700' },

  // Hero — left-aligned avatar + info column
  hero: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 16, paddingRight: 20,
    paddingTop: 20, paddingBottom: 16,
    gap: 16,
  },
  avatarFrame: {
    width: 96, height: 96, borderRadius: 20, padding: 2.5,
    shadowColor: '#4FC3F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  avatarInner: {
    flex: 1, borderRadius: 18,
    backgroundColor: '#1E1E24',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 91, height: 91 },
  avatarInitials: { color: '#F0F0F5', fontSize: 30, fontWeight: '700' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#2979FF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#141418',
  },
  heroInfo: { flex: 1, justifyContent: 'center' },
  heroName: { color: '#F0F0F5', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  heroEmail: { color: '#8A8A9A', fontSize: 11, marginBottom: 8 },
  trainerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.12)', borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.35)', marginBottom: 8,
  },
  trainerBadgeText: { color: '#4FC3F7', fontSize: 10, fontWeight: '600' },
  heroStats: { flexDirection: 'row', gap: 18 },
  heroStat: { alignItems: 'flex-start' },
  heroStatNum: { color: '#F0F0F5', fontSize: 15, fontWeight: '700' },
  heroStatLbl: { color: '#8A8A9A', fontSize: 10 },
  bioText: {
    color: '#8A8A9A', fontSize: 13, lineHeight: 19,
    paddingHorizontal: 16, paddingBottom: 14,
  },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2A2A35', marginBottom: 4 },
  tabItem: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#2979FF' },
  tabText: { color: '#8A8A9A', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  tabTextActive: { color: '#4FC3F7' },

  // Tab content
  tabContent: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { color: '#8A8A9A', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 10, marginTop: 4 },

  // Metric cards
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: {
    flex: 1, minWidth: '30%', backgroundColor: '#1E1E24',
    borderRadius: 14, borderWidth: 1, borderColor: '#2A2A35',
    padding: 14, alignItems: 'center',
  },
  metricValue: { color: '#F0F0F5', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  metricLabel: { color: '#8A8A9A', fontSize: 11 },

  // Info card (about / trainer profile)
  infoCard: {
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  infoRowLabel: { color: '#8A8A9A', fontSize: 14 },
  infoRowValue: { color: '#F0F0F5', fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  infoText: { color: '#F0F0F5', fontSize: 14, lineHeight: 21, padding: 14 },
  infoTextEmpty: { color: '#4A4A5A', fontSize: 14, fontStyle: 'italic', padding: 14 },
  infoDivider: { height: 1, backgroundColor: '#2A2A35', marginHorizontal: 14 },

  // Status badge
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeGreen: { backgroundColor: 'rgba(0,230,118,0.12)' },
  statusBadgeRed: { backgroundColor: 'rgba(255,82,82,0.12)' },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  statusBadgeTextGreen: { color: '#00E676' },
  statusBadgeTextRed: { color: '#FF5252' },

  // Specialty chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.3)',
  },
  chipText: { color: '#4FC3F7', fontSize: 12, fontWeight: '500' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, marginBottom: 20 },
  emptyTitle: { color: '#F0F0F5', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#8A8A9A', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Logout
  logoutBtn: { marginTop: 8, marginBottom: 8, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#FF5252', fontSize: 15, fontWeight: '600' },
})
