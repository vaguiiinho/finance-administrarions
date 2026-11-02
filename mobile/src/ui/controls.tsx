import { forwardRef, useState, type ComponentRef, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH, radius, space } from './tokens';

/** Fundo da tela com rolagem e area segura (a barra de navegacao e do Stack nativo). */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const { palette } = useTheme();
  const body = scroll ? (
    <ScrollView
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ padding: space.lg, gap: space.lg }, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges ?? ['left', 'right']} style={{ flex: 1, backgroundColor: palette.bg }}>
      {body}
    </SafeAreaView>
  );
}

export function Card({ children, style, accent, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean; testID?: string }) {
  const { palette } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: accent ? palette.accent : palette.border,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  /** Texto visivel durante o envio; o nome acessivel continua `title` (nome estavel para o leitor de tela). */
  busy?: boolean;
  busyTitle?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  fullWidth?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  busyTitle,
  accessibilityLabel,
  accessibilityHint,
  fullWidth = true,
  testID,
}: ButtonProps) {
  const { palette } = useTheme();
  const inactive = disabled || busy;
  const bg = kind === 'primary' ? (disabled ? palette.surface2 : palette.primary) : kind === 'secondary' ? palette.surface : 'transparent';
  const border = kind === 'primary' ? (disabled ? palette.border : palette.primaryBorder) : kind === 'secondary' ? palette.borderStrong : 'transparent';
  const tone = disabled ? 'disabled' : kind === 'primary' ? 'onPrimary' : kind === 'destructive' ? 'danger' : 'accent';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={!!disabled}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: pressed && !inactive ? palette.surface2 : bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          gap: space.sm,
        },
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
      ]}
    >
      {busy ? <ActivityIndicator color={palette.onPrimary} accessibilityElementsHidden /> : null}
      <Text variant="headline" tone={tone} accessible={false}>
        {busy && busyTitle ? busyTitle : title}
      </Text>
    </Pressable>
  );
}

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  help?: string;
  prefix?: string;
  trailing?: ReactNode;
  disabled?: boolean;
}

/** Campo com rotulo visivel acima e `accessibilityLabel` igual ao rotulo; erro e ajuda logo abaixo. */
export type TextInputRef = ComponentRef<typeof TextInput>;

export const Field = forwardRef<TextInputRef, FieldProps>(function Field({ label, error, help, prefix, trailing, disabled, editable = true, ...rest }, ref) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  const locked = disabled || editable === false;
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }} accessible={false}>
        {label}
      </Text>
      <View
        style={{
          minHeight: MIN_TOUCH,
          borderRadius: radius.md,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? palette.danger : focused ? palette.accent : palette.borderStrong,
          backgroundColor: locked ? palette.surface2 : palette.inputBg,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.md,
        }}
      >
        {prefix ? (
          <Text tone="muted" style={{ marginRight: space.sm }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityState={{ disabled: locked }}
          editable={!locked}
          placeholderTextColor={palette.textDisabled}
          allowFontScaling
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={{ flex: 1, minHeight: MIN_TOUCH, fontSize: 17, color: locked ? palette.textDisabled : palette.text }}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {help ? (
        <Text variant="footnote" tone="muted">
          {help}
        </Text>
      ) : null}
    </View>
  );
});

export const PasswordField = forwardRef<TextInputRef, Omit<FieldProps, 'secureTextEntry' | 'trailing'>>(function PasswordField({ label, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      label={label}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostrar senha"
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((v) => !v)}
          style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text variant="footnote" tone="accent" accessible={false}>
            {visible ? 'Ocultar' : 'Mostrar'}
          </Text>
        </Pressable>
      }
      {...rest}
    />
  );
});

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: palette.surface2, borderRadius: radius.md, padding: 2 }}>
      {options.map((option) => {
        const selected = option.value === value;
        const off = option.disabled || disabled;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled: !!off }}
            disabled={!!off}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH - 4,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: selected ? palette.surface : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: palette.border,
              paddingHorizontal: space.sm,
            }}
          >
            <Text
              variant="subheadline"
              tone={off ? 'disabled' : selected ? 'accent' : 'text'}
              style={selected ? { fontWeight: '600' } : undefined}
              accessible={false}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Linha com interruptor ("Ainda nao paguei"). O alvo inteiro e um botao `switch`. */
export function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}
    >
      <Text accessible={false}>{label}</Text>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} trackColor={{ true: palette.primary }} />
      </View>
    </Pressable>
  );
}

/** Aviso em linha: informativo (borda accent) ou de erro (borda danger, role alert). */
export function InlineAlert({
  children,
  tone = 'error',
  onClose,
  closeLabel = 'Fechar aviso',
}: {
  children: ReactNode;
  tone?: 'error' | 'info';
  onClose?: () => void;
  closeLabel?: string;
}) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: tone === 'error' ? palette.danger : palette.accent,
        borderRadius: radius.md,
        padding: space.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
      }}
    >
      <View style={{ flex: 1, gap: space.xs }}>
        {typeof children === 'string' ? (
          // O papel "alert" fica no texto (acessivel), nao no contêiner: o botao de fechar continua alcancavel pelo VoiceOver.
          <Text
            variant="subheadline"
            tone={tone === 'error' ? 'danger' : 'text'}
            accessible
            accessibilityRole={tone === 'error' ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', margin: -space.md }}
        >
          <Text tone="muted" accessible={false}>
            ✕
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  const { palette } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border }} />;
}
