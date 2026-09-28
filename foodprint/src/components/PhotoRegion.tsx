import React, { useRef, useState } from 'react';
import { Image, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, C, Notice, Sheet, T } from './ui';

export interface Region { x: number; y: number; width: number; height: number }
/** Display coordinates use a top-left origin. OCR conversion happens in the service. */
export function PhotoRegion({ uri, width, height, onCancel, onConfirm }: { uri: string; width: number; height: number; onCancel: () => void; onConfirm: (region: Region) => void }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const photoHeight = Math.min(450, Math.max(1, window.height - Math.max(insets.top, 18) - Math.max(insets.bottom, 18)) * .4);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [region, setRegion] = useState<Region>({ x: 0, y: 0, width: 1, height: 1 });
  const start = useRef({ x: 0, y: 0 });
  const point = (event: GestureResponderEvent) => ({ x: Math.max(0, Math.min(1, event.nativeEvent.locationX / size.width)), y: Math.max(0, Math.min(1, event.nativeEvent.locationY / size.height)) });
  // Keep the gesture surface outside every ScrollView: native scrolling can steal
  // touches from a JS responder even when it refuses responder termination.
  const photo = <View style={{ width: '100%', aspectRatio: width / height, maxWidth: photoHeight * width / height, alignSelf: 'center' }} onLayout={event => setSize(event.nativeEvent.layout)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false} onResponderGrant={event => { start.current = point(event); }} onResponderMove={event => { const end = point(event); setRegion({ x: Math.min(start.current.x, end.x), y: Math.min(start.current.y, end.y), width: Math.abs(end.x - start.current.x), height: Math.abs(end.y - start.current.y) }); }}>
      <View pointerEvents="none" style={{ width: '100%', height: '100%' }}><Image source={{ uri }} resizeMode="stretch" style={{ width: '100%', height: '100%' }} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%`, borderColor: C.green, borderWidth: 3, backgroundColor: '#D9E8C72A' }} />
    </View>;
  return <Sheet title="Select the ingredients" subtitle="Drag across the photo to draw a box around the list." onClose={onCancel} fixedContent={photo}>
    <Notice>Include every line of the ingredients. Leave addresses, nutrition tables and marketing outside the box.</Notice>
    <T muted style={{ fontSize: 12 }}>Only recognised lines mainly inside the box will be used. Include each ingredient line in full. You can redraw it or use the whole photo.</T>
    <Button label="Use selected area" disabled={region.width < .03 || region.height < .03} onPress={() => onConfirm(region)} />
    <Button label="Use whole photo" variant="secondary" onPress={() => onConfirm({ x: 0, y: 0, width: 1, height: 1 })} />
  </Sheet>;
}
