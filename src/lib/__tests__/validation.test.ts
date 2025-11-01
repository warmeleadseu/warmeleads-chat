import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  changePasswordSchema,
  linkGoogleSheetSchema,
  ValidationError,
} from '../validation';
import { z } from 'zod';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
      };
      
      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'password123',
      };
      
      expect(() => loginSchema.parse(data)).toThrow(z.ZodError);
    });

    it('should reject short password', () => {
      const data = {
        email: 'test@example.com',
        password: '12345',
      };
      
      expect(() => loginSchema.parse(data)).toThrow(z.ZodError);
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        company: 'Test Company',
        phone: '+31612345678',
      };
      
      const result = registerSchema.parse(data);
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should allow optional fields', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };
      
      expect(() => registerSchema.parse(data)).not.toThrow();
    });

    it('should reject short name', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        name: 'T',
      };
      
      expect(() => registerSchema.parse(data)).toThrow(z.ZodError);
    });
  });

  describe('linkGoogleSheetSchema', () => {
    it('should validate correct Google Sheet URL', () => {
      const data = {
        customerId: 'customer-123',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit',
      };
      
      expect(() => linkGoogleSheetSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid URL', () => {
      const data = {
        customerId: 'customer-123',
        sheetUrl: 'not-a-url',
      };
      
      expect(() => linkGoogleSheetSchema.parse(data)).toThrow(z.ZodError);
    });

    it('should reject empty customerId', () => {
      const data = {
        customerId: '',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit',
      };
      
      expect(() => linkGoogleSheetSchema.parse(data)).toThrow(z.ZodError);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate correct password change data', () => {
      const data = {
        oldPassword: 'oldpass123',
        newPassword: 'newpass123',
      };
      
      expect(() => changePasswordSchema.parse(data)).not.toThrow();
    });

    it('should reject short new password', () => {
      const data = {
        oldPassword: 'oldpass123',
        newPassword: '12345',
      };
      
      expect(() => changePasswordSchema.parse(data)).toThrow(z.ZodError);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with details', () => {
      const error = new ValidationError('Test error', [
        { field: 'email', message: 'Invalid email' },
      ]);
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test error');
      expect(error.details).toHaveLength(1);
      expect(error.details[0].field).toBe('email');
    });
  });
});

