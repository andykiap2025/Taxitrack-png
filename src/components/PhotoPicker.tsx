import * as ImagePicker from 'expo-image-picker';
import { Camera, ImageIcon } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, radius, spacing, type } from '@/lib/theme';

export type PickedPhoto = { base64: string; uri: string };

type Props = {
  label: string;
  photo: PickedPhoto | null;
  onPicked: (photo: PickedPhoto) => void;
  /** Signed URL of an already-saved photo (shown until replaced). */
  existingUrl?: string | null;
  /** Square crop for face photos. */
  square?: boolean;
};

/** Labelled camera/gallery picker with preview, used by all photo fields. */
export function PhotoPicker({ label, photo, onPicked, existingUrl, square = false }: Props) {
  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const options: ImagePicker.ImagePickerOptions = {
      quality: 0.5,
      base64: true,
      allowsEditing: square,
      ...(square ? { aspect: [1, 1] as [number, number] } : {}),
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      onPicked({ base64: asset.base64, uri: asset.uri });
    }
  };

  const previewUri = photo?.uri ?? existingUrl ?? null;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={[styles.preview, square && styles.previewSquare]}
        />
      ) : null}
      <View style={styles.buttons}>
        <Button
          title="Camera"
          variant="outline"
          size="sm"
          icon={<Camera color={colors.primary} size={16} />}
          onPress={() => pick(true)}
          style={styles.flex}
        />
        <Button
          title="Gallery"
          variant="outline"
          size="sm"
          icon={<ImageIcon color={colors.primary} size={16} />}
          onPress={() => pick(false)}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.label,
    marginBottom: spacing.xxs,
  },
  preview: {
    width: '100%',
    height: 150,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  previewSquare: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
  },
});
