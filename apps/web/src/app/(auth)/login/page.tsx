import { LoginForm } from '@/features/auth/components/login-form';
import { getAuthRuntimeMode } from '@/features/auth/server/auth-runtime';
import { resolveMockLoginCredentials } from '@/features/auth/server/mock-identity';

export default function LoginPage() {
  const demoCredentials = resolveMockLoginCredentials({
    authMode: getAuthRuntimeMode(),
  });

  return <LoginForm demoCredentials={demoCredentials} />;
}
