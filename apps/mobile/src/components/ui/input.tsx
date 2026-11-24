import * as React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { radii } from '@fastbuild/tokens';
import { useTheme } from '../../theme/theme-context';

export interface InputProps extends TextInputProps {
  readonly label?: string;
  readonly error?: string;
  readonly className?: string;
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly style?: StyleProp<TextStyle>;
}

export function Input({
  label,
  error,
  className,
  containerStyle,
  style,
  editable = true,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.ring
      : colors.input;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      ) : null}
      <TextInput
        editable={editable}
        placeholderTextColor={colors.mutedForeground}
        className={className}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            borderColor,
            color: colors.foreground,
            backgroundColor: editable ? colors.background : colors.muted,
          },
          !editable ? styles.disabled : null,
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    fontSize: 12,
  },
});
