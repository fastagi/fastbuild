import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_MESSAGES, I18N_KEYS } from '@fastbuild/core';
import { spacing } from '@fastbuild/tokens';
import { useAuth } from '../../src/auth/auth-context';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '../../src/components/ui';
import { useTheme } from '../../src/theme/theme-context';

export default function SettingsScreen() {
  const { apiBaseUrl, setApiBaseUrl, signOut } = useAuth();
  const { mode, colors, toggleMode } = useTheme();

  const [urlDraft, setUrlDraft] = React.useState(apiBaseUrl);
  const [savedNotice, setSavedNotice] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    setUrlDraft(apiBaseUrl);
  }, [apiBaseUrl]);

  function handleSaveApiUrl() {
    setApiBaseUrl(urlDraft);
    setSavedNotice(true);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card>
        <CardHeader>
          <View style={styles.row}>
            <CardTitle>Appearance</CardTitle>
            <Badge variant="outline">{mode === 'dark' ? 'Obsidian Dark' : 'Alabaster Light'}</Badge>
          </View>
          <CardDescription>
            Switch between FastBuild zero-chroma obsidian dark and alabaster light palettes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onPress={toggleMode}>
            Switch to {mode === 'dark' ? 'Light' : 'Dark'} Mode
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Connection</CardTitle>
          <CardDescription>
            Base URL for the FastBuild Go backend (used for native auth and health probes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            label="API Base URL"
            placeholder="http://localhost:8080"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={urlDraft}
            onChangeText={(text) => {
              setUrlDraft(text);
              setSavedNotice(false);
            }}
          />
          {savedNotice ? (
            <Text style={[styles.savedText, { color: colors.success }]}>
              API endpoint updated to {apiBaseUrl}.
            </Text>
          ) : null}
          <Button variant="outline" onPress={handleSaveApiUrl}>
            {DEFAULT_MESSAGES[I18N_KEYS.common.save]}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Revoke your rotating refresh token on the server and clear secure device storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" loading={signingOut} onPress={handleSignOut}>
            {DEFAULT_MESSAGES[I18N_KEYS.auth.signOut]}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  savedText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
