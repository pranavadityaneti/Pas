/**
 * SignaturePad — Phase 1 (2026-06-14).
 *
 * On-screen drawn-signature capture. Finger strokes are captured with the
 * built-in PanResponder and rendered live as react-native-svg <Path> elements.
 * The result is returned as vector SVG path strings (no rasterization, so no
 * extra native module), in the pad's own pixel coordinate space — the same
 * viewBox the signed PDF embeds.
 *
 * Requires react-native-svg (native) → ships in the next native build.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../../../../constants/Colors';
import type { DrawnSignature } from '../buildAgreementHtml';

interface Props {
  onConfirm: (signature: DrawnSignature) => void;
  /** e.g. "Pranav Kumar · Proprietor" — shown under the pad. */
  signatoryLabel?: string;
  height?: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

export default function SignaturePad({ onConfirm, signatoryLabel, height = 200 }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');

  // Refs mirror state so the PanResponder (created once) reads the latest value.
  const pathsRef = useRef<string[]>([]);
  const currentRef = useRef<string>('');
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    sizeRef.current = { width, height: h };
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        const d = `M ${round(locationX)} ${round(locationY)}`;
        currentRef.current = d;
        setCurrent(d);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        const d = `${currentRef.current} L ${round(locationX)} ${round(locationY)}`;
        currentRef.current = d;
        setCurrent(d);
      },
      onPanResponderRelease: () => {
        if (currentRef.current) {
          const next = [...pathsRef.current, currentRef.current];
          pathsRef.current = next;
          setPaths(next);
          currentRef.current = '';
          setCurrent('');
        }
      },
    })
  ).current;

  const isEmpty = paths.length === 0 && current === '';

  const clear = () => {
    pathsRef.current = [];
    currentRef.current = '';
    setPaths([]);
    setCurrent('');
  };

  const confirm = () => {
    if (isEmpty) return;
    const all = current ? [...paths, current] : paths;
    onConfirm({
      paths: all,
      width: Math.round(sizeRef.current.width) || 1,
      height: Math.round(sizeRef.current.height) || height,
    });
  };

  return (
    <View>
      <View style={[styles.pad, { height }]} onLayout={onLayout} {...responder.panHandlers}>
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#1f2937" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {current ? (
            <Path d={current} stroke="#1f2937" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
        <View pointerEvents="none" style={styles.baseline} />
        {isEmpty ? (
          <Text pointerEvents="none" style={styles.hint}>
            ✕ sign above the line
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearBtn} onPress={clear} activeOpacity={0.7}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, isEmpty && styles.confirmDisabled]}
          onPress={confirm}
          activeOpacity={0.7}
          disabled={isEmpty}
        >
          <Text style={styles.confirmText}>Confirm signature</Text>
        </TouchableOpacity>
      </View>

      {signatoryLabel ? <Text style={styles.signatory}>Signing as {signatoryLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  baseline: { position: 'absolute', left: 16, right: 16, bottom: 26, borderBottomWidth: 1, borderBottomColor: '#d1d5db' },
  hint: { position: 'absolute', left: 16, bottom: 10, fontSize: 11, color: '#9ca3af' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  clearBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  clearText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  confirmBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  signatory: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
});
