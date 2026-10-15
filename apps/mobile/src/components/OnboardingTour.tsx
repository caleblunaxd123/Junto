import React from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Label, palette } from "./ui/Design";
import { art } from "./ui/Artwork";

/** A small piece of the real app, so each slide shows how JUNTO looks instead of describing it. */
function Preview({ children }: { children: React.ReactNode }) {
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ padding: 14, gap: 10, borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
      {children}
    </View>
  );
}
function Line({ name, text, color }: { name: string; text: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Avatar name={name} seed={name} size={30} />
      <Label size={14} weight="bold" color={color} style={{ flex: 1 }}>{text}</Label>
    </View>
  );
}

const slides = [
  {
    key: "balance",
    image: art.welcome,
    title: "Sabes quién le debe a quién",
    copy: "JUNTO lleva las cuentas de tus grupos: viajes, el depa, la pareja o una salida.",
    preview: (
      <Preview>
        <Label size={13} weight="extra">Viaje a Cusco</Label>
        <Line name="Marco" text="Marco te debe S/ 45.00" color={palette.positive} />
        <Line name="Ana" text="Le debes S/ 20.00 a Ana" color={palette.negative} />
      </Preview>
    ),
  },
  {
    key: "expense",
    image: art.food,
    title: "Anota un gasto en segundos",
    copy: "Cuánto fue y quién pagó. JUNTO lo divide hasta el último céntimo.",
    preview: (
      <Preview>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.mint }}>
            <Ionicons name="restaurant-outline" size={18} color={palette.positive} />
          </View>
          <View style={{ flex: 1 }}>
            <Label size={14} weight="extra">Cena · S/ 120.00</Label>
            <Label size={12} color={palette.muted}>Pagaste tú · entre 4 · S/ 30.00 c/u</Label>
          </View>
        </View>
        <Label size={13} weight="bold" color={palette.positive}>Te deben S/ 90.00</Label>
      </Preview>
    ),
  },
  {
    key: "settle",
    image: art.settled,
    title: "Quedan a mano",
    copy: "Pagan por Yape, Plin o efectivo, fuera de JUNTO. Quien recibe lo confirma y la deuda baja.",
    preview: (
      <Preview>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Avatar name="Ana" seed="Ana" size={30} />
          <Ionicons name="arrow-forward" size={16} color={palette.muted} />
          <Avatar name="Tú" seed="Tú" size={30} />
          <Label size={14} weight="extra" style={{ flex: 1, textAlign: "right" }}>S/ 20.00 · Yape</Label>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="time-outline" size={16} color="#8A5A00" />
          <Label size={13} weight="bold" color="#8A5A00">Esperando que lo confirmes</Label>
        </View>
      </Preview>
    ),
  },
];

/** Welcome tour: three swipeable pages, one idea each. */
export function OnboardingTour() {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 800) - 32; // Screen padding is 16 on each side.
  const [page, setPage] = React.useState(0);
  const pager = React.useRef<ScrollView>(null);
  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  const goTo = (index: number) => { pager.current?.scrollTo({ x: index * pageWidth, animated: true }); setPage(index); };
  return (
    <View style={{ gap: 14 }}>
      <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} onScrollEndDrag={onEnd} scrollEventThrottle={64}>
        {slides.map((slide, index) => (
          <View key={slide.key} accessible accessibilityLabel={`${index + 1} de ${slides.length}. ${slide.title}. ${slide.copy}`} style={{ width: pageWidth, gap: 14 }}>
            <View style={{ height: 150, borderRadius: 24, backgroundColor: "#FFF2E4", overflow: "hidden" }}>
              <Image source={slide.image} accessibilityIgnoresInvertColors style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            </View>
            <View style={{ gap: 4 }}>
              <Label accessibilityRole="header" size={25} weight="extra" style={{ lineHeight: 30 }}>{slide.title}</Label>
              <Label size={15} color={palette.muted}>{slide.copy}</Label>
            </View>
            {slide.preview}
          </View>
        ))}
      </ScrollView>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
        {slides.map((slide, index) => (
          <Pressable key={slide.key} accessibilityRole="tab" accessibilityLabel={`Ver ${index + 1} de ${slides.length}`} aria-selected={page === index} hitSlop={8} onPress={() => goTo(index)} style={{ width: 28, height: 24, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: page === index ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: page === index ? palette.positive : "#C9D6D1" }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
