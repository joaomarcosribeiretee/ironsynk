import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Alert, Image,
  StyleSheet, Animated as RNAnimated, Easing, ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import type { TrainerProfileRecord, ProfileRecord, ProgramRecord, TrainingGoal, NutritionPlanRecord, DailyTotals } from '../../lib/api'
import { WorkoutPostCard } from '../../components/WorkoutPostCard'
import { PerformanceDashboard } from '../../components/PerformanceDashboard'

type AthleteTab = 'historico' | 'desempenho' | 'programa' | 'sobre'
type TrainerTab = 'alunos' | 'consultas' | 'sobre'

const GOAL_LABELS: Record<string, string> = {
  HYPERTROPHY: 'Hipertrofia', STRENGTH: 'Força', FAT_LOSS: 'Perda de gordura',
  ENDURANCE: 'Resistência', HEALTH: 'Saúde', PERFORMANCE: 'Performance',
}
const PROGRAM_GOAL_LABELS: Record<string, string> = {
  HYPERTROPHY: 'Hipertrofia', STRENGTH: 'Força', FAT_LOSS: 'Emagrecimento',
  ENDURANCE: 'Resistência', HEALTH: 'Saúde', PERFORMANCE: 'Performance',
}
const DIET_GOAL_LABELS: Record<string, string> = {
  BULK: 'Ganho de massa', CUT: 'Definição', MAINTENANCE: 'Manutenção',
  RECOMP: 'Recomposição', HEALTH: 'Saúde',
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
      <Ionicons name={icon as any} size={34} color="#4FC3F7" style={{ marginBottom: 10 }} />
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-workout-posts'],
    queryFn: () => api.posts.listMine(),
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  const posts = data?.data.posts ?? []

  if (isLoading) {
    return (
      <View style={[s.tabContent, { paddingVertical: 36, alignItems: 'center' }]}>
        <ActivityIndicator color="#4FC3F7" />
      </View>
    )
  }

  if (posts.length === 0) {
    return (
      <View style={s.tabContent}>
        <EmptyState
          icon="calendar-outline"
          title="Nenhum treino registrado"
          sub="Complete seu primeiro treino para ver o histórico aqui"
        />
      </View>
    )
  }

  return (
    <View style={s.tabContent}>
      {posts.map((post) => <WorkoutPostCard key={post.id} post={post} />)}
    </View>
  )
}

// ─── Athlete tab: Desempenho ────────────────────────────────────────────

function DesempenhoTab() {
  return <PerformanceDashboard />
}

// ─── Athlete tab: Programa ──────────────────────────────────────────────

function formatProgramDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function ProgramSummaryCard({
  program, onPress,
}: {
  program: ProgramRecord
  onPress: () => void
}) {
  const visibleGoals = (program.goals ?? []).slice(0, 3)
  return (
    <TouchableOpacity style={s.programCard} onPress={onPress} activeOpacity={0.7}>
      <View style={s.programCardTop}>
        <Text style={s.programCardName} numberOfLines={1}>{program.name}</Text>
        <Ionicons name="chevron-forward" size={18} color="#555560" />
      </View>
      {visibleGoals.length > 0 && (
        <View style={s.programPillsRow}>
          {visibleGoals.map((g) => (
            <View key={g} style={s.programPill}>
              <Text style={s.programPillText}>{PROGRAM_GOAL_LABELS[g] ?? g}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.programMetaRow}>
        <View style={s.programMeta}>
          <Ionicons name="barbell-outline" size={13} color="#8A8A9A" />
          <Text style={s.programMetaText}>
            {program.workoutsCount} {program.workoutsCount === 1 ? 'treino' : 'treinos'}
          </Text>
        </View>
        <View style={s.programMeta}>
          <Ionicons name="time-outline" size={13} color="#8A8A9A" />
          <Text style={s.programMetaText}>{formatProgramDate(program.updatedAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Athlete tab: Dieta ativa ───────────────────────────────────────────

function DietaAtivaCard({
  plan, totals, onPress,
}: {
  plan: NutritionPlanRecord
  totals: DailyTotals
  onPress: () => void
}) {
  const goalLabel = plan.goal ? (DIET_GOAL_LABELS[plan.goal] ?? plan.goal) : null
  const mealsCount = totals.totalMeals
  const hasMacros =
    plan.targetCalories != null ||
    plan.targetProteinG != null ||
    plan.targetCarbsG != null ||
    plan.targetFatG != null
  const fmt = (n: number | null) => (n != null ? Math.round(n) : null)

  return (
    <TouchableOpacity style={s.programCard} onPress={onPress} activeOpacity={0.7}>
      <View style={s.programCardTop}>
        <Text style={s.programCardName} numberOfLines={1}>{plan.name}</Text>
        <Ionicons name="chevron-forward" size={18} color="#555560" />
      </View>

      {!!goalLabel && (
        <View style={s.programPillsRow}>
          <View style={s.programPill}>
            <Text style={s.programPillText}>{goalLabel}</Text>
          </View>
        </View>
      )}

      <View style={s.programMetaRow}>
        <View style={s.programMeta}>
          <Ionicons name="restaurant-outline" size={13} color="#8A8A9A" />
          <Text style={s.programMetaText}>
            {mealsCount} {mealsCount === 1 ? 'refeição' : 'refeições'}
          </Text>
        </View>
        {plan.targetCalories != null && (
          <View style={s.programMeta}>
            <Ionicons name="flame-outline" size={13} color="#8A8A9A" />
            <Text style={s.programMetaText}>{fmt(plan.targetCalories)} kcal</Text>
          </View>
        )}
      </View>

      {hasMacros && (
        <View style={s.macroRow}>
          <View style={s.macroItem}>
            <Text style={s.macroValue}>{fmt(plan.targetProteinG) ?? '—'}{plan.targetProteinG != null ? 'g' : ''}</Text>
            <Text style={s.macroLabel}>Proteína</Text>
          </View>
          <View style={s.macroDivider} />
          <View style={s.macroItem}>
            <Text style={s.macroValue}>{fmt(plan.targetCarbsG) ?? '—'}{plan.targetCarbsG != null ? 'g' : ''}</Text>
            <Text style={s.macroLabel}>Carbo</Text>
          </View>
          <View style={s.macroDivider} />
          <View style={s.macroItem}>
            <Text style={s.macroValue}>{fmt(plan.targetFatG) ?? '—'}{plan.targetFatG != null ? 'g' : ''}</Text>
            <Text style={s.macroLabel}>Gordura</Text>
          </View>
        </View>
      )}

      {mealsCount > 0 && (
        <View style={s.adherenceRow}>
          <Ionicons name="checkmark-circle-outline" size={13} color="#00E676" />
          <Text style={s.adherenceText}>
            {totals.completedMeals}/{mealsCount} refeições hoje · {totals.adherencePercent}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function DietaAtivaSection() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['nutrition-today'],
    queryFn: () => api.nutrition.today(),
    staleTime: 15_000,
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  const plan = data?.data.plan ?? null
  const totals = data?.data.totals

  return (
    <>
      <SectionTitle>DIETA ATIVA</SectionTitle>
      {isLoading ? (
        <View style={[s.infoCard, s.emptyCard, { paddingVertical: 28, alignItems: 'center' }]}>
          <ActivityIndicator color="#4FC3F7" />
        </View>
      ) : plan && totals ? (
        <DietaAtivaCard
          plan={plan}
          totals={totals}
          onPress={() => navigation.navigate('NutritionToday')}
        />
      ) : (
        <View style={[s.infoCard, s.emptyCard]}>
          <EmptyState
            icon="nutrition-outline"
            title="Nenhuma dieta ativa"
            sub="Crie ou receba um plano nutricional"
          />
        </View>
      )}
    </>
  )
}

// ─── Athlete tab: Programa ──────────────────────────────────────────────

function ProgramaTab() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.programs.list(),
    staleTime: 30_000,
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  const programs = data?.data.programs ?? []

  function openProgram(program: ProgramRecord) {
    navigation.navigate('ProgramDetail', {
      programId: program.id,
      programName: program.name,
      goals: (program.goals ?? []) as TrainingGoal[],
      workoutsCount: program.workoutsCount,
      updatedAt: program.updatedAt,
    })
  }

  return (
    <View style={s.tabContent}>
      <SectionTitle>PROGRAMAS DE TREINO</SectionTitle>
      {isLoading ? (
        <View style={[s.infoCard, s.emptyCard, { paddingVertical: 28, alignItems: 'center' }]}>
          <ActivityIndicator color="#4FC3F7" />
        </View>
      ) : programs.length > 0 ? (
        <View style={{ gap: 10 }}>
          {programs.map((program) => (
            <ProgramSummaryCard
              key={program.id}
              program={program}
              onPress={() => openProgram(program)}
            />
          ))}
        </View>
      ) : (
        <View style={[s.infoCard, s.emptyCard]}>
          <EmptyState
            icon="barbell-outline"
            title="Nenhum programa ativo"
            sub="Crie ou receba um programa de treino"
          />
        </View>
      )}

      <DietaAtivaSection />
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
        icon="people-outline"
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
        icon="document-text-outline"
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
  const { user, setUser } = useAuthStore()
  const profile = user?.profile
  const trainerProfile = user?.trainerProfile
  const isTrainer = user?.role === 'TRAINER'

  const [athleteTab, setAthleteTab] = useState<AthleteTab>('historico')
  const [trainerTab, setTrainerTab] = useState<TrainerTab>('alunos')

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

  function navigateToEdit() {
    navigation.navigate(isTrainer ? 'EditTrainerProfile' : 'EditAthleteProfile')
  }

  const displayName = profile?.name || 'Sem nome'

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
            <View style={s.headerActions}>
              <TouchableOpacity style={s.headerIconBtn} onPress={navigateToEdit}>
                <FontAwesome6 name="pencil" size={18} color="#F0F0F5" />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerIconBtn} onPress={() => navigation.navigate('Settings')}>
                <Ionicons name="settings-outline" size={20} color="#F0F0F5" />
              </TouchableOpacity>
            </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },

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

  // Program summary card
  programCard: {
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', padding: 14,
  },
  programCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  programCardName: { color: '#F0F0F5', fontSize: 16, fontWeight: '600', flex: 1, minWidth: 0 },
  programPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  programPill: {
    backgroundColor: 'rgba(41,121,255,0.08)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.2)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
  },
  programPillText: { color: 'rgba(79,195,247,0.85)', fontSize: 11 },
  programMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  programMetaText: { color: '#8A8A9A', fontSize: 12 },

  // Diet macros
  macroRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(41,121,255,0.06)', borderRadius: 10,
    paddingVertical: 10, marginTop: 12,
  },
  macroItem: { flex: 1, alignItems: 'center' },
  macroValue: { color: '#F0F0F5', fontSize: 14, fontWeight: '600' },
  macroLabel: { color: '#8A8A9A', fontSize: 10, marginTop: 2 },
  macroDivider: { width: 1, height: 22, backgroundColor: '#2A2A35' },
  adherenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  adherenceText: { color: '#8A8A9A', fontSize: 12 },
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
})
