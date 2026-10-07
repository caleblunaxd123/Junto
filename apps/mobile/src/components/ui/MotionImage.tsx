import React, { useEffect, useRef } from "react";
import { Animated, AccessibilityInfo, Image, AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
/** Decorative motion only; financial data and controls stay still. */
export function MotionImage(props: React.ComponentProps<typeof Image>) {
  const offset = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused();
  useEffect(() => {
    let disposed = false;
    let animation: Animated.CompositeAnimation | undefined;
    let reducedMotion = true;
    let active = AppState.currentState === "active";
    function update(reduced: boolean) {
      reducedMotion = reduced;
      animation?.stop();
      offset.setValue(0);
      if (!reduced && focused && active && !disposed) {
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(offset, {
              toValue: -3,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(offset, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
        );
        animation.start();
      }
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => update(true));
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      update,
    );
    const appState = AppState.addEventListener("change", (state) => {
      active = state === "active";
      update(reducedMotion);
    });
    return () => {
      disposed = true;
      listener.remove();
      appState.remove();
      animation?.stop();
      offset.setValue(0);
    };
  }, [focused, offset]);
  return (
    <Animated.Image
      {...props}
      style={[props.style, { transform: [{ translateY: offset }] }]}
    />
  );
}
