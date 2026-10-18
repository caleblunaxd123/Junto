import React, { useState } from "react";
import { View, useWindowDimensions, type ViewStyle } from "react-native";
import { Label } from "./Design";

/**
 * A monetary value that always stays on ONE line: it shrinks to the space it has (down to 60 %)
 * instead of wrapping "S/ 6,586,70 / 0.14". Works in columns (fills the width) and in rows (shrinks
 * next to its siblings). Screen readers always get the full value.
 */
export function MoneyText({ children, size = 22, style, containerStyle, ...props }: React.ComponentProps<typeof Label> & { children: string; containerStyle?: ViewStyle }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  // Plus Jakarta ExtraBold digits are ~0.62 em wide; 0.66 leaves a small margin.
  const chars = Array.from(children).length;
  const fitted = width ? Math.max(size * 0.6, Math.min(size, width / (chars * 0.66 * fontScale))) : size;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[{ flexShrink: 1, minWidth: 0, alignSelf: "stretch" }, containerStyle]}>
      <Label {...props} size={fitted} weight="extra" accessibilityLabel={children}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
        style={[{ minWidth: 0, fontVariant: ["tabular-nums"], lineHeight: fitted * 1.3 }, style]}>
        {/* Non-breaking spaces: "S/" and the number never split. */}
        {children.replace(/ /g, " ")}
      </Label>
    </View>
  );
}
