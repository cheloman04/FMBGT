import { LegacyArea } from '../_components/LegacyArea';

// Sign in, forgot and reset password: outside the guard (the middleware lets
// them through) and outside the shell. Not migrated to the kit yet.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LegacyArea>{children}</LegacyArea>;
}
