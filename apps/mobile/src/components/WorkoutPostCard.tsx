import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { WorkoutPostRecord, ExecutionExerciseRecord } from '../lib/api'
import type { AppStackParamList } from '../navigation/AppNavigator'
import { PostMediaCarousel } from './PostMediaCarousel'

type NavProp = NativeStackNavigationProp<AppStackParamList>

// Gold PR visual language — shared with the execution screen's PRBadge. Reserved
// for personal records so they read as achievements, never status badges.
const GOLD = '#FFC14A'

const MAX_PREVIEW_EXERCISES = 3

const TECHNIQUE_LABELS: Record<string, string> = {
  DROP_SET: 'Drop Set',
  BACK_OFF: 'Back-off',
  REST_PAUSE: 'Rest-Pause',
  CLUSTER_SET: 'Cluster Set',
  MUSCLE_ROUND: 'Muscle Round',
  MYOREP: 'MyoRep',
}

function formatDuration(min: number | null) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${min}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatVolume(v: number | null) {
  if (v == null || v <= 0) return '—'
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('pt-BR', { month: 'short' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} às ${time}`
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

// ─── Stat ────────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={cs.stat}>
      <Text style={cs.statValue}>{value}</Text>
      <Text style={cs.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Exercise preview row ──────────────────────────────────────────────────────

function ExercisePreviewRow({ exercise }: { exercise: ExecutionExerciseRecord }) {
  const checkedSets = exercise.sets.filter(s => s.isChecked && s.setType === 'WORKING')
  if (checkedSets.length === 0) return null
  const maxWeight = checkedSets.reduce((mx, s) => Math.max(mx, s.weightKg ?? 0), 0)
  const detail = maxWeight > 0 ? `${checkedSets.length} × ${maxWeight}kg` : `${checkedSets.length} séries`
  return (
    <View style={cs.exRow}>
      <Text style={cs.exName} numberOfLines={1}>{exercise.exercise.name}</Text>
      <Text style={cs.exDetail}>{detail}</Text>
    </View>
  )
}

export function WorkoutPostCard({ post }: { post: WorkoutPostRecord }) {
  const navigation = useNavigation<NavProp>()
  const session = post.session
  const userName = post.user.name ?? 'Atleta'

  function goToSession() {
    if (session) navigation.navigate('WorkoutSession', { sessionId: session.id })
  }

  const techniques = session
    ? [...new Set(
        session.exercises
          .flatMap(e => e.sets)
          .filter(s => s.isChecked && s.technique !== 'NONE')
          .map(s => s.technique),
      )]
    : []

  const totalPRs = session
    ? session.exercises.flatMap(e => e.sets).filter(s => s.isPersonalRecord && s.isChecked).length
    : 0

  const checkedExercises = session
    ? session.exercises.filter(e => e.sets.some(s => s.isChecked && s.setType === 'WORKING'))
    : []
  const visibleExercises = checkedExercises.slice(0, MAX_PREVIEW_EXERCISES)
  const extraCount = checkedExercises.length - visibleExercises.length
  const hasMedia = !!post.media && post.media.length > 0

  function renderCardContent() {
    return (
      <>
        {/* User header */}
        <View style={cs.userHeader}>
          {post.user.avatar ? (
            <Image source={{ uri: post.user.avatar }} style={cs.avatar} />
          ) : (
            <View style={[cs.avatar, cs.avatarFallback]}>
              <Text style={cs.avatarInitials}>{getInitials(userName)}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={cs.userName} numberOfLines={1}>{userName}</Text>
            <Text style={cs.postDate}>{formatDateTime(session?.startedAt ?? post.createdAt)}</Text>
          </View>
          {totalPRs > 0 && (
            <View style={cs.prBadge}>
              <Ionicons name="trophy" size={11} color={GOLD} />
              <Text style={cs.prBadgeText}>{totalPRs}</Text>
            </View>
          )}
        </View>

        {/* Caption */}
        {!!post.content && <Text style={cs.caption}>{post.content}</Text>}

        {/* Cover media — primary visual focus */}
        {hasMedia && (
          <View style={cs.cover}>
            <PostMediaCarousel media={post.media!} />
          </View>
        )}

        {session && (
          <>
            {/* Workout title — primary heading */}
            <Text style={cs.title} numberOfLines={2}>
              {session.workoutName ?? 'Treino livre'}
            </Text>

            {/* Stats summary */}
            <View style={cs.statsRow}>
              <Stat value={formatDuration(session.durationMin)} label="DURAÇÃO" />
              <View style={cs.statDivider} />
              <Stat value={String(session.totalValidSets ?? 0)} label="SÉRIES" />
              <View style={cs.statDivider} />
              <Stat value={formatVolume(session.totalVolume)} label="KG TOTAL" />
            </View>

            {/* Personal records — achievement, not status */}
            {totalPRs > 0 && (
              <View style={cs.prRow}>
                <Ionicons name="trophy" size={13} color={GOLD} />
                <Text style={cs.prText}>
                  {totalPRs === 1 ? 'Novo recorde pessoal' : `${totalPRs} novos recordes pessoais`}
                </Text>
              </View>
            )}

            {/* Techniques — single clean summary line, no competing chips */}
            {techniques.length > 0 && (
              <View style={cs.techRow}>
                <Ionicons name="flash-outline" size={12} color="#6A6A7A" />
                <Text style={cs.techText} numberOfLines={1}>
                  {techniques.map(t => TECHNIQUE_LABELS[t] ?? t).join('  ·  ')}
                </Text>
              </View>
            )}

            {/* Exercise preview — the few that matter, then a clean overflow line */}
            {visibleExercises.length > 0 && (
              <View style={cs.exerciseList}>
                {visibleExercises.map(e => <ExercisePreviewRow key={e.id} exercise={e} />)}
                {extraCount > 0 && (
                  <Text style={cs.moreExercises}>
                    +{extraCount} {extraCount === 1 ? 'exercício' : 'exercícios'}
                  </Text>
                )}
              </View>
            )}

            {/* Call to action */}
            <View style={cs.viewBtn}>
              <Text style={cs.viewBtnText}>Ver treino</Text>
              <Ionicons name="arrow-forward" size={14} color="#4FC3F7" />
            </View>
          </>
        )}
      </>
    )
  }

  if (session) {
    return (
      <TouchableOpacity style={cs.card} onPress={goToSession} activeOpacity={0.92}>
        {renderCardContent()}
      </TouchableOpacity>
    )
  }

  return <View style={cs.card}>{renderCardContent()}</View>
}

const cs = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 16,
    gap: 14,
    marginBottom: 14,
  },

  // Header
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  avatarFallback: { backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#F0F0F5', fontSize: 14, fontWeight: '700' },
  userName: { color: '#F0F0F5', fontSize: 14, fontWeight: '600' },
  postDate: { color: '#555560', fontSize: 11, marginTop: 2 },
  // Compact gold PR marker in the header — a quiet achievement cue
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,193,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,74,0.22)',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  prBadgeText: { color: GOLD, fontSize: 12, fontWeight: '700' },

  caption: { color: '#E4E4EC', fontSize: 14, lineHeight: 20 },

  // Cover — rounded media as the visual anchor
  cover: { borderRadius: 14, overflow: 'hidden' },

  // Title — primary heading, sits directly under the cover
  title: { color: '#F0F0F5', fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.2 },

  // Stats summary
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23232C',
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { color: '#F0F0F5', fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  statLabel: { color: '#555560', fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  statDivider: { width: 1, height: 30, backgroundColor: '#23232C' },

  // Personal records
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,193,74,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,193,74,0.20)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  prText: { color: GOLD, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.1 },

  // Techniques — one muted line
  techRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  techText: { color: '#7A7A8A', fontSize: 12, flex: 1, letterSpacing: 0.2 },

  // Exercise preview
  exerciseList: { gap: 9 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exName: { color: '#C4C4CE', fontSize: 13.5, flex: 1, fontWeight: '500' },
  exDetail: { color: '#6A6A7A', fontSize: 12.5, fontFamily: 'monospace' },
  moreExercises: { color: '#555560', fontSize: 12, fontWeight: '500', marginTop: 1 },

  // Call to action
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(79,195,247,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.18)',
    marginTop: 2,
  },
  viewBtnText: { color: '#4FC3F7', fontSize: 13.5, fontWeight: '700', letterSpacing: 0.2 },
})
