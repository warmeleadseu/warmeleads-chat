/**
 * Form Validation Utilities
 * 
 * Real-time validation helpers
 */

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export const validationRules = {
  required: (message = 'Dit veld is verplicht'): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),

  email: (message = 'Ongeldig email adres'): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: message || `Minimaal ${min} karakters vereist`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: message || `Maximaal ${max} karakters toegestaan`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => regex.test(value),
    message,
  }),

  phone: (message = 'Ongeldig telefoonnummer'): ValidationRule => ({
    validate: (value) => /^[\d\s\+\-\(\)]+$/.test(value) && value.replace(/\D/g, '').length >= 10,
    message,
  }),

  url: (message = 'Ongeldige URL'): ValidationRule => ({
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  match: (otherValue: string, fieldName: string): ValidationRule => ({
    validate: (value) => value === otherValue,
    message: `Moet overeenkomen met ${fieldName}`,
  }),
};

export const validateField = (value: string, rules: ValidationRule[]): string | null => {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      return rule.message;
    }
  }
  return null;
};

// ========================================
// FORM VALIDATION HOOK
// ========================================

import { useState, useCallback } from 'react';

export interface FieldConfig {
  rules?: ValidationRule[];
  initialValue?: string;
}

export interface FormConfig {
  [key: string]: FieldConfig;
}

export const useFormValidation = <T extends FormConfig>(config: T) => {
  type FieldNames = keyof T;
  type FormValues = { [K in FieldNames]: string };
  type FormErrors = { [K in FieldNames]?: string };
  type TouchedFields = { [K in FieldNames]?: boolean };

  const initialValues = Object.keys(config).reduce((acc, key) => {
    acc[key as FieldNames] = config[key].initialValue || '';
    return acc;
  }, {} as FormValues);

  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});

  const validateSingleField = useCallback(
    (name: FieldNames, value: string): string | null => {
      const fieldConfig = config[name];
      if (!fieldConfig?.rules) return null;

      return validateField(value, fieldConfig.rules);
    },
    [config]
  );

  const handleChange = useCallback(
    (name: FieldNames, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      // Real-time validation if field has been touched
      if (touched[name]) {
        const error = validateSingleField(name, value);
        setErrors((prev) => ({
          ...prev,
          [name]: error,
        }));
      }
    },
    [touched, validateSingleField]
  );

  const handleBlur = useCallback(
    (name: FieldNames) => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validate on blur
      const error = validateSingleField(name, values[name]);
      setErrors((prev) => ({
        ...prev,
        [name]: error,
      }));
    },
    [values, validateSingleField]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(config).forEach((key) => {
      const name = key as FieldNames;
      const error = validateSingleField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(
      Object.keys(config).reduce((acc, key) => {
        acc[key as FieldNames] = true;
        return acc;
      }, {} as TouchedFields)
    );

    return isValid;
  }, [config, values, validateSingleField]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0,
  };
};

