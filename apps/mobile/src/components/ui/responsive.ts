import { Platform, useWindowDimensions } from "react-native";

/** Web-only breakpoints: native tablets keep their existing navigation. */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    desktop: Platform.OS === "web" && width >= 1024,
    tablet: Platform.OS === "web" && width >= 768,
    web: Platform.OS === "web",
  };
}
