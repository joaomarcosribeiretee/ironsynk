import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { socialKeys } from '../../lib/socialQueries'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import type { AppStackParamList } from '../../navigation/AppNavigator'
import { SocialUserRow } from '../../components/SocialUserRow'
import { ListEmpty, ListError, ListLoading } from '../../components/ListStates'

type NavProp = NativeStackNavigationProp<AppStackParamList>

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function UserSearchScreen() {
  const navigation = useNavigation<NavProp>()
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  // Type-ahead without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [term])

  const isSearching = debounced.length >= MIN_QUERY_LENGTH

  const search = useQuery({
    queryKey: socialKeys.search(debounced),
    queryFn: () => api.social.searchUsers(debounced),
    enabled: isSearching,
  })

  const suggested = useQuery({
    queryKey: socialKeys.suggested,
    queryFn: () => api.social.suggestedUsers(),
    enabled: !isSearching,
  })

  const active = isSearching ? search : suggested
  const users = active.data?.data.users ?? []

  function openUser(userId: string) {
    navigation.navigate('UserProfile', { userId })
  }

  function renderEmpty() {
    if (active.isLoading) return <ListLoading />
    if (active.isError) {
      return <ListError message={getFriendlyErrorMessage(active.error)} onRetry={() => active.refetch()} />
    }
    if (isSearching) {
      return (
        <ListEmpty
          icon="search-outline"
          title="Nenhum atleta encontrado"
          sub={`Não achamos ninguém com "${debounced}".`}
        />
      )
    }
    return (
      <ListEmpty
        icon="people-outline"
        title="Encontre outros atletas"
        sub="Busque pelo nome de quem você quer seguir."
      />
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.topBtn}>
          <Ionicons name="chevron-back" size={24} color="#F0F0F5" />
        </TouchableOpacity>
        <View style={s.searchBox}>
          <Ionicons name="search" size={17} color="#4A4A5A" />
          <TextInput
            style={s.input}
            value={term}
            onChangeText={setTerm}
            placeholder="Buscar atletas"
            placeholderTextColor="#4A4A5A"
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {term.length > 0 && (
            <TouchableOpacity onPress={() => setTerm('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color="#4A4A5A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isSearching && users.length > 0 && (
        <Text style={s.sectionTitle}>Sugestões para você</Text>
      )}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SocialUserRow user={item} onPress={openUser} />}
        contentContainerStyle={[s.list, users.length === 0 && s.listEmpty]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty()}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141418' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingBottom: 10 },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 13,
    paddingHorizontal: 13,
    height: 44,
  },
  input: { flex: 1, color: '#F0F0F5', fontSize: 14.5, padding: 0 },
  sectionTitle: {
    color: '#8A8A9A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  list: { paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
})
