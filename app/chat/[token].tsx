import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import EventSource from 'react-native-sse';
import { api } from '../../lib/api';
import { API_BASE } from '../../lib/config';
import { logWarn } from '../../lib/logger';
import { fmtDateTime } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

// Fallback polling cadence when the SSE stream is unavailable.
const POLL_INTERVAL = 15000;

interface ChatMessage {
  id: string;
  body?: string;
  senderType?: string;
  senderName?: string;
  createdAt?: string;
  readAt?: string | null;
  [key: string]: unknown;
}

interface ChatRoom {
  role?: string;
  tripCode?: string;
  tripStatus?: string;
  guestName?: string;
  hostName?: string;
  pickupAddress?: string;
  pickupInstructions?: string;
  closedAt?: string | null;
  messages?: ChatMessage[];
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function TripChatScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [newMsg, setNewMsg] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [showPickup, setShowPickup] = useState<boolean>(false);
  const [pickupForm, setPickupForm] = useState<{ address: string; instructions: string }>({ address: '', instructions: '' });
  const [showReport, setShowReport] = useState<boolean>(false);
  const [reportForm, setReportForm] = useState<{ issueType: string; description: string }>({ issueType: 'SERVICE', description: '' });
  const [reportMsg, setReportMsg] = useState<string>('');
  const scrollRef = useRef<ScrollView | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chatPath = `/api/public/booking/trip-chat/${encodeURIComponent(token || '')}`;

