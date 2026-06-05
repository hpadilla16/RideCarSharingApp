import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { logError } from '../lib/logger';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

const PHOTO_SLOT_IDS = ['front', 'back', 'left', 'right', 'interior', 'dashboard', 'damage'];

interface PhotoEntry {
  uri: string;
  dataUrl: string | null;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function assetToEntry(asset: ImagePicker.ImagePickerAsset): PhotoEntry {
  // Keep uri for display; build a base64 data URL for upload.
  const mime = asset.mimeType || 'image/jpeg';
  return {
    uri: asset.uri,
    dataUrl: asset.base64 ? `data:${mime};base64,${asset.base64}` : null,
  };
}

export default function InspectionScreen() {
  const { t } = useTranslation();
  const { tripCode, phase } = useLocalSearchParams<{ tripCode?: string; phase?: string }>();
  const PHOTO_SLOTS = PHOTO_SLOT_IDS.map((id) => ({ id, label: t(`inspection.slot_${id}`) }));
  const router = useRouter();
  const [photos, setPhotos] = useState<Record<string, PhotoEntry>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function takePhoto(slotId: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('inspection.cameraPermissionTitle'), t('inspection.cameraPermissionBody'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: false,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => ({ ...prev, [slotId]: assetToEntry(result.assets[0]) }));
    }
  }

  async function pickFromGallery(slotId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('inspection.galleryPermissionTitle'), t('inspection.galleryPermissionBody'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: false,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => ({ ...prev, [slotId]: assetToEntry(result.assets[0]) }));
    }
  }

  async function handleSubmit() {
    const photoCount = Object.keys(photos).length;
    if (photoCount < 4) {
      Alert.alert(t('inspection.morePhotosTitle'), t('inspection.morePhotosBody'));
      return;
    }
    if (!tripCode) {
      Alert.alert(t('inspection.missingTripTitle'), t('inspection.missingTripBody'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body: { phase: string; photos: Record<string, string> } = { phase: phase === 'RETURN' ? 'RETURN' : 'PICKUP', photos: {} };
      for (const [slot, entry] of Object.entries(photos)) {
        if (entry?.dataUrl) body.photos[slot] = entry.dataUrl;
      }
      await api(`/api/public/booking/trips/${encodeURIComponent(tripCode)}/inspection-photos`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setDone(true);
    } catch (err) {
      logError(err, { screen: 'inspection', tripCode });
      setError(errMsg(err) || t('inspection.uploadFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>✅</Text>
        <Text style={styles.title}>{t('inspection.completeTitle')}</Text>
        <Text style={styles.subtitle}>{t('inspection.photosCaptured', { count: Object.keys(photos).length, tripCode: tripCode || '' })}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>{t('inspection.title')}</Text>
      <Text style={styles.subtitle}>
        {t('inspection.subtitle')}
      </Text>
      {tripCode && <Text style={styles.tripCode}>{t('inspection.trip', { tripCode })}</Text>}

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {PHOTO_SLOTS.map((slot) => (
          <View key={slot.id} style={styles.slot}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotLabel}>{slot.label}</Text>
              {photos[slot.id] && <Text style={styles.slotCheck}>✓</Text>}
            </View>
            {photos[slot.id] ? (
              <View>
                <Image source={{ uri: photos[slot.id].uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={t('inspection.photoA11y', { label: slot.label })} />
                <TouchableOpacity onPress={() => setPhotos((p) => { const next = { ...p }; delete next[slot.id]; return next; })} accessibilityRole="button" accessibilityLabel={t('inspection.retakeA11y', { label: slot.label })}>
                  <Text style={styles.retake}>{t('inspection.retake')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.cameraBtn} onPress={() => takePhoto(slot.id)} accessibilityRole="button" accessibilityLabel={t('inspection.cameraA11y', { label: slot.label })}>
                  <Text style={styles.cameraBtnText}>{t('inspection.camera')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.galleryBtn} onPress={() => pickFromGallery(slot.id)} accessibilityRole="button" accessibilityLabel={t('inspection.galleryA11y', { label: slot.label })}>
                  <Text style={styles.galleryBtnText}>{t('inspection.gallery')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{t('inspection.photosTaken', { count: Object.keys(photos).length, total: PHOTO_SLOTS.length })}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, Object.keys(photos).length < 4 && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{submitting ? t('inspection.submitting') : t('inspection.completeInspection')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: fontSize.md, color: colors.muted, lineHeight: 22, marginTop: spacing.xs },
  tripCode: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '700', marginTop: spacing.sm },
  slot: { backgroundColor: colors.card, borderRadius: 14, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  slotLabel: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md },
  slotCheck: { color: colors.success, fontWeight: '800', fontSize: fontSize.lg },
  photo: { width: '100%', height: 200, borderRadius: 10 },
  retake: { color: colors.brand, fontWeight: '600', fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
  photoActions: { flexDirection: 'row', gap: spacing.sm },
  cameraBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  cameraBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  galleryBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  galleryBtnText: { color: colors.ink, fontWeight: '600', fontSize: fontSize.sm },
  summary: { paddingVertical: spacing.md, alignItems: 'center' },
  summaryText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.sm },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
