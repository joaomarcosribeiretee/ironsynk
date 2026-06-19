import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { WorkoutPostRecord, ExecutionExerciseRecord } from '../lib/api'
import type { AppStackParamList } from '../navigation/AppNavigator'
import { getTechStyle } from './SetBadge'
import { PostMediaCarousel } from './PostMediaCarousel'

type NavProp = NativeStackNavigationProp<AppStackParamList>

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

function CompactExerciseRow({ exercise }: { exercise: ExecutionExerciseRecord }) {
  const checkedSets = exercise.sets.filter(s => s.isChecked && s.setType === 'WORKING')
  if (checkedSets.length === 0) return null
  const maxWeight = checkedSets.reduce((mx, s) => Math.max(mx, s.weightKg ?? 0), 0)
  const label = maxWeight > 0 ? `${checkedSets.length} × ${maxWeight}kg` : `${checkedSets.length} séries`
  return (
    <View style={cs.exRow}>
      <View style={cs.exDot} />
      <Text style={cs.exName} numberOfLines={1}>{exercise.exercise.name}</Text>
      <Text style={cs.exDetail}>{label}</Text>
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
  const visibleExercises = checkedExercises.slice(0, 2)
  const extraCount = checkedExercises.length - visibleExercises.length

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
        </View>

        {/* Caption */}
        {!!post.content && <Text style={cs.caption}>{post.content}</Text>}

        {/* Media carousel — renders above the workout summary */}
        {post.media && post.media.length > 0 && <PostMediaCarousel media={post.media} />}

        {session && (
          <>
            {/* Workout title */}
            <View style={cs.titleRow}>
              <View style={cs.titleIcon}>
                <Ionicons name="barbell-outline" size={15} color="#4FC3F7" />
              </View>
              <Text style={cs.title} numberOfLines={1}>
                {session.workoutName ?? 'Treino livre'}
              </Text>
            </View>

            {/* Stats */}
            <View style={cs.statsRow}>
              <View style={cs.stat}>
                <Text style={cs.statValue}>{formatDuration(session.durationMin)}</Text>
                <Text style={cs.statLabel}>duração</Text>
              </View>
              <View style={cs.statDivider} />
              <View style={cs.stat}>
                <Text style={cs.statValue}>{session.totalValidSets ?? 0}</Text>
                <Text style={cs.statLabel}>séries</Text>
              </View>
              <View style={cs.statDivider} />
              <View style={cs.stat}>
                <Text style={cs.statValue}>{formatVolume(session.totalVolume)}</Text>
                <Text style={cs.statLabel}>kg total</Text>
              </View>
            </View>

            {/* PR count */}
            {totalPRs > 0 && (
              <View style={cs.prRow}>
                <Ionicons name="trophy" size={11} color="#00E676" />
                <Text style={cs.prText}>
                  {totalPRs} {totalPRs === 1 ? 'record pessoal' : 'records pessoais'}
                </Text>
              </View>
            )}

            {/* Techniques */}
            {techniques.length > 0 && (
              <View style={cs.techRow}>
                {techniques.map(t => {
                  const ts = getTechStyle('WORKING', t)
                  return (
                    <View key={t} style={[cs.techPill, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}>
                      <Text style={[cs.techPillText, { color: ts.badgeText }]}>
                        {TECHNIQUE_LABELS[t] ?? t}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Compact exercise preview */}
            {visibleExercises.length > 0 && (
              <View style={cs.exerciseList}>
                {visibleExercises.map(e => <CompactExerciseRow key={e.id} exercise={e} />)}
                {extraCount > 0 && (
                  <Text style={cs.moreExercises}>+{extraCount} exercícios</Text>
                )}
              </View>
            )}

            {/* View session CTA */}
            <View style={cs.viewBtn}>
              <Text style={cs.viewBtnText}>Ver treino</Text>
              <Ionicons name="chevron-forward" size={13} color="#4FC3F7" />
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },

  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, flexShrink: 0 },
  avatarFallback: { backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#F0F0F5', fontSize: 13, fontWeight: '700' },
  userName: { color: '#F0F0F5', fontSize: 14, fontWeight: '600' },
  postDate: { color: '#555560', fontSize: 11, marginTop: 1 },

  caption: { color: '#F0F0F5', fontSize: 14, lineHeight: 20 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(41,121,255,0.10)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  title: { color: '#F0F0F5', fontSize: 15, fontWeight: '700', flex: 1 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: 12,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: '#F0F0F5', fontSize: 16, fontWeight: '700' },
  statLabel: { color: '#555560', fontSize: 10 },
  statDivider: { width: 1, height: 26, backgroundColor: '#2A2A35' },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,230,118,0.07)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  prText: { color: '#00E676', fontSize: 12, fontWeight: '600' },

  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  techPillText: { fontSize: 10, fontWeight: '600' },

  exerciseList: { gap: 7 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2A2A35', flexShrink: 0 },
  exName: { color: '#8A8A9A', fontSize: 13, flex: 1 },
  exDetail: { color: '#555560', fontSize: 12 },
  moreExercises: { color: '#4A4A5A', fontSize: 12, paddingLeft: 12 },

  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A35',
    marginTop: 2,
  },
  viewBtnText: { color: '#4FC3F7', fontSize: 13, fontWeight: '600' },
})
