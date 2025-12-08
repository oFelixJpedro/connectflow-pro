export interface PasswordValidation {
  hasMinLength: boolean;
  hasNumber: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasSpecialChar: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  return {
    hasMinLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
  };
}

export function isPasswordStrong(password: string): boolean {
  const validation = validatePassword(password);
  return Object.values(validation).every((v) => v === true);
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  const validation = validatePassword(password);
  const score = Object.values(validation).filter((v) => v).length;

  if (score <= 2) {
    return { score, label: 'Fraca', color: 'destructive' };
  } else if (score <= 4) {
    return { score, label: 'Média', color: 'warning' };
  } else {
    return { score, label: 'Forte', color: 'success' };
  }
}

export const PASSWORD_REQUIREMENTS = [
  { key: 'hasMinLength', label: 'Mínimo 8 caracteres' },
  { key: 'hasNumber', label: 'Pelo menos 1 número' },
  { key: 'hasUppercase', label: 'Pelo menos 1 letra maiúscula' },
  { key: 'hasLowercase', label: 'Pelo menos 1 letra minúscula' },
  { key: 'hasSpecialChar', label: 'Pelo menos 1 caractere especial (!@#$%...)' },
] as const;
