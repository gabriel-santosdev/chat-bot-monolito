import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Paper, PasswordInput, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconMessages } from '@tabler/icons-react';
import { loginSchema, registerSchema } from '@shared/schemas';
import { useAuth } from '@/auth/AuthProvider';
import { ColorSchemeToggle } from '@/components/ColorSchemeToggle/ColorSchemeToggle';
import { errorMessage } from '@/lib/api';
import './AuthScreen.scss';

type Mode = 'login' | 'register';
type FieldErrors = Partial<Record<'username' | 'displayName' | 'password', string>>;

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [values, setValues] = useState({ username: '', displayName: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof typeof values) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(values);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        errors[field] ??= issue.message;
      }
      return setFieldErrors(errors);
    }

    setSubmitting(true);
    try {
      if (mode === 'login') await login(loginSchema.parse(values));
      else await register(registerSchema.parse(values));
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen__toggle">
        <ColorSchemeToggle />
      </div>

      <Paper className="auth-screen__card" shadow="md" p="xl" withBorder>
        <Group gap="sm" mb="xs">
          <IconMessages className="auth-screen__logo" size={32} stroke={1.6} />
          <Title order={2} className="auth-screen__title">
            Chat Monolito
          </Title>
        </Group>
        <Text c="dimmed" size="sm" mb="lg">
          Converse em tempo real com sua equipe.
        </Text>

        <Tabs
          value={mode}
          onChange={(v) => {
            setMode((v as Mode) ?? 'login');
            setFieldErrors({});
            setFormError(null);
          }}
          mb="md"
        >
          <Tabs.List grow>
            <Tabs.Tab value="login">Entrar</Tabs.Tab>
            <Tabs.Tab value="register">Criar conta</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="sm">
            {formError && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
                {formError}
              </Alert>
            )}

            <TextInput
              label="Usuário"
              placeholder="seu.usuario"
              autoComplete="username"
              autoCapitalize="none"
              value={values.username}
              onChange={(e) => set('username')(e.currentTarget.value)}
              error={fieldErrors.username}
              required
              data-autofocus
            />

            {mode === 'register' && (
              <TextInput
                label="Nome de exibição"
                placeholder="Como os outros vão te ver"
                autoComplete="name"
                value={values.displayName}
                onChange={(e) => set('displayName')(e.currentTarget.value)}
                error={fieldErrors.displayName}
                required
              />
            )}

            <PasswordInput
              label="Senha"
              placeholder={mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={values.password}
              onChange={(e) => set('password')(e.currentTarget.value)}
              error={fieldErrors.password}
              required
            />

            <Button type="submit" fullWidth mt="xs" loading={submitting}>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </main>
  );
}
