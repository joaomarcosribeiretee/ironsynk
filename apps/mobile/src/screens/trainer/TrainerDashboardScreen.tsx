import React, { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../../lib/api'
import type { TrainerDashboardData } from '../../lib/api'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

export function TrainerDashboardScreen() {
  const [data, setData] = useState<TrainerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      api.trainer.dashboard()
        .then(({ data: d }) => { setData(d); setError(null) })
        .catch(() => setError('Não foi possível carregar o dashboard.'))
        .finally(() => setLoading(false))
    }, [])
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Dashboard</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4FC3F7" size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statNum}>{data.totalStudents}</Text>
              <Text style={s.statLbl}>Alunos ativos</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNum}>{data.trainedToday}</Text>
              <Text style={s.statLbl}>Treinaram hoje</Text>
            </View>
          </View>

          {/* Needs attention */}
          <Text style={s.sectionTitle}>ATENÇÃO NECESSÁRIA</Text>
          {data.needsAttention.length === 0 ? (
            <View style={s.allGoodCard}>
              <Text style={s.allGoodText}>Todos os alunos em dia</Text>
            </View>
          ) : (
            data.needsAttention.map((item) => (
              <TouchableOpacity key={item.athleteId} style={s.attentionCard} activeOpacity={0.75}>
                <View style={s.attentionAvatar}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={s.avatarImg} />
                  ) : (
                    <Text style={s.avatarInitials}>
                      {item.name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')}
                    </Text>
                  )}
                </View>
                <View style={s.attentionInfo}>
                  <Text style={s.attentionName}>{item.name}</Text>
                  <Text style={s.attentionReason}>{item.reason}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Recent activity */}
          <Text style={s.sectionTitle}>ATIVIDADE RECENTE</Text>
          {data.recentActivity.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>Nenhuma atividade recente</Text>
            </View>
          ) : (
            data.recentActivity.map((item, i) => (
              <View key={i} style={s.activityRow}>
                <View style={s.activityDot} />
                <View style={s.activityInfo}>
                  <Text style={s.activityName}>{item.studentName}</Text>
                  <Text style={s.activityWorkout}>{item.workoutName}</Text>
                </View>
                <Text style={s.activityTime}>{timeAgo(item.loggedAt)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#FF5252', fontSize: 14 },

  header: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#2A2A35',
  },
  headerTitle: { color: '#F0F0F5', fontSize: 22, fontWeight: '500' },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', padding: 16, alignItems: 'center',
  },
  statNum: { color: '#F0F0F5', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  statLbl: { color: '#8A8A9A', fontSize: 12 },

  // Section title
  sectionTitle: {
    color: '#8A8A9A', fontSize: 10, fontWeight: '600',
    letterSpacing: 1, marginTop: 24, marginBottom: 10,
  },

  // All good
  allGoodCard: {
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', padding: 16, alignItems: 'center',
  },
  allGoodText: { color: '#00E676', fontSize: 14, fontWeight: '600' },

  // Attention cards
  attentionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35',
    padding: 14, marginBottom: 8,
  },
  attentionAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center',
    marginRight: 12, overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44 },
  avatarInitials: { color: '#F0F0F5', fontSize: 16, fontWeight: '700' },
  attentionInfo: { flex: 1 },
  attentionName: { color: '#F0F0F5', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  attentionReason: { color: '#FFB300', fontSize: 13 },

  // Activity
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35',
    padding: 14, marginBottom: 8,
  },
  activityDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4FC3F7', marginRight: 12,
  },
  activityInfo: { flex: 1 },
  activityName: { color: '#F0F0F5', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  activityWorkout: { color: '#8A8A9A', fontSize: 13 },
  activityTime: { color: '#4A4A5A', fontSize: 12 },

  // Empty
  emptyCard: {
    backgroundColor: '#1E1E24', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A35', padding: 24, alignItems: 'center',
  },
  emptyText: { color: '#4A4A5A', fontSize: 14 },
})
