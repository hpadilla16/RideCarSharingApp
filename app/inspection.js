import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fontSize } from '../lib/theme';

const PHOTO_SLOTS = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left Side' },
  { id: 'right', label: 'Right Side' },
  { id: 'interior', label: 'Interior' },
  { id: 'dashboard', label: 'Dashboard / Mileage' },
  { id: 'damage', label: 'Existing Damage (if any)' },
];

export default function InspectionScreen() {
  const { tripCode } = useLocalSearchParams();
  const router = useRouter();
  const [photos, setPhotos] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function takePhoto(slotId) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is required to take inspection photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => ({ ...prev, [slotId]: result.assets[0].uri }));
    }
  }

  async function pickFromGallery(slotId) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Gallery Permission', 'Gallery access is required to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => ({ ...prev, [slotId]: result.assets[0].uri }));
    }
  }

  function handleSubmit() {
    const photoCount = Object.keys(photos).length;
    if (photoCount < 4) {
      Alert.alert('More Photos Needed', 'Please take at least 4 photos (front, back, left, right) before submitting.');
      return;
    }
    setSubmitting(true);
    // In production: upload photos to backend
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
    }, 1500);
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>✅</Text>
        <Text style={styles.title}>Inspection Complete</Text>
        <Text style={styles.subtitle}>{Object.keys(photos).length} photos captured for trip {tripCode || ''}.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>Vehicle Inspection</Text>
      <Text style={styles.subtitle}>
        Take photos of the vehicle before your trip. This protects both you and the host in case of disputes.
      </Text>
      {tripCode && <Text style={styles.tripCode}>Trip: {tripCode}</Text>}

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {PHOTO_SLOTS.map((slot) => (
          <View key={slot.id} style={styles.slot}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotLabel}>{slot.label}</Text>
              {photos[slot.id] && <Text style={styles.slotCheck}>✓</Text>}
            </View>
            {photos[slot.id] ? (
              <View>
                <Image source={{ uri: photos[slot.id] }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity onPress={() => setPhotos((p) => { const next = { ...p }; delete next[slot.id]; return next; })}>
                  <Text style={styles.retake}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.cameraBtn} onPress={() => takePhoto(slot.id)}>
                  <Text style={styles.cameraBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.galleryBtn} onPress={() => pickFromGallery(slot.id)}>
                  <Text style={styles.galleryBtnText}>🖼 Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{Object.keys(photos).length} of {PHOTO_SLOTS.length} photos taken</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, Object.keys(photos).length < 4 && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.btnText}>{submitting ? 'Submitting...' : 'Complete Inspection'}</Text>
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
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
