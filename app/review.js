import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

function StarSelector({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginVertical: spacing.md }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} accessibilityRole="button" accessibilityLabel={t('review.rateStarsA11y', { count: star })} accessibilityState={{ selected: star <= value }}>
          <Text style={{ fontSize: 36, color: star <= value ? '#f5a623' : '#d1d5db' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { token: reviewToken } = useLocalSearchParams();
  const router = useRouter();
  const [prompt, setPrompt] = useState(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reviewToken) return;
    (async () => {
      try {
        const data = await api(`/api/public/booking/host-reviews/${encodeURIComponent(reviewToken)}`);
        setPrompt(data);
        if (data?.review?.status === 'SUBMITTED') {
          setRating(data.review.rating || 0);
          setComments(data.review.comments || '');
          setSuccess(true);
        }
      } catch (err) {
        setError(err?.message || t('review.unableToLoad'));
      } finally {
        setLoading(false);
      }
    })();
  }, [reviewToken]);

  async function handleSubmit() {
    if (rating < 1) { setError(t('review.selectRating')); return; }
    setSubmitting(true);
    setError('');
    try {
      await api(`/api/public/booking/host-reviews/${encodeURIComponent(reviewToken)}`, {
        method: 'POST',
        body: JSON.stringify({ rating, comments: comments.trim() || null }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err?.message || t('review.unableToSubmit'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={styles.center}><Text style={styles.muted}>{t('common.loading')}</Text></View>;

  if (success) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>⭐</Text>
        <Text style={styles.title}>{t('review.submittedTitle')}</Text>
        <Text style={styles.subtitle}>{t('review.submittedBody')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>{t('review.title')}</Text>

      {prompt?.trip && (
        <View style={styles.tripCard}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{prompt.trip.listingTitle || prompt.trip.tripCode}</Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{prompt.trip.vehicleLabel}</Text>
        </View>
      )}

      {prompt?.host && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(prompt.host.displayName || '?')[0].toUpperCase()}</Text></View>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{prompt.host.displayName}</Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>{t('review.experienceQuestion')}</Text>
      <StarSelector value={rating} onChange={setRating} />

      <Text style={styles.label}>{t('review.commentsOptional')}</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        placeholder={t('review.commentsPlaceholder')}
        placeholderTextColor={colors.muted}
        value={comments}
        onChangeText={setComments}
        multiline
        accessibilityLabel={t('review.commentsA11y')}
      />

      <TouchableOpacity style={[styles.btn, rating < 1 && { opacity: 0.5 }]} onPress={handleSubmit} disabled={submitting || rating < 1} accessibilityRole="button">
        <Text style={styles.btnText}>{submitting ? t('review.submitting') : t('review.submitReview')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
  muted: { color: colors.muted },
  error: { color: colors.error, marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, backgroundColor: colors.card, color: colors.ink, marginBottom: spacing.md },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  tripCard: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: fontSize.lg },
});
