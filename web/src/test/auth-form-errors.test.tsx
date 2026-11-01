import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/components/login-form';
import { RegisterForm } from '@/features/auth/components/register-form';
import { ApiErrorCode } from '@/http/codes';
import { ApiError } from '@/http/request';
import { messages } from '@/i18n/modules';

const mutations = vi.hoisted(() => ({
  login: {
    error: null as unknown,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
  register: {
    error: null as unknown,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useLogin: () => mutations.login,
  useRegister: () => mutations.register,
}));

function renderWithMessages(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages as unknown as AbstractIntlMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('auth form error feedback', () => {
  beforeEach(() => {
    mutations.login.error = null;
    mutations.login.isPending = false;
    mutations.login.mutate.mockReset();
    mutations.login.reset.mockReset();
    mutations.register.error = null;
    mutations.register.isPending = false;
    mutations.register.mutate.mockReset();
    mutations.register.reset.mockReset();
  });

  it('shows localized invalid-credential feedback and clears it on edit', () => {
    mutations.login.error = new ApiError(
      'backend credential detail',
      ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      401
    );

    renderWithMessages(<LoginForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByText('backend credential detail')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    expect(mutations.login.reset).toHaveBeenCalledTimes(1);
  });

  it('keeps real-backend login blank and free of mock credentials by default', () => {
    renderWithMessages(<LoginForm />);

    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.queryByText('Demo credentials')).not.toBeInTheDocument();
    expect(screen.queryByText('Use the preset login')).not.toBeInTheDocument();
  });

  it('shows and prefills credentials only when the server enables the mock preset', () => {
    renderWithMessages(
      <LoginForm
        demoCredentials={{
          email: 'demo@example.test',
          password: 'demo-password',
        }}
      />
    );

    expect(screen.getByLabelText('Email')).toHaveValue('demo@example.test');
    expect(screen.getByLabelText('Password')).toHaveValue('demo-password');
    expect(screen.getByText('Demo credentials')).toBeInTheDocument();
    expect(screen.getByText('demo@example.test / demo-password')).toBeInTheDocument();
  });

  it('associates server field ownership with localized registration errors', () => {
    mutations.register.error = new ApiError(
      'backend validation detail',
      ApiErrorCode.COMMON_VALIDATION_FAILED,
      422,
      'request-1',
      {
        email: ['backend email detail'],
        name: ['backend name detail'],
        password: ['backend password detail'],
      }
    );

    renderWithMessages(<RegisterForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Please review the highlighted fields');
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Please enter a valid full name')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be 8 to 50 characters')).toBeInTheDocument();
    expect(screen.queryByText('backend name detail')).not.toBeInTheDocument();
  });

  it('exposes login metadata and a stable pending state to the browser', () => {
    mutations.login.isPending = true;

    renderWithMessages(<LoginForm />);

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('name', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toBeDisabled();
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password'
    );
    expect(email.closest('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('exposes registration metadata and disables edits while pending', () => {
    mutations.register.isPending = true;

    renderWithMessages(<RegisterForm />);

    const name = screen.getByLabelText('Full Name');
    expect(name).toHaveAttribute('name', 'name');
    expect(name).toHaveAttribute('autocomplete', 'name');
    expect(name).toBeDisabled();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email'
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'new-password'
    );
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(name.closest('form')).toHaveAttribute('aria-busy', 'true');
  });

  describe('login validation', () => {
    it('shows inline field errors for empty fields and focuses the first one', () => {
      renderWithMessages(<LoginForm />);

      const email = screen.getByLabelText('Email');
      expect(email.closest('form')).toHaveAttribute('novalidate');
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(email).toHaveFocus();
      expect(mutations.login.mutate).not.toHaveBeenCalled();

      fireEvent.change(email, { target: { value: 'member@example.com' } });
      // The Input keeps its wrapper across error states, so clearing an error never drops focus.
      expect(email).toHaveFocus();
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    it('rejects a malformed email and applies no length rule to the sign-in password', () => {
      renderWithMessages(<LoginForm />);

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(mutations.login.mutate).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'member@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
      expect(mutations.login.mutate).toHaveBeenCalledWith({
        email: 'member@example.com',
        password: 'secret',
      });
    });

    it('does not offer an unconfigured social sign-in', () => {
      renderWithMessages(<LoginForm />);

      expect(screen.queryByRole('button', { name: 'GitHub' })).not.toBeInTheDocument();
      expect(screen.queryByText('Or continue with')).not.toBeInTheDocument();
    });
  });

  describe('registration validation', () => {
    function fillValidFields() {
      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ada Lovelace' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough' } });
    }

    it('states the password rule up front and ties it to the field', () => {
      renderWithMessages(<RegisterForm />);

      const password = screen.getByLabelText('Password');
      expect(password).toHaveAttribute('minlength', '8');
      // A max attribute would silently truncate a pasted password, so length is reported instead.
      expect(password).not.toHaveAttribute('maxlength');
      expect(password).toHaveAccessibleDescription('Use 8 to 50 characters.');
    });

    it.each([
      ['short', 'seven77'],
      ['long', 'x'.repeat(51)],
    ])('explains the length rule for a %s password', (_label, value) => {
      renderWithMessages(<RegisterForm />);

      fillValidFields();
      fireEvent.change(screen.getByLabelText('Password'), { target: { value } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

      const password = screen.getByLabelText('Password');
      expect(password).toHaveAttribute('aria-invalid', 'true');
      expect(password).toHaveAccessibleDescription('Password must be 8 to 50 characters');
      expect(screen.queryByText('Use 8 to 50 characters.')).not.toBeInTheDocument();
      expect(password).toHaveFocus();
      expect(mutations.register.mutate).not.toHaveBeenCalled();
    });

    it('accepts the boundary password lengths', () => {
      renderWithMessages(<RegisterForm />);

      fillValidFields();
      fireEvent.click(screen.getByRole('checkbox'));
      for (const value of ['x'.repeat(8), 'x'.repeat(50)]) {
        fireEvent.change(screen.getByLabelText('Password'), { target: { value } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
        expect(mutations.register.mutate).toHaveBeenLastCalledWith({
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          password: value,
        });
      }
    });

    it('keeps submit enabled and explains unaccepted terms inline', () => {
      renderWithMessages(<RegisterForm />);

      fillValidFields();
      const submit = screen.getByRole('button', { name: 'Sign Up' });
      expect(submit).toBeEnabled();
      fireEvent.click(submit);

      const terms = screen.getByRole('checkbox');
      expect(terms).toHaveAttribute('aria-invalid', 'true');
      expect(terms).toHaveAccessibleDescription(
        'Please accept the Terms of Service and Privacy Policy to continue'
      );
      expect(terms).toHaveFocus();
      expect(mutations.register.mutate).not.toHaveBeenCalled();

      fireEvent.click(terms);
      expect(terms).not.toHaveAttribute('aria-invalid');
      expect(
        screen.queryByText('Please accept the Terms of Service and Privacy Policy to continue')
      ).not.toBeInTheDocument();

      fireEvent.click(submit);
      expect(mutations.register.mutate).toHaveBeenCalledTimes(1);
    });

    it('reports every empty field and focuses the first', () => {
      renderWithMessages(<RegisterForm />);

      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name')).toHaveFocus();
    });

    it('says the legal documents are unpublished when none are configured', () => {
      renderWithMessages(<RegisterForm />);

      expect(screen.queryByRole('link', { name: 'Terms of Service' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();
      expect(
        screen.getByText('The Terms of Service and Privacy Policy have not been published yet.')
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toHaveAccessibleName(
        'I agree to the Terms of Service and Privacy Policy'
      );
    });

    it('links the configured legal documents in a new tab so the form survives', () => {
      renderWithMessages(
        <RegisterForm
          legalLinks={{
            termsUrl: 'https://example.test/terms',
            privacyUrl: 'https://example.test/privacy',
          }}
        />
      );

      const terms = screen.getByRole('link', { name: 'Terms of Service' });
      expect(terms).toHaveAttribute('href', 'https://example.test/terms');
      expect(terms).toHaveAttribute('target', '_blank');
      expect(terms).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
        'href',
        'https://example.test/privacy'
      );
      expect(screen.queryByText(/have not been published/)).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toHaveAccessibleName(
        'I agree to the Terms of Service and Privacy Policy'
      );
    });
  });
});
