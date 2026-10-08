import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { styles } from './Mp3Screen.styles';

type Props = {
  title: string;
  active: boolean;
  onActivate?: () => void;
  style?: StyleProp<ViewStyle>;
};
const MARQUEE_GAP = 24;

export function AudioTrackTitle({ title, active, onActivate, style }: Props) {
  const [hovered, setHovered] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [measuredTitle, setMeasuredTitle] = useState(title);
  const offset = useRef(new Animated.Value(0)).current;
  const overflowDistance = Math.max(0, contentWidth - viewportWidth);
  const cycleDistance = contentWidth + MARQUEE_GAP;
  const running =
    measuredTitle === title && overflowDistance > 1 && (active || hovered);

  useEffect(() => {
    if (!running || overflowDistance <= 0) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(offset, {
          toValue: -cycleDistance,
          duration: Math.max(1800, cycleDistance * 32),
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(offset, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      offset.setValue(0);
    };
  }, [cycleDistance, offset, overflowDistance, running]);

  const measureViewport = (event: LayoutChangeEvent) =>
    setViewportWidth(event.nativeEvent.layout.width);
  const content = (
    <>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.trackTitle, running && styles.marqueeHiddenTitle]}
      >
        {title}
      </Text>
      <ScrollView
        key={title}
        testID="audio-title-measure"
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        onContentSizeChange={(width) => {
          setContentWidth(width);
          setMeasuredTitle(title);
        }}
        style={styles.marqueeMeasure}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[styles.trackTitle, styles.marqueeText]}
        >
          {title}
        </Text>
      </ScrollView>
      <Animated.View
        testID="audio-title-marquee"
        pointerEvents="none"
        style={[
          styles.marqueeContent,
          !running && styles.marqueeInactive,
          {
            width: contentWidth * 2 + MARQUEE_GAP,
            transform: [{ translateX: offset }],
          },
        ]}
      >
        {/* Copy 1 slides in as copy 0 leaves; then the loop resets. */}
        {[0, 1].map((copy) => (
          <View key={copy} style={styles.marqueeCopy}>
            {copy > 0 && (
              <View
                testID="audio-title-separator"
                style={[styles.marqueeSeparator, { width: MARQUEE_GAP }]}
              />
            )}
            <Text
              testID={`audio-title-copy-${copy}`}
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                styles.trackTitle,
                styles.marqueeText,
                { width: contentWidth },
              ]}
            >
              {title}
            </Text>
          </View>
        ))}
      </Animated.View>
    </>
  );
  const rootStyle = StyleSheet.compose(styles.titleControl, style);

  if (!onActivate) {
    return (
      <View
        onLayout={measureViewport}
        style={rootStyle}
        testID="audio-title-viewport"
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${running ? 'Dừng chạy tên' : 'Chạy tên'} ${title}`}
      accessibilityHint="Chạm để chạy tên bài; chạm ra ngoài để dừng; cũng tự chạy khi đưa con trỏ lên"
      onPress={onActivate}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onLayout={measureViewport}
      style={rootStyle}
      testID="audio-title-viewport"
    >
      {content}
    </Pressable>
  );
}
