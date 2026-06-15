import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const CARD_IMG_SIZE = 64

type Props = {
  gifUrl: string | null
  name: string
  meta?: React.ReactNode
  rightSlot?: React.ReactNode
  topStrip?: React.ReactNode
  cardStyle?: StyleProp<ViewStyle>
  shadowStyle?: StyleProp<ViewStyle>
  children: React.ReactNode
}

export function ExerciseCardShell({
  gifUrl, name, meta, rightSlot, topStrip, cardStyle, shadowStyle, children,
}: Props) {
  return (
    <View style={[cs.shadow, shadowStyle]}>
      <View style={[cs.card, cardStyle]}>
        {topStrip}
        <View style={cs.header}>
          <View style={cs.imgBox}>
            {gifUrl ? (
              <Image source={{ uri: gifUrl }} style={cs.imgThumb} resizeMode="cover" />
            ) : (
              <View style={cs.imgPlaceholder}>
                <Ionicons name="barbell-outline" size={22} color="#3A3A4A" />
              </View>
            )}
          </View>
          <View style={cs.info}>
            <Text style={cs.exName} numberOfLines={1}>{name}</Text>
            {meta}
          </View>
          {rightSlot}
        </View>
        {children}
      </View>
    </View>
  )
}

// Shared meta row styles — use for secondary info below exercise name
export const cardMetaStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { color: '#8A8A9A', fontSize: 11, textTransform: 'capitalize' },
  dot: { color: '#3A3A4A', fontSize: 10 },
  pill: {
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: { color: '#8A8A9A', fontSize: 11 },
})

// Shared body element styles — observation input and add-set button
export const cardBodyStyles = StyleSheet.create({
  observationWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  observationInput: {
    backgroundColor: '#23232D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F0F0F5',
    fontSize: 12,
    height: 44,
    textAlignVertical: 'center' as const,
  },
  addSetBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    height: 36,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#252530',
  },
  addSetText: { color: '#8A8A9A', fontSize: 12, fontWeight: '500' as const },
})

const cs = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A35',
    backgroundColor: '#23232D',
  },
  imgBox: {
    width: CARD_IMG_SIZE + 16,
    height: CARD_IMG_SIZE + 16,
    padding: 8,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgThumb: {
    width: CARD_IMG_SIZE,
    height: CARD_IMG_SIZE,
    borderRadius: 10,
  },
  imgPlaceholder: {
    width: CARD_IMG_SIZE,
    height: CARD_IMG_SIZE,
    backgroundColor: '#2A2A35',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 4,
  },
  exName: {
    color: '#F0F0F5',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
})
