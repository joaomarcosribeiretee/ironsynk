import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { WorkoutPostRecord, ExecutionExerciseRecord, ExecutionSetLogRecord } from '../lib/api'
import { getTechStyle, getBadgeLabel } from './SetBadge'

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

function formatWeight(kg: number | null) {
  if (kg == null || kg <= 0) return '—'
  return `${kg % 1 === 0 ? kg : kg.toFixed(1)} kg`
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

function SetRow({ set, index }: { set: ExecutionSetLogRecord; index: number }) {
  const ts = getTechStyle(set.setType, set.technique)
  const label = getBadgeLabel(set.setType, set.technique, index)
  return (
    <View style={cs.setRow}>
      <View style={[cs.setBadge, { backgroundColor: ts.badgeBg, borderColor: ts.borderColor }]}>
        <Text style={[cs.setBadgeText, { color: ts.badgeText }]}>{label}</Text>
      </View>
      <Text style={cs.setReps}>{set.repsCompleted ?? 0} reps</Text>
      <Text style={cs.setWeight}>{formatWeight(set.weightKg)}</Text>
      {set.isPersonalRecord && (
        <View style={cs.prPill}>
          <Ionicons name="trophy" size={9} color="#00E676" />
          <Text style={cs.prPillText}>PR</Text>
        </View>
      )}
    </View>
  )
}

function ExerciseBlock({ exercise }: { exercise: ExecutionExerciseRecord }) {
  const doneSets = exercise.sets.filter((s) => s.isChecked)
  if (doneSets.length === 0) return null
  return (
    <View style={cs.exerciseBlock}>
      <Text style={cs.exerciseName} numberOfLines={1}>{exercise.exercise.name}</Text>
      {doneSets.map((set, i) => <SetRow key={set.id} set={set} index={i} />)}
      {!!exercise.exerciseNotes && (
        <Text style={cs.exerciseNotes} numberOfLines={2}>{exercise.exerciseNotes}</Text>
      )}
    </View>
  )
}

export function WorkoutPostCard({ post }: { post: WorkoutPostRecord }) {
  const session = post.session
  const userName = post.user.name ?? 'Atleta'

  const techniques = session
    ? [...new Set(
        session.exercises
          .flatMap((e) => e.sets)
          .filter((s) => s.isChecked && s.technique !== 'NONE')
          .map((s) => s.technique),
      )]
    : []

  return (
    <View style={cs.card}>
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

          {/* Advanced techniques */}
          {techniques.length > 0 && (
            <View style={cs.techRow}>
              {techniques.map((t) => {
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

          {/* Exercises */}
          <View style={cs.exerciseList}>
            {session.exercises.map((e) => <ExerciseBlock key={e.id} exercise={e} />)}
          </View>

          {/* Session notes */}
          {!!session.notes && (
            <View style={cs.notesBox}>
              <Ionicons name="document-text-outline" size={13} color="#8A8A9A" />
              <Text style={cs.notesText}>{session.notes}</Text>
            </View>
          )}
        </>
      )}
    </View>
  )
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

  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  techPillText: { fontSize: 10, fontWeight: '600' },

  exerciseList: { gap: 12 },
  exerciseBlock: { gap: 6 },
  exerciseName: { color: '#8A8A9A', fontSize: 13, fontWeight: '600' },
  exerciseNotes: { color: '#555560', fontSize: 11, fontStyle: 'italic' },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setBadge: {
    width: 26, height: 24, borderRadius: 6, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  setBadgeText: { fontSize: 9, fontWeight: '700' },
  setReps: { color: '#F0F0F5', fontSize: 13, width: 64 },
  setWeight: { color: '#8A8A9A', fontSize: 13, flex: 1 },
  prPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,230,118,0.10)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  prPillText: { color: '#00E676', fontSize: 9, fontWeight: '700' },

  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#141418', borderRadius: 10, padding: 10,
  },
  notesText: { color: '#8A8A9A', fontSize: 12, lineHeight: 17, flex: 1 },
})