  async function loadRoom() {
    try {
      const data = await api<ChatRoom>(chatPath);
      setRoom(data);
      setError('');
    } catch (err) {
      setError(errMsg(err) || t('chat.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadRoom();
    api(`${chatPath}/read`, { method: 'POST' }).catch(() => {});

    // Real-time via the backend's SSE stream; polling only as fallback.
    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        api<ChatRoom>(chatPath).then(setRoom).catch(() => {});
      }, POLL_INTERVAL);
    };
    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_BASE}${chatPath}/stream`);
      es.addEventListener('open', () => stopPolling());
      es.addEventListener('message', (e) => {
        // Backend broadcasts each new message (excluding the sender's own
        // role, which already appended locally on send).
        try {
          const msg: ChatMessage = JSON.parse(e.data || 'null');
          if (msg?.id) {
            setRoom((r) => {
              if (!r) return r;
              const existing = r.messages || [];
              if (existing.some((m) => m.id === msg.id)) return r;
              return { ...r, messages: [...existing, msg] };
            });
          }
        } catch {
          // Malformed event — ignore; polling fallback will reconcile.
        }
      });
      es.addEventListener('error', () => {
        // Stream dropped (offline, server restart) — fall back to polling.
        startPolling();
      });
    } catch (err) {
      logWarn('SSE unavailable, falling back to polling: ' + errMsg(err));
      startPolling();
    }

    return () => {
      stopPolling();
      if (es) {
        es.removeAllEventListeners();
        es.close();
      }
    };
  }, [token]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [room?.messages?.length]);

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(`${chatPath}/messages`, { method: 'POST', body: JSON.stringify({ body: newMsg.trim() }) });
      setRoom((r) => r ? { ...r, messages: [...(r.messages || []), msg] } : r);
      setNewMsg('');
    } catch (err) {
      setError(errMsg(err) || t('chat.unableToSend'));
    } finally {
      setSending(false);
    }
  }

  async function sendHotAction(action: string) {
    try {
      const msg = await api<ChatMessage>(`${chatPath}/action`, { method: 'POST', body: JSON.stringify({ action }) });
      setRoom((r) => r ? { ...r, messages: [...(r.messages || []), msg] } : r);
    } catch (err) { setError(errMsg(err) || t('chat.unableToSend')); }
  }

  async function savePickup() {
    try {
      await api(`${chatPath}/pickup`, { method: 'PATCH', body: JSON.stringify(pickupForm) });
      setShowPickup(false);
      loadRoom();
    } catch (err) { setError(errMsg(err) || t('chat.unableToUpdate')); }
  }

  async function submitReport() {
    if (!reportForm.description.trim()) { setReportMsg(t('chat.describeIssue')); return; }
    try {
      const result = await api<{ ticketRef?: string }>(`${chatPath}/report-issue`, { method: 'POST', body: JSON.stringify(reportForm) });
      setReportMsg(t('chat.ticketCreated', { ticketRef: result.ticketRef }));
      setShowReport(false);
      loadRoom();
    } catch (err) { setReportMsg(errMsg(err) || t('chat.failed')); }
  }

  if (loading) return <View style={styles.center}><Text style={styles.muted}>{t('chat.loadingChat')}</Text></View>;
  if (error && !room) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!room) return null;

  const isHost = room.role === 'HOST';
  const otherName = isHost ? room.guestName : room.hostName;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{room.tripCode || t('chat.tripChat')}</Text>
          <Text style={styles.headerSub}>{isHost ? t('chat.withGuest', { name: otherName }) : t('chat.withHost', { name: otherName })}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: room.tripStatus === 'CONFIRMED' ? '#0fb0d822' : room.tripStatus === 'IN_PROGRESS' ? '#10b98122' : '#6b7a9a22' }]}>
          <Text style={styles.statusText}>{(room.tripStatus || '').replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {/* Pickup details */}
      {(room.pickupAddress || room.pickupInstructions) && (
        <View style={styles.pickupCard}>
          <Text style={styles.pickupTitle}>{t('chat.pickupDetails')}</Text>
          {room.pickupAddress && <Text style={styles.pickupText}>{room.pickupAddress}</Text>}
          {room.pickupInstructions && <Text style={[styles.pickupText, { color: colors.muted }]}>{room.pickupInstructions}</Text>}
        </View>
      )}

      {/* Hot buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hotRow} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        {!isHost && (
          <>
            <TouchableOpacity style={styles.hotBtn} onPress={() => sendHotAction('ARRIVED_PICKUP')} accessibilityRole="button" accessibilityLabel={t('chat.arrivedPickupA11y')}><Text style={styles.hotText}>{t('chat.atPickup')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.hotBtn} onPress={() => sendHotAction('ARRIVED_RETURN')} accessibilityRole="button" accessibilityLabel={t('chat.arrivedReturnA11y')}><Text style={styles.hotText}>{t('chat.atReturn')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.hotBtn} onPress={() => sendHotAction('RUNNING_LATE')} accessibilityRole="button" accessibilityLabel={t('chat.runningLateA11y')}><Text style={styles.hotText}>{t('chat.late')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.hotBtn} onPress={() => sendHotAction('NEED_HELP')} accessibilityRole="button" accessibilityLabel={t('chat.needHelpA11y')}><Text style={styles.hotText}>{t('chat.help')}</Text></TouchableOpacity>
          </>
        )}
        {isHost && (
          <>
            <TouchableOpacity style={styles.hotBtn} onPress={() => sendHotAction('VEHICLE_READY')} accessibilityRole="button" accessibilityLabel={t('chat.vehicleReadyA11y')}><Text style={styles.hotText}>{t('chat.ready')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.hotBtn} onPress={() => sendHotAction('VEHICLE_INSPECTED')} accessibilityRole="button" accessibilityLabel={t('chat.vehicleInspectedA11y')}><Text style={styles.hotText}>{t('chat.inspected')}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.hotBtn, { borderColor: colors.brand }]} onPress={() => setShowPickup(true)}><Text style={[styles.hotText, { color: colors.brand }]}>{t('chat.pickupBtn')}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.hotBtn, { borderColor: '#ef4444' }]} onPress={() => setShowReport(true)}><Text style={[styles.hotText, { color: '#ef4444' }]}>{t('chat.issueBtn')}</Text></TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Pickup form (host) */}
      {showPickup && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} accessibilityLabel={t('chat.pickupAddress')} placeholder={t('chat.pickupAddress')} value={pickupForm.address} onChangeText={(v) => setPickupForm((f) => ({ ...f, address: v }))} />
          <TextInput style={styles.input} accessibilityLabel={t('chat.instructionsForGuest')} placeholder={t('chat.instructionsForGuest')} value={pickupForm.instructions} onChangeText={(v) => setPickupForm((f) => ({ ...f, instructions: v }))} multiline />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={styles.formBtn} onPress={savePickup} accessibilityRole="button"><Text style={styles.formBtnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPickup(false)} accessibilityRole="button" accessibilityLabel={t('chat.cancelPickupA11y')}><Text style={{ color: colors.muted, padding: spacing.sm }}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Report form (host) */}
      {showReport && (
        <View style={styles.formCard}>
          <Text style={{ fontWeight: '700', color: colors.error, marginBottom: spacing.sm }}>{t('chat.reportIssue')}</Text>
          <TextInput style={styles.input} accessibilityLabel={t('chat.describeIssue')} placeholder={t('chat.describeIssuePlaceholder')} value={reportForm.description} onChangeText={(v) => setReportForm((f) => ({ ...f, description: v }))} multiline numberOfLines={3} />
          {reportMsg ? <Text style={{ color: reportMsg.includes('#') ? colors.success : colors.error, fontSize: fontSize.sm }}>{reportMsg}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.formBtn, { backgroundColor: colors.error }]} onPress={submitReport} accessibilityRole="button"><Text style={styles.formBtnText}>{t('common.submit')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowReport(false); setReportMsg(''); }} accessibilityRole="button" accessibilityLabel={t('chat.cancelReportA11y')}><Text style={{ color: colors.muted, padding: spacing.sm }}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Messages */}
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}>
        {(room.messages || []).map((msg) => {
          if (msg.senderType === 'SYSTEM') {
            return <Text key={msg.id} style={styles.systemMsg}>{msg.body}</Text>;
          }
          const isOwn = (isHost && msg.senderType === 'HOST') || (!isHost && msg.senderType === 'GUEST');
          return (
            <View key={msg.id} style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={[styles.bubbleSender, isOwn && { color: 'rgba(255,255,255,0.7)' }]}>{msg.senderName || msg.senderType}</Text>
              <Text style={[styles.bubbleBody, isOwn && { color: colors.white }]}>{msg.body}</Text>
              <Text style={[styles.bubbleTime, isOwn && { color: 'rgba(255,255,255,0.5)' }]}>{fmtDateTime(msg.createdAt)}{msg.readAt && isOwn ? ' ✓' : ''}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Compose */}
      {!room.closedAt ? (
        <View style={styles.compose}>
          <TextInput style={styles.composeInput} value={newMsg} onChangeText={setNewMsg} placeholder={t('chat.messagePlaceholder')} placeholderTextColor={colors.muted} maxLength={5000} accessibilityLabel={t('chat.messageA11y')} />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sending || !newMsg.trim()} accessibilityRole="button" accessibilityLabel={t('chat.sendMessageA11y')}>
            <Text style={styles.sendBtnText}>{sending ? '...' : '→'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.closed}><Text style={styles.muted}>{t('chat.chatClosed')}</Text></View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  muted: { color: colors.muted },
  error: { color: colors.error },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontWeight: '800', fontSize: fontSize.lg, color: colors.ink },
  headerSub: { fontSize: fontSize.sm, color: colors.muted },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', color: colors.ink },
  pickupCard: { margin: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  pickupTitle: { fontWeight: '700', color: colors.success, marginBottom: 4 },
  pickupText: { fontSize: fontSize.sm, color: colors.ink },
  hotRow: { maxHeight: 44, marginBottom: spacing.xs },
  hotBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  hotText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.ink },
  formCard: { margin: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.sm, fontSize: fontSize.sm, backgroundColor: colors.bg },
  formBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 10, backgroundColor: colors.brand },
  formBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  messages: { flex: 1 },
  systemMsg: { textAlign: 'center', color: colors.muted, fontSize: fontSize.xs, fontStyle: 'italic', paddingVertical: spacing.xs },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: 16 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleSender: { fontSize: fontSize.xs, fontWeight: '600', color: colors.muted, marginBottom: 2 },
  bubbleBody: { fontSize: fontSize.sm, color: colors.ink, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: colors.muted, marginTop: 4, textAlign: 'right' },
  compose: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  composeInput: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: spacing.md, fontSize: fontSize.sm, backgroundColor: colors.bg },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.lg },
  closed: { padding: spacing.lg, alignItems: 'center' },
});
