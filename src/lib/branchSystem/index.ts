/**
 * Branch System - Main Export
 * Enterprise-grade multi-branch lead management system
 */

export * from './types';
export * from './columnDetector';
export * from './dynamicSheetParser';
export * from './dynamicEmailGenerator';

// Re-export singletons for easy access
export { columnDetector } from './columnDetector';
export { dynamicSheetParser } from './dynamicSheetParser';
export { dynamicEmailGenerator } from './dynamicEmailGenerator';


