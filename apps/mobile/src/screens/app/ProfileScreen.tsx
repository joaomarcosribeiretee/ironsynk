import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Alert, Switch, Image,
  StyleSheet, Animated as RNAnimated, Easing,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import type { TrainerProfileRecord, ProfileRecord } from '../../lib/api'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'

type AthleteTab = 'historico' | 'desempenho' | 'programa' | 'sobre'
type TrainerTab = 'alunos' | 'consultas' | 'sobre'

const GOAL_LABELS: Record<string, string> = {
  HYPERTROPHY: 'Hipertrofia', STRENGTH: 'Força', FAT_LOSS: 'Perda de gordura',
  ENDURANCE: 'Resistência', HEALTH: 'Saúde', PERFORMANCE: 'Performance',
}
const SEX_LABELS: Record<string, string> = {
  male: 'Masculino', female: 'Feminino', other: 'Outro',
}

// Phase 5 — social data
const MOCK_SOCIAL = { following: 0, followers: 0 }
// Phase 2 — training data
const MOCK_WORKOUTS = 0

// ─── Shared primitives ─────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={{ fontSize: 34, marginBottom: 10 }}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {!!sub && <Text style={s.emptySub}>{sub}</Text>}
    </View>
  )
}

function InfoCard({ rows }: {
  rows: { label: string; value: string | null | undefined }[]
}) {
  const filtered = rows.filter((r) => r.value != null && r.value !== '')
  if (!filtered.length) return null
  return (
    <View style={s.infoCard}>
      {filtered.map((row, i) => (
        <View key={row.label}>
          <View style={s.infoRow}>
            <Text style={s.infoRowLabel}>{row.label}</Text>
            <Text style={s.infoRowValue}>{row.value}</Text>
          </View>
          {i < filtered.length - 1 && <View style={s.infoDivider} />}
        </View>
      ))}
    </View>
  )
}

// ─── Athlete tab: Histórico ─────────────────────────────────────────────

function HistoricoTab() {
  return (
    <View style={s.tabContent}>
      <EmptyState
        icon="📋"
        title="Nenhum treino registrado"
        sub="Complete seu primeiro treino para ver o histórico aqui"
      />
    </View>
  )
}

// ─── Athlete tab: Desempenho ────────────────────────────────────────────

// 8 weeks placeholder — Phase 2 will supply real data
const WEEKLY_WORKOUTS = [0, 0, 0, 0, 0, 0, 0, 0]
const WEEK_LABELS = ['S8', 'S7', 'S6', 'S5', 'S4', 'S3', 'S2', 'S1']
const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas',
]

