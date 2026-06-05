import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { hostApi, readHostSession } from '../../lib/hostApi';
import { fmtMoney } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { logError } from '../../lib/logger';

export default function HostListingsScreen() {
  const router = useRouter();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { token } = await readHostSession();
      if (!token) { router.replace('/host/login'); return; }
      try {
        const data = await hostApi('/dashboard');
        setListings(data?.listings || []);
      } catch (err) {
        logError(err, { screen: 'host/listings' });
        setMsg('Unable to load listings. Pull to refresh or try again later.');
      } finally { setLoading(false); }
    })();
  }, []);

  function startEdit(l) {
    setEditId(l.id);
    setEditForm({ title: l.title || '', baseDailyRate: l.baseDailyRate || '', status: l.status || 'DRAFT', description: l.description || '', instantBook: !!l.instantBook });
  }

  async function saveEdit() {
    try {
      await hostApi(`/listings/${editId}`, { method: 'PATCH', body: JSON.stringify({ ...editForm, baseDailyRate: Number(editForm.baseDailyRate) }) });
      setMsg('Listing updated');
      setEditId(null);
      const data = await hostApi('/dashboard');
      setListings(data?.listings || []);
    } catch (err) { setMsg(err.message); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.brand, fontWeight: '600', marginBottom: spacing.md }}>← Dashboard</Text></TouchableOpacity>
      <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.lg }}>My Listings</Text>
      {msg ? <Text style={{ color: msg.includes('updated') ? colors.success : colors.error, marginBottom: spacing.md }}>{msg}</Text> : null}
      {loading && <Text style={{ color: colors.muted }}>Loading...</Text>}
      {listings.map((l) => (
        <View key={l.id} style={styles.card}>
          {editId === l.id ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput style={styles.input} value={editForm.title} onChangeText={(v) => setEditForm((f) => ({ ...f, title: v }))} placeholder="Title" />
              <TextInput style={styles.input} value={String(editForm.baseDailyRate)} onChangeText={(v) => setEditForm((f) => ({ ...f, baseDailyRate: v }))} placeholder="Daily Rate" keyboardType="numeric" />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}><Text style={{ color: colors.white, fontWeight: '700' }}>Save</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEditId(null)}><Text style={{ color: colors.muted, padding: spacing.sm }}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{l.title || 'Untitled'}</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{fmtMoney(l.baseDailyRate)}/day · {l.status}</Text>
              </View>
              <TouchableOpacity onPress={() => startEdit(l)} style={styles.editBtn}><Text style={{ color: colors.brand, fontWeight: '600', fontSize: fontSize.sm }}>Edit</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {!loading && !listings.length && <Text style={{ color: colors.muted }}>No listings yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, elevation: 1 },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.sm, backgroundColor: colors.bg },
  saveBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 10, backgroundColor: colors.brand },
  editBtn: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
});
