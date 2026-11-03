// Auth translations - English (US)
const messages = {
  // Page titles
  welcomeBack: 'Welcome back',
  signInToContinue: 'Sign in to continue to your account',
  createAccount: 'Create account',
  getStarted: 'Get started',
  registrationDisabled: 'Registration Disabled',
  registrationDisabledMessage:
    'Registration is currently disabled for this platform. Please contact your administrator for access.',
  backToSignIn: 'Back to sign in',

  // Form labels
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  fullName: 'Full Name',

  // Form placeholders
  enterEmail: 'Enter your email',
  enterPassword: 'Enter your password',
  createPassword: 'Create a strong password',
  confirmYourPassword: 'Confirm your password',
  enterFullName: 'Enter your full name',

  // Actions
  login: 'Sign In',
  logout: 'Sign Out',
  register: 'Sign Up',
  signIn: 'Sign In',
  signUp: 'Sign Up',
  forgotPassword: 'Forgot password?',
  demoCredentials: 'Demo credentials',
  demoCredentialsHint: 'Use the preset login',

  // Links
  noAccount: "Don't have an account?",
  hasAccount: 'Already have an account?',
  rememberMe: 'Remember me',

  // Terms
  agreeToTerms: 'I agree to the',
  termsOfService: 'Terms of Service',
  and: 'and',
  privacyPolicy: 'Privacy Policy',
  legalDocumentsUnpublished: 'The Terms of Service and Privacy Policy have not been published yet.',

  // Password requirements
  passwordHint: 'Use 8 to 50 characters.',
  passwordRequirements: 'Password requirements',
  passwordReqLength: 'At least 8 characters long',
  passwordReqCase: 'Contains uppercase and lowercase letters',
  passwordReqNumber: 'Contains at least one number',
  passwordReqSpecial: 'Contains at least one special character',

  // Decorative panel
  heroTitle: 'Build Amazing Products',
  heroSubtitle: 'The modern web scaffold for fast, reliable product delivery',
  feature1: 'Next.js and Go starter code',
  feature2: 'Sign-in, sessions, and protected routes',
  feature3: 'Independently deployable Web and API',
  feature4: 'English and Chinese included',

  // Validation messages
  nameRequired: 'Name is required',
  nameInvalid: 'Please enter a valid full name',
  nameMinLength: 'Name must be at least 2 characters',
  nameTooLong: 'Name is too long',
  emailRequired: 'Email is required',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
  passwordMinLength: 'Password must be at least 8 characters',
  passwordTooLong: 'Password is too long',
  passwordTooShort: 'Password is too short',
  passwordInvalid: 'Please enter a valid password',
  passwordLengthInvalid: 'Password must be 8 to 50 characters',
  confirmPasswordRequired: 'Please confirm your password',
  passwordsDoNotMatch: 'Passwords do not match',
  termsRequired: 'Please accept the Terms of Service and Privacy Policy to continue',

  // Toast messages
  loginSuccess: 'Login successful',
  loginFailed: 'Login failed',
  welcomeBackUser: 'Welcome back, {name}',
  logoutSuccess: 'Logout successful',
  logoutFailed: 'Logout failed',
  registerSuccess: 'Registration successful',
  registerFailed: 'Registration failed',
  accountCreated: 'Account created, signing in...',
  accountDisabled: 'This account is disabled',
  emailAlreadyExists: 'An account with this email already exists',
  invalidCredentials: 'Invalid email or password',

  // Social login
  signInWithGoogle: 'Sign in with Google',
  signInWithApple: 'Sign in with Apple',
  signInWithGithub: 'Sign in with GitHub',
  signUpWithGoogle: 'Sign up with Google',
  signUpWithApple: 'Sign up with Apple',
  signUpWithGithub: 'Sign up with GitHub',

  // Footer
  copyright: '© {year} FastBuild. All rights reserved.',
} as const;

export default messages;
export type AuthMessages = typeof messages;