function DesempenhoTab() {
  const maxWeekly = Math.max(...WEEKLY_WORKOUTS, 1)

  return (
    <ScrollView style={s.tabContent} scrollEnabled={false}>
      {/* Frequência */}
      <SectionTitle>FREQUÊNCIA — ÚLTIMAS 8 SEMANAS</SectionTitle>
      <View style={s.chartCard}>
        <View style={s.freqChart}>
          {WEEKLY_WORKOUTS.map((val, i) => (
            <View key={i} style={s.freqBarSlot}>
              <View style={s.freqBarBg}>
                <View style={[s.freqBarFill, { height: Math.max((val / maxWeekly) * 52, 2) }]} />
              </View>
              <Text style={s.freqBarLbl}>{WEEK_LABELS[i]}</Text>
            </View>
          ))}
        </View>
        <View style={s.freqPills}>
          <View style={s.pill}>
            <Text style={s.pillNum}>{MOCK_WORKOUTS}</Text>
            <Text style={s.pillLbl}>treinos este mês</Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillNum}>0 dias</Text>
            <Text style={s.pillLbl}>sequência atual</Text>
          </View>
        </View>
      </View>

      {/* Records pessoais */}
      <SectionTitle>RECORDS PESSOAIS</SectionTitle>
      <View style={s.infoCard}>
        <EmptyState icon="🏆" title="Nenhum record ainda" />
      </View>

      {/* Volume por grupamento */}
      <SectionTitle>VOLUME POR GRUPAMENTO — 4 SEMANAS</SectionTitle>
      <View style={s.infoCard}>
        {MUSCLE_GROUPS.map((mg) => (
          <View key={mg} style={s.muscleRow}>
            <Text style={s.muscleName}>{mg}</Text>
            <View style={s.muscleBarBg}>
              <LinearGradient
                colors={['#4FC3F7', '#2979FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.muscleBarFill, { flex: 0.01 }]}
              />
            </View>
            <Text style={s.muscleSets}>0</Text>
          </View>
        ))}
      </View>

      {/* Evolução de Carga */}
      <SectionTitle>EVOLUÇÃO DE CARGA</SectionTitle>
      <View style={s.infoCard}>
        <EmptyState
          icon="📈"
          title="Sem dados suficientes"
          sub="Complete ao menos 3 sessões com o mesmo exercício para ver a evolução de carga"
        />
      </View>

      {/* Aderência à Dieta */}
      <SectionTitle>ADERÊNCIA À DIETA</SectionTitle>
      <View style={[s.infoCard, s.adherenceCard]}>
        <View style={s.adherenceRing}>
          <Text style={s.adherencePct}>0%</Text>
        </View>
        <Text style={s.adherenceLbl}>refeições concluídas esta semana</Text>
      </View>
    </ScrollView>
  )
}

// ─── Athlete tab: Programa ──────────────────────────────────────────────

function ProgramaTab() {
  return (
    <View style={s.tabContent}>
      <SectionTitle>PROGRAMA DE TREINO</SectionTitle>
      <View style={[s.infoCard, s.emptyCard]}>
        <EmptyState
          icon="🏋️"
          title="Nenhum programa ativo"
          sub="Crie ou receba um programa de treino"
        />
      </View>

      <SectionTitle>DIETA ATIVA</SectionTitle>
      <View style={[s.infoCard, s.emptyCard]}>
        <EmptyState
          icon="🥗"
          title="Nenhuma dieta ativa"
          sub="Crie ou receba um plano nutricional"
        />
      </View>
    </View>
  )
}

// ─── Athlete tab: Sobre ─────────────────────────────────────────────────

function AthleteSobreTab({
  profile, onEdit,
}: {
  profile: ProfileRecord | null | undefined
  onEdit: () => void
}) {
  const birthFormatted = profile?.birthDate
    ? new Date(profile.birthDate).toLocaleDateString('pt-BR')
    : null

  return (
    <View style={s.tabContent}>
      <View style={s.sobreHeader}>
        <SectionTitle>DADOS PESSOAIS</SectionTitle>
        <TouchableOpacity onPress={onEdit}>
          <Text style={s.editLink}>Editar perfil</Text>
        </TouchableOpacity>
      </View>
      <InfoCard rows={[
        { label: 'Nome completo', value: profile?.name },
        { label: 'Data de nascimento', value: birthFormatted },
        { label: 'Sexo', value: profile?.sex ? (SEX_LABELS[profile.sex] ?? profile.sex) : null },
        { label: 'Peso', value: profile?.weightKg ? `${profile.weightKg} kg` : null },
        { label: 'Altura', value: profile?.heightCm ? `${profile.heightCm} cm` : null },
        { label: 'Objetivo', value: profile?.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : null },
        { label: 'Dias/semana', value: profile?.daysPerWeek ? `${profile.daysPerWeek}x` : null },
        { label: 'Academia', value: profile?.gymName },
      ]} />
      {!!profile?.bio && (
        <>
          <SectionTitle>BIO</SectionTitle>
          <View style={s.infoCard}>
            <Text style={s.infoText}>{profile.bio}</Text>
          </View>
        </>
      )}
    </View>
  )
}

// ─── Trainer tab: Alunos ────────────────────────────────────────────────

function AlunosTab() {
  return (
    <View style={s.tabContent}>
      <Text style={s.countLbl}>0 alunos ativos</Text>
      <EmptyState
        icon="👥"
        title="Nenhum aluno vinculado ainda"
        sub="Alunos aparecerão aqui após o vínculo de consultoria"
      />
    </View>
  )
}

// ─── Trainer tab: Consultas ─────────────────────────────────────────────

function ConsultasTab({ onCreateForm }: { onCreateForm: () => void }) {
  return (
    <View style={s.tabContent}>
      <EmptyState
        icon="📝"
        title="Nenhuma consulta criada ainda"
        sub="Crie formulários de avaliação para seus alunos"
      />
      <TouchableOpacity style={s.createBtn} onPress={onCreateForm}>
        <Text style={s.createBtnText}>+ Criar formulário</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Trainer tab: Sobre ─────────────────────────────────────────────────

function TrainerSobreTab({
  profile, trainerProfile, onEdit,
}: {
  profile: ProfileRecord | null | undefined
  trainerProfile: TrainerProfileRecord | null | undefined
  onEdit: () => void
}) {
  return (
    <View style={s.tabContent}>
      <View style={s.sobreHeader}>
        <SectionTitle>PERFIL PROFISSIONAL</SectionTitle>
        <TouchableOpacity onPress={onEdit}>
          <Text style={s.editLink}>Editar perfil</Text>
        </TouchableOpacity>
      </View>

      <View style={s.infoCard}>
        <Text style={trainerProfile?.bio ? s.infoText : s.infoTextEmpty}>
          {trainerProfile?.bio ?? 'Nenhuma bio profissional adicionada.'}
        </Text>
      </View>

      <InfoCard rows={[
        { label: 'Nome', value: profile?.name },
        { label: 'CREF', value: trainerProfile?.cref },
        { label: 'Academia', value: profile?.gymName },
      ]} />

      <SectionTitle>STATUS</SectionTitle>
      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Text style={s.infoRowLabel}>Aceitando alunos</Text>
          <View style={[s.badge, trainerProfile?.acceptingClients ? s.badgeGreen : s.badgeRed]}>
            <Text style={[s.badgeText, trainerProfile?.acceptingClients ? s.badgeTextGreen : s.badgeTextRed]}>
              {trainerProfile?.acceptingClients ? 'Sim' : 'Não'}
            </Text>
          </View>
        </View>
      </View>

      {trainerProfile?.specialties && trainerProfile.specialties.length > 0 && (
        <>
          <SectionTitle>ESPECIALIDADES</SectionTitle>
          <View style={s.chips}>
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

// ─── Main screen ────────────────────────────────────────────────────────

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const insets = useSafeAreaInsets()
  const { user, setUser, logout } = useAuthStore()
  const profile = user?.profile
  const trainerProfile = user?.trainerProfile
  const isTrainer = user?.role === 'TRAINER'

  const [athleteTab, setAthleteTab] = useState<AthleteTab>('historico')
  const [trainerTab, setTrainerTab] = useState<TrainerTab>('alunos')
  const [privacyLoading, setPrivacyLoading] = useState(false)

  const opacity = useRef(new RNAnimated.Value(0)).current
  useEffect(() => {
    RNAnimated.timing(opacity, {
      toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start()
  }, [])

  useFocusEffect(
    useCallback(() => {
      api.auth.me()
        .then(({ data: { user: u } }) => setUser(u))
        .catch(() => null)
    }, [])
  )

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
  }

  async function handlePrivacyToggle() {
    setPrivacyLoading(true)
    try {
      await api.profile.update({ isPrivate: !(profile?.isPrivate ?? false) })
      const { data: { user: u } } = await api.auth.me()
      setUser(u)
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

  function navigateToEdit() {
    navigation.navigate(isTrainer ? 'EditTrainerProfile' : 'EditAthleteProfile')
  }

  const displayName = profile?.name || 'Sem nome'
  const isPrivate = profile?.isPrivate ?? false

  const athleteTabs: { key: AthleteTab; label: string }[] = [
    { key: 'historico', label: 'HISTÓRICO' },
    { key: 'desempenho', label: 'DESEMPENHO' },
    { key: 'programa', label: 'PROGRAMA' },
    { key: 'sobre', label: 'SOBRE' },
  ]
  const trainerTabs: { key: TrainerTab; label: string }[] = [
    { key: 'alunos', label: 'ALUNOS' },
    { key: 'consultas', label: 'CONSULTAS' },
    { key: 'sobre', label: 'SOBRE' },
  ]
  const tabs = isTrainer ? trainerTabs : athleteTabs
  const activeTab = isTrainer ? trainerTab : athleteTab

  return (
    <SafeAreaView style={s.safe}>
      <RNAnimated.View style={{ flex: 1, opacity }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 56 }} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Perfil</Text>
            <TouchableOpacity style={s.headerEditBtn} onPress={navigateToEdit}>
              <Text style={s.headerEditTxt}>Editar</Text>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={s.hero}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={navigateToEdit}
              style={{ marginLeft: -insets.left }}
            >
              <View style={s.avatarFrame}>
                {profile?.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={s.avatarImg} resizeMode="cover" />
                ) : (
                  <View style={s.avatarInner}>
                    <Text style={s.avatarInitials}>{getInitials(displayName)}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View style={s.heroInfo}>
              <View style={s.heroNameRow}>
                <Text style={s.heroName} numberOfLines={1}>{displayName}</Text>
                {isTrainer && (
                  <View style={s.trainerBadge}>
                    <Text style={s.trainerBadgeText}>Personal Trainer</Text>
                  </View>
                )}
              </View>
              <Text style={s.heroHandle} numberOfLines={1}>@{user?.email?.split('@')[0]}</Text>
              <View style={s.heroAccent} />
              <View style={s.heroStats}>
                {!isTrainer && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatNum}>{MOCK_WORKOUTS}</Text>
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

          {/* Tab bar */}
          <View style={s.tabBar}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key
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
              {trainerTab === 'alunos' && <AlunosTab />}
              {trainerTab === 'consultas' && (
                <ConsultasTab onCreateForm={() => Alert.alert('Em breve', 'Criação de formulários disponível na fase de consultoria.')} />
              )}
              {trainerTab === 'sobre' && (
                <TrainerSobreTab
                  profile={profile}
                  trainerProfile={trainerProfile}
                  onEdit={navigateToEdit}
                />
              )}
            </>
          ) : (
            <>
              {athleteTab === 'historico' && <HistoricoTab />}
              {athleteTab === 'desempenho' && <DesempenhoTab />}
              {athleteTab === 'programa' && <ProgramaTab />}
              {athleteTab === 'sobre' && (
                <AthleteSobreTab
                  profile={profile}
                  onEdit={navigateToEdit}
                />
              )}
            </>
          )}
          {/* Settings — always visible below tabs */}
          <View style={s.settingsWrap}>
            <SectionTitle>CONFIGURAÇÕES</SectionTitle>
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <Text style={s.infoRowLabel}>Perfil Privado</Text>
                <Switch
                  value={isPrivate}
                  onValueChange={handlePrivacyToggle}
                  disabled={privacyLoading}
                  trackColor={{ false: '#2A2A35', true: 'rgba(41,121,255,0.5)' }}
                  thumbColor={isPrivate ? '#2979FF' : '#4A4A5A'}
                />
              </View>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutText}>Sair da conta</Text>
            </TouchableOpacity>
          </View>

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { color: '#F0F0F5', fontSize: 22, fontWeight: '500' },
  headerEditBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#1E1E24', borderRadius: 10,
    borderWidth: 1, borderColor: '#2A2A35',
  },
  headerEditTxt: { color: '#4FC3F7', fontSize: 13, fontWeight: '600' },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 0, paddingRight: 20, paddingTop: 20, paddingBottom: 16, gap: 18,
  },
  avatarFrame: {
    width: 104, height: 96,
    backgroundColor: '#1E1E24',
    borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
    borderTopRightRadius: 22, borderBottomRightRadius: 22,
    overflow: 'hidden',
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: '#2A2A35',
  },
  avatarInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { color: '#F0F0F5', fontSize: 30, fontWeight: '700' },
  heroInfo: { flex: 1, justifyContent: 'center', paddingLeft: 2 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heroName: { color: '#F0F0F5', fontSize: 19, fontWeight: '700', flexShrink: 1 },
  heroHandle: { color: '#8A8A9A', fontSize: 12, marginBottom: 8 },
  heroAccent: { width: 30, height: 2, borderRadius: 999, backgroundColor: 'rgba(79,195,247,0.65)', marginBottom: 6 },
  trainerBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.12)', borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.35)', marginBottom: 8,
  },
  trainerBadgeText: { color: '#4FC3F7', fontSize: 10, fontWeight: '600' },
  heroStats: { flexDirection: 'row', gap: 28 },
  heroStat: { alignItems: 'flex-start' },
  heroStatNum: { color: '#F0F0F5', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  heroStatLbl: { color: '#8A8A9A', fontSize: 11 },
  bioText: { color: '#8A8A9A', fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 14 },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2A2A35', marginBottom: 4 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#2979FF' },
  tabText: { color: '#8A8A9A', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  tabTextActive: { color: '#4FC3F7' },

  // Tab content
  tabContent: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { color: '#8A8A9A', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 10, marginTop: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 36 },
  emptyTitle: { color: '#F0F0F5', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#8A8A9A', fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  // Info card
  infoCard: {
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', marginBottom: 4,
  },
  emptyCard: { marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  infoRowLabel: { color: '#8A8A9A', fontSize: 14 },
  infoRowValue: { color: '#F0F0F5', fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  infoText: { color: '#F0F0F5', fontSize: 14, lineHeight: 21, padding: 14 },
  infoTextEmpty: { color: '#4A4A5A', fontSize: 14, fontStyle: 'italic', padding: 14 },
  infoDivider: { height: 1, backgroundColor: '#2A2A35', marginHorizontal: 14 },

  // Sobre
  sobreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  editLink: { color: '#4FC3F7', fontSize: 13, fontWeight: '600' },
  countLbl: { color: '#8A8A9A', fontSize: 13, marginBottom: 4 },

  // Badges
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeGreen: { backgroundColor: 'rgba(0,230,118,0.12)' },
  badgeRed: { backgroundColor: 'rgba(255,82,82,0.12)' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextGreen: { color: '#00E676' },
  badgeTextRed: { color: '#FF5252' },

  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(41,121,255,0.1)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.3)',
  },
  chipText: { color: '#4FC3F7', fontSize: 12, fontWeight: '500' },

  // Create button
  createBtn: {
    marginTop: 16, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#2979FF',
    alignItems: 'center',
  },
  createBtnText: { color: '#4FC3F7', fontSize: 14, fontWeight: '600' },

  // Settings section
  settingsWrap: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },

  // Logout
  logoutBtn: { marginTop: 16, marginBottom: 8, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#FF5252', fontSize: 15, fontWeight: '600' },

  // Frequency chart
  chartCard: {
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35',
    padding: 16, marginBottom: 4,
  },
  freqChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 12 },
  freqBarSlot: { flex: 1, alignItems: 'center', gap: 4 },
  freqBarBg: { width: '100%', height: 60, backgroundColor: '#2A2A35', borderRadius: 6, justifyContent: 'flex-end' },
  freqBarFill: { width: '100%', backgroundColor: '#2979FF', borderRadius: 6 },
  freqBarLbl: { color: '#8A8A9A', fontSize: 9 },
  freqPills: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1, backgroundColor: '#141418', borderRadius: 10, padding: 10, alignItems: 'center',
  },
  pillNum: { color: '#F0F0F5', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  pillLbl: { color: '#8A8A9A', fontSize: 10, textAlign: 'center' },

  // Muscle volume bars
  muscleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  muscleName: { color: '#8A8A9A', fontSize: 13, width: 68 },
  muscleBarBg: { flex: 1, height: 6, backgroundColor: '#2A2A35', borderRadius: 3, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 3 },
  muscleSets: { color: '#F0F0F5', fontSize: 12, fontWeight: '600', width: 24, textAlign: 'right' },

  // Diet adherence
  adherenceCard: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 20 },
  adherenceRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#2A2A35',
    justifyContent: 'center', alignItems: 'center',
  },
  adherencePct: { color: '#F0F0F5', fontSize: 14, fontWeight: '700' },
  adherenceLbl: { flex: 1, color: '#8A8A9A', fontSize: 13, lineHeight: 18 },
})
