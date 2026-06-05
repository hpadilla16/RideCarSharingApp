import { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { logError } from '../lib/logger';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logError(error, { componentStack: info?.componentStack, source: 'ErrorBoundary' });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>An unexpected error occurred. Please try again.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null })} accessibilityRole="button">
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  btn: { height: 48, paddingHorizontal: 32, borderRadius: 14, backgroundColor: '#8752FE', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
