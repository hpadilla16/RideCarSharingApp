import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { hostApi, readHostSession } from '../../lib/hostApi';
import { fmtMoney } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { logError } from '../../lib/logger';
import { useTranslation } from 'react-i18next';

const MAX_PHOTOS = 6;

interface HostListing {
  id: string;
  title?: string;
  baseDailyRate?: number | string | null;
  status?: string;
  description?: string;
  instantBook?: boolean;
  photosJson?: string;
  [key: string]: unknown;
}

interface EditForm {
  title?: string;
  baseDailyRate?: number | string;
  status?: string;
  description?: string;
  instantBook?: boolean;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function parsePhotos(listing: HostListing | null | undefined): string[] {
  try {
    const arr = JSON.parse(listing?.photosJson || '[]');
    return Array.isArray(arr) ? arr.filter(Boolean).slice(0, MAX_PHOTOS) : [];
  } catch {
    return [];
  }
}

export default function HostListingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { token } = await readHostSession();
      if (!token) { router.replace('/host/login'); return; }
      try {
        const data = await hostApi<{ listings?: HostListing[] }>('/dashboard');
        setListings(data?.listings || []);
      } catch (err) {
        logError(err, { screen: 'host/listings' });
        setMsg(t('hostListings.unableToLoad'));
      } finally { setLoading(false); }
    })();
  }, []);

  function startEdit(l: HostListing) {
    setEditId(l.id);
    setEditForm({ title: l.title || '', baseDailyRate: l.baseDailyRate || '', status: l.status || 'DRAFT', description: l.description || '', instantBook: !!l.instantBook });
    setEditPhotos(parsePhotos(l));
  }

  async function addPhoto() {
    if (editPhotos.length >= MAX_PHOTOS) {
      setMsg(t('hostListings.maxPhotos', { max: MAX_PHOTOS }));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: false,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      const a = result.assets[0];
      const dataUrl = `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`;
      setEditPhotos((p) => [...p, dataUrl].slice(0, MAX_PHOTOS));
    }
  }

  function removePhoto(idx: number) {
    setEditPhotos((p) => p.filter((_, i) => i !== idx));
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await hostApi(`/listings/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editForm,
          baseDailyRate: Number(editForm.baseDailyRate),
          photosJson: JSON.stringify(editPhotos),
        }),
      });
      setMsg(t('hostListings.updated'));
      setEditId(null);
      const data = await hostApi<{ listings?: HostListing[] }>('/dashboard');
      setListings(data?.listings || []);
    } catch (err) {
      setMsg(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('hostListings.backToDashboardA11y')}><Text style={{ color: colors.brand, fontWeight: '600', marginBottom: spacing.md }}>{t('hostListings.backToDashboard')}</Text></TouchableOpacity>
      <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.lg }}>{t('hostListings.title')}</Text>
      {msg ? <Text style={{ color: msg === t('hostListings.updated') ? colors.success : colors.error, marginBottom: spacing.md }}>{msg}</Text> : null}
      {loading && <Text style={{ color: colors.muted }}>{t('common.loading')}</Text>}
      {listings.map((l) => (
        <View key={l.id} style={styles.card}>
          {editId === l.id ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput style={styles.input} value={editForm.title} onChangeText={(v) => setEditForm((f) => ({ ...f, title: v }))} placeholder={t('hostListings.titleField')} accessibilityLabel={t('hostListings.titleField')} />
              <TextInput style={styles.input} value={String(editForm.baseDailyRate)} onChangeText={(v) => setEditForm((f) => ({ ...f, baseDailyRate: v }))} placeholder={t('hostListings.dailyRate')} keyboardType="numeric" accessibilityLabel={t('hostListings.dailyRate')} />

              {/* Photos */}
              <Text style={styles.photosLabel}>{t('hostListings.photos', { count: editPhotos.length, max: MAX_PHOTOS })}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {editPhotos.map((uri, idx) => (
                  <View key={idx} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={t('hostListings.photoA11y', { n: idx + 1 })} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(idx)} accessibilityRole="button" accessibilityLabel={t('hostListings.removePhotoA11y', { n: idx + 1 })}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                    {idx === 0 && <Text style={styles.photoPrimary}>{t('hostListings.primaryPhoto')}</Text>}
                  </View>
                ))}
                {editPhotos.length < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.photoAdd} onPress={addPhoto} accessibilityRole="button" accessibilityLabel={t('hostListings.addPhotoA11y')}>
                    <Text style={styles.photoAddText}>＋</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveEdit} disabled={saving} accessibilityRole="button" accessibilityLabel={t('hostListings.saveA11y')}><Text style={{ color: colors.white, fontWeight: '700' }}>{saving ? t('hostListings.saving') : t('common.save')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEditId(null)} accessibilityRole="button" accessibilityLabel={t('hostListings.cancelA11y')}><Text style={{ color: colors.muted, padding: spacing.sm }}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                {parsePhotos(l)[0] ? (
                  <Image source={{ uri: parsePhotos(l)[0] }} style={styles.thumb} resizeMode="cover" accessibilityLabel={l.title || t('hostListings.untitled')} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}><Text style={{ color: colors.muted, fontSize: fontSize.xs }}>{t('hostListings.noPhoto')}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }} numberOfLines={1}>{l.title || t('hostListings.untitled')}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{fmtMoney(l.baseDailyRate)}{t('common.perDay')} · {l.status}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => startEdit(l)} style={styles.editBtn} accessibilityRole="button" accessibilityLabel={t('hostListings.editA11y', { title: l.title || t('hostListings.untitled') })}><Text style={{ color: colors.brand, fontWeight: '600', fontSize: fontSize.sm }}>{t('hostListings.edit')}</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {!loading && !listings.length && <Text style={{ color: colors.muted }}>{t('hostListings.noListingsYet')}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, elevation: 1 },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.sm, backgroundColor: colors.bg },
  saveBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 10, backgroundColor: colors.brand },
  editBtn: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  thumb: { width: 56, height: 42, borderRadius: 8 },
  thumbEmpty: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  photosLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  photoWrap: { position: 'relative' },
  photo: { width: 110, height: 80, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoPrimary: { position: 'absolute', bottom: 4, left: 4, fontSize: 10, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  photoAdd: { width: 110, height: 80, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 28, color: colors.muted },
});
