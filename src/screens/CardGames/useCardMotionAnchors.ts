import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

type Point = { x: number; y: number };
type Anchor = { measureInWindow: View['measureInWindow'] };

export function useCardMotionAnchors(viewport: string) {
  const nodes = useRef(new Map<string, Anchor>());
  const bindings = useRef(new Map<string, (node: Anchor | null) => void>());
  const generation = useRef({ viewport, value: 0 });
  if (generation.current.viewport !== viewport) {
    generation.current = { viewport, value: generation.current.value + 1 };
  }
  const frame = useRef<number | null>(null);
  const [measured, setMeasured] = useState<{
    generation: number;
    points: Record<string, Point>;
  } | null>(null);

  const anchorRef = useCallback((key: string) => {
    if (!bindings.current.has(key))
      bindings.current.set(key, (node) => {
        if (node) nodes.current.set(key, node);
        else nodes.current.delete(key);
      });
    return bindings.current.get(key)!;
  }, []);

  const measureAnchors = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const currentGeneration = generation.current.value;
      const entries = [...nodes.current.entries()];
      const points: Record<string, Point> = {};
      let pending = entries.length;
      let valid = true;
      entries.forEach(([key, node]) =>
        node.measureInWindow((x, y, width, height) => {
          if (currentGeneration !== generation.current.value) return;
          valid = valid && width > 0 && height > 0;
          points[key] = { x: x + width / 2, y: y + height / 2 };
          pending -= 1;
          if (!pending && valid)
            setMeasured({ generation: currentGeneration, points });
        }),
      );
    });
  }, []);

  useEffect(() => {
    measureAnchors();
    return () => {
      generation.current.value += 1;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [viewport, measureAnchors]);

  const originFor = (key: string, fallback: Point) => {
    if (measured?.generation !== generation.current.value) return fallback;
    const source = measured.points[key];
    const target = measured.points.table;
    return source && target
      ? { x: source.x - target.x, y: source.y - target.y }
      : fallback;
  };
  return { anchorRef, measureAnchors, originFor };
}
