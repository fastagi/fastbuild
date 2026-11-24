import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_MESSAGES, I18N_KEYS } from '@fastbuild/core';
import { BRAND_NAME, spacing } from '@fastbuild/tokens';
import { useAuth } from '../src/auth/auth-context';
import { mapApiErrorToMessage, validateSignInInput } from '../src/auth/native-session';
import {
  Badge,
  BrandMark,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '../src/components/ui';
import { useTheme } from '../src/theme/theme-context';

export default function LoginScreen() {
  const { signIn, apiBaseUrl } = useAuth();
  const { colors } = useTheme();

  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [identifierError, setIdentifierError] = React.useState<string | undefined>();
  const [passwordError, setPasswordError] = React.useState<string | undefined>();
  const [submitError, setSubmitError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitError(undefined);
    const validation = validateSignInInput(identifier, password);
    setIdentifierError(validation.identifierError);
    setPasswordError(validation.passwordError);

    if (!validation.valid) {
      return;
    }

    setSubmitting(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (error) {
      setSubmitError(mapApiErrorToMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <BrandMark size="lg" />
            <View style={styles.brandText}>
              <Text style={[styles.brandName, { color: colors.foreground }]}>{BRAND_NAME}</Text>
              <Badge variant="secondary">Mobile</Badge>
            </View>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>{DEFAULT_MESSAGES[I18N_KEYS.auth.signIn]}</CardTitle>
              <CardDescription>
                Authenticate with your FastBuild account using rotating native bearer tokens.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Input
                label={`${DEFAULT_MESSAGES[I18N_KEYS.auth.username]} or ${DEFAULT_MESSAGES[I18N_KEYS.auth.email]}`}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                value={identifier}
                onChangeText={setIdentifier}
                error={identifierError}
              />

              <Input
                label={DEFAULT_MESSAGES[I18N_KEYS.auth.password]}
                placeholder="Enter your password"
                secureTextEntry
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                error={passwordError}
              />

              {submitError ? (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: colors.dangerSubtle,
                      borderColor: colors.danger,
                    },
                  ]}
                >
                  <Text style={[styles.errorText, { color: colors.dangerStrong }]}>
                    {submitError}
                  </Text>
                </View>
              ) : null}

              <Button loading={submitting} onPress={handleSubmit}>
                {DEFAULT_MESSAGES[I18N_KEYS.auth.signIn]}
              </Button>
            </CardContent>
          </Card>

          <Text style={[styles.endpointHint, { color: colors.mutedForeground }]}>
            API endpoint: {apiBaseUrl}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  endpointHint: {
    textAlign: 'center',
    fontSize: 12,
  },
});
