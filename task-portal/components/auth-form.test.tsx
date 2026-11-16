import { describe, expect, it, vi } from 'vitest';
import { fieldTag, renderToHtml } from '@/test/render';
import { AuthForm } from '@/components/auth-form';
import { LogoutButton } from '@/components/logout-button';
import { AppHeader } from '@/components/app-header';
import LoginPage from '@/app/(auth)/login/page';
import RegisterPage from '@/app/(auth)/register/page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

describe('AuthForm in login mode', () => {
  const html = renderToHtml(<AuthForm mode="login" />);

  it('shows the sign-in heading and submit button', () => {
    expect(html).toContain('<h1 class="text-xl font-semibold">Sign in</h1>');
    expect(html).toMatch(/<button type="submit"[^>]*>Sign in<\/button>/);
  });

  it('asks only for email and password', () => {
    expect(html).not.toContain('name="name"');
    expect(fieldTag(html, 'email')).toContain('type="email"');
    expect(fieldTag(html, 'password')).toContain('type="password"');
  });

  it('labels every input', () => {
    expect(html).toContain('<label for="field-email" class="block text-sm font-medium text-slate-700">Email</label>');
    expect(html).toContain('<label for="field-password" class="block text-sm font-medium text-slate-700">Password</label>');
    expect(fieldTag(html, 'email')).toContain('id="field-email"');
    expect(fieldTag(html, 'password')).toContain('id="field-password"');
  });

  it('lets password managers fill the saved password', () => {
    expect(fieldTag(html, 'email')).toContain('autoComplete="email"');
    expect(fieldTag(html, 'password')).toContain('autoComplete="current-password"');
  });

  it('uses its own validation instead of the browser popups', () => {
    expect(html).toMatch(/<form[^>]*noValidate/);
  });

  it('starts with no errors', () => {
    expect(html).not.toContain('role="alert"');
    expect(fieldTag(html, 'email')).toContain('aria-invalid="false"');
    expect(fieldTag(html, 'email')).not.toContain('aria-describedby');
  });

  it('links to the registration page', () => {
    expect(html).toMatch(/No account yet\? <a[^>]*href="\/register"[^>]*>Create one<\/a>/);
  });
});

describe('AuthForm in register mode', () => {
  const html = renderToHtml(<AuthForm mode="register" />);

  it('shows the create-account heading and submit button', () => {
    expect(html).toContain('<h1 class="text-xl font-semibold">Create an account</h1>');
    expect(html).toMatch(/<button type="submit"[^>]*>Create account<\/button>/);
  });

  it('also asks for a name', () => {
    expect(fieldTag(html, 'name')).toContain('id="field-name"');
    expect(fieldTag(html, 'name')).toContain('autoComplete="name"');
    expect(html).toContain('<label for="field-name" class="block text-sm font-medium text-slate-700">Name</label>');
  });

  it('asks password managers to suggest a new password', () => {
    expect(fieldTag(html, 'password')).toContain('autoComplete="new-password"');
  });

  it('links to the login page', () => {
    expect(html).toMatch(/Already have an account\? <a[^>]*href="\/login"[^>]*>Sign in<\/a>/);
  });
});

describe('auth pages', () => {
  it('/login renders the login form', () => {
    expect(renderToHtml(<LoginPage />)).toContain('autoComplete="current-password"');
  });

  it('/register renders the registration form', () => {
    expect(renderToHtml(<RegisterPage />)).toContain('name="name"');
  });
});

describe('header', () => {
  it('shows the user name and a log out button', () => {
    const html = renderToHtml(<AppHeader user={{ id: '1', email: 'ada@example.com', name: 'Ada' }} />);

    expect(html).toContain('Ada');
    expect(html).toMatch(/<button[^>]*>Log out<\/button>/);
  });

  it('LogoutButton renders an enabled button with no error', () => {
    const html = renderToHtml(<LogoutButton />);

    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Log out<\/button>/);
    expect(html).not.toContain('role="alert"');
  });
});
