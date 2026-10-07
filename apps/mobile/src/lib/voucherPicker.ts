import * as ImagePicker from "expo-image-picker";

export const VOUCHER_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Picks a Yape/Plin screenshot (gallery) or a photo of a voucher (camera) as compressed JPEG.
 * Returns null when the person cancels.
 */
export async function pickVoucherImage(camera: boolean): Promise<{ base64: string; uri: string } | { error: string } | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    return { error: "Sin permiso de cámara. Puedes elegir la captura desde tu galería." };
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.6, allowsEditing: false };
  const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset?.base64) return { error: "No pudimos abrir esa imagen. Elige otra captura." };
  if (asset.base64.length * 0.75 > VOUCHER_MAX_BYTES) return { error: "La captura pesa más de 3 MB. Recórtala o toma una nueva." };
  return { base64: asset.base64, uri: asset.uri };
}
