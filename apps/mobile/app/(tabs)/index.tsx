import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HealthReport, HealthStatus } from '@fastbuild/api-client';
import { DEFAULT_MESSAGES, I18N_KEYS } from '@fastbuild/core';
import { BRAND_NAME, spacing } from '@fastbuild/tokens';
import { useAuth } from '../../src/auth/auth-context';
import { fetchApiHealth, mapApiErrorToMessage } from '../../src/auth/native-session';
import {
  Badge,
  BrandMark,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusDot,
  type StatusTone,
} from '../../src/components/ui';
import { useTheme } from '../../src/theme/theme-context';

function healthToTone(status?: HealthStatus): StatusTone {
  switch (status) {
    case 'up':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'down':
      return 'danger';
    default:
      return 'neutral';
  }
}

function healthToLabel(status?: HealthStatus): string {
  switch (status) {
    case 'up':
      return DEFAULT_MESSAGES[I18N_KEYS.status.up] ?? 'Operational';
    case 'degraded':
      return DEFAULT_MESSAGES[I18N_KEYS.status.degraded] ?? 'Degraded';
    case 'down':
      return DEFAULT_MESSAGES[I18N_KEYS.status.down] ?? 'Unavailable';
    default:
      return 'Unknown';
  }
}

function userStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return DEFAULT_MESSAGES[I18N_KEYS.status.active] ?? 'Active';
    case 0:
      return DEFAULT_MESSAGES[I18N_KEYS.status.disabled] ?? 'Disabled';
    case 2:
      return DEFAULT_MESSAGES[I18N_KEYS.status.pending] ?? 'Pending';
    case 3:
      return DEFAULT_MESSAGES[I18N_KEYS.status.banned] ?? 'Banned';
    default:
      return 'Unknown';
  }
}

export default function OverviewScreen() {
  const { user, client, apiBaseUrl, refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [health, setHealth] = React.useState<HealthReport | null>(null);
  const [healthError, setHealthError] = React.useState<string | null>(null);
  const [loadingHealth, setLoadingHealth] = React.useState(false);
  const [refreshingUser, setRefreshingUser] = React.useState(false);

  const loadHealth = React.useCallback(async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const report = await fetchApiHealth(client);
      setHealth(report);
    } catch (error) {
      setHealth(null);
      setHealthError(mapApiErrorToMessage(error));
    } finally {
      setLoadingHealth(false);
    }
  }, [client]);

  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  async function handleRefreshProfile() {
    setRefreshingUser(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshingUser(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <BrandMark size="md" />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>{BRAND_NAME}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{apiBaseUrl}</Text>
        </View>
      </View>

      <Card>
        <CardHeader>
          <View style={styles.cardHeaderRow}>
            <CardTitle>API Health</CardTitle>
            <StatusDot
              tone={healthError ? 'danger' : healthToTone(health?.status)}
              label={healthError ? 'Unreachable' : healthToLabel(health?.status)}
            />
          </View>
          <CardDescription>Live probe against /health on the configured backend.</CardDescription>
        </CardHeader>
        <CardContent>
          {healthError ? (
            <Text style={[styles.metaText, { color: colors.danger }]}>{healthError}</Text>
          ) : health ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              Last checked: {health.timestamp}
            </Text>
          ) : (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              Checking backend status...
            </Text>
          )}
          <Button variant="outline" size="sm" loading={loadingHealth} onPress={loadHealth}>
            Refresh Health
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={styles.cardHeaderRow}>
            <CardTitle>Signed-In Account</CardTitle>
            {user ? <Badge variant="secondary">{userStatusLabel(user.status)}</Badge> : null}
          </View>
          <CardDescription>Authenticated via native rotating bearer session.</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <View style={styles.profileList}>
              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                  Username
                </Text>
                <Text style={[styles.profileValue, { color: colors.foreground }]}>
                  {user.username}
                </Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>Email</Text>
                <Text style={[styles.profileValue, { color: colors.foreground }]}>
                  {user.email}
                </Text>
              </View>
              {user.nickname ? (
                <View style={styles.profileRow}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    Nickname
                  </Text>
                  <Text style={[styles.profileValue, { color: colors.foreground }]}>
                    {user.nickname}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              No active user profile loaded.
            </Text>
          )}
          <Button variant="secondary" size="sm" loading={refreshingUser} onPress={handleRefreshProfile}>
            Sync Profile
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaText: {
    fontSize: 13,
  },
  profileList: {
    gap: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileLabel: {
    fontSize: 13,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
