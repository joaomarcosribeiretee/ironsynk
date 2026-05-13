import React, { useState, useRef, useEffect } from 'react'
import { View, PanResponder, Animated } from 'react-native'

type Item = { id: string }

export type DragRenderParams<T> = {
  item: T
  drag: () => void
  isActive: boolean
}

type Props<T extends Item> = {
  data: T[]
  keyExtractor: (item: T) => string
  renderItem: (params: DragRenderParams<T>) => React.ReactNode
  onReorder: (data: T[]) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  itemHeight: number
  itemGap?: number
}

export function DragSortableList<T extends Item>({
  data: propData,
  keyExtractor,
  renderItem,
  onReorder,
  onDragStart,
  onDragEnd,
  itemHeight,
  itemGap = 0,
}: Props<T>) {
  const [data, setData] = useState<T[]>(propData)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const dataRef = useRef<T[]>(propData)
  const activeIdxRef = useRef<number | null>(null)
  const origIdxRef = useRef<number>(0)
  const isDraggingRef = useRef(false)
  const dragAnim = useRef(new Animated.Value(0)).current
  const rowH = itemHeight + itemGap

  const onDragStartRef = useRef(onDragStart)
  const onDragEndRef = useRef(onDragEnd)
  const onReorderRef = useRef(onReorder)
  onDragStartRef.current = onDragStart
  onDragEndRef.current = onDragEnd
  onReorderRef.current = onReorder

  useEffect(() => {
    if (!isDraggingRef.current) {
      dataRef.current = propData
      setData(propData)
    }
  }, [propData])

  function beginDrag(idx: number) {
    activeIdxRef.current = idx
    origIdxRef.current = idx
    isDraggingRef.current = true
    dragAnim.setValue(0)
    setActiveIdx(idx)
    onDragStartRef.current?.()
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => isDraggingRef.current,
      onPanResponderMove: (_, gesture) => {
        const idx = activeIdxRef.current
        if (idx === null) return

        const dy = gesture.dy
        const visualY = origIdxRef.current * rowH + dy
        const targetIdx = Math.max(0, Math.min(dataRef.current.length - 1, Math.round(visualY / rowH)))
        const translateY = (origIdxRef.current - idx) * rowH + dy
        dragAnim.setValue(translateY)

        if (targetIdx !== idx) {
          const newData = [...dataRef.current]
          const [moved] = newData.splice(idx, 1)
          newData.splice(targetIdx, 0, moved)
          dataRef.current = newData
          activeIdxRef.current = targetIdx
          setActiveIdx(targetIdx)
          setData([...newData])
        }
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false
        dragAnim.setValue(0)
        setActiveIdx(null)
        activeIdxRef.current = null
        onDragEndRef.current?.()
        onReorderRef.current([...dataRef.current])
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false
        dragAnim.setValue(0)
        setActiveIdx(null)
        activeIdxRef.current = null
        onDragEndRef.current?.()
      },
    })
  ).current

  return (
    <View {...panResponder.panHandlers}>
      {data.map((item, idx) => {
        const isActive = idx === activeIdx
        return (
          <Animated.View
            key={keyExtractor(item)}
            style={isActive ? {
              transform: [{ translateY: dragAnim }],
              zIndex: 10,
              shadowColor: '#2979FF',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            } : undefined}
          >
            {renderItem({ item, drag: () => beginDrag(idx), isActive })}
          </Animated.View>
        )
      })}
    </View>
  )
}
