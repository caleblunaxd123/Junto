import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

/** Photos uploaded in JUNTO are stored as "/api/fotos/<id>"; Google photos are full URLs. */
export function photoUri(photo?: string | null) {
  if (!photo) return undefined;
  return photo.startsWith("/") ? `${API_URL}${photo}` : photo;
}

/**
 * Picks a profile photo and returns it as a centered 512 px square JPEG in base64 (about 50 KB).
 * Returns null when the person cancels.
 */
export async function pickProfilePhoto(camera: boolean): Promise<{ base64: string; uri: string } | { error: string } | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    return { error: "Sin permiso de cámara. Puedes elegir una foto de tu galería." };
  // Android/iOS let the person frame the square; on the web we center it.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: Platform.OS !== "web", aspect: [1, 1] };
  const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset?.uri) return { error: "No pudimos abrir esa foto. Elige otra." };
  try {
    const side = Math.min(asset.width || 0, asset.height || 0);
    const crop = side && asset.width !== asset.height
      ? [{ crop: { originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side } }]
      : [];
    const result = await manipulateAsync(asset.uri, [...crop, { resize: { width: 512, height: 512 } }], { compress: 0.75, format: SaveFormat.JPEG, base64: true });
    if (!result.base64) return { error: "No pudimos preparar esa foto. Elige otra." };
    return { base64: result.base64.replace(/^data:image\/\w+;base64,/, ""), uri: result.uri };
  } catch {
    return { error: "No pudimos preparar esa foto. Elige otra." };
  }
}

/**
 * A receipt photo ready for the reader: at most 1600 px wide (about 0.5 MB). A phone camera shoots
 * 12 MP or more, which went over the 4 MB upload limit or reached the reader too big to read well.
 * Returns null when the person cancels.
 */
export async function pickReceiptPhoto(camera: boolean): Promise<{ base64: string } | { error: string } | null> {
  const picked = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset?.uri) return { error: "No pudimos abrir esa foto. Elige otra." };
  try {
    const resize = (asset.width || 0) > 1600 ? [{ resize: { width: 1600 } }] : [];
    const result = await manipulateAsync(asset.uri, resize, { compress: 0.85, format: SaveFormat.JPEG, base64: true });
    const base64 = result.base64?.replace(/^data:image\/\w+;base64,/, "");
    if (!base64) return { error: "No pudimos preparar esa foto. Elige otra." };
    if (base64.length > 5_600_000) return { error: "La foto es muy pesada. Recorta la boleta o elige otra imagen." };
    return { base64 };
  } catch {
    return { error: "No pudimos preparar esa foto. Elige otra o escribe el total." };
  }
}
