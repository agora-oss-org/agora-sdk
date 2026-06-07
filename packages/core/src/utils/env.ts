// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — repointed the hardcoded Replyke API
// base URL to a self-hosted, Replyke-compatible Agora backend.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

// Environment detection utility for cross-platform compatibility
// Works with both traditional React apps and Vite-based apps

// Declare `process` so the `typeof process` guards below typecheck without
// pulling in @types/node (this package targets browser/RN/Vite too, where
// `process` may be absent). Picked up from upstream during the sublay rebrand
// sync — the one non-rename improvement in that delta.
declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

// Helper function to safely access Vite's import.meta.env
function getViteEnv(): Record<string, any> | null {
  try {
    // Use dynamic access to avoid TypeScript import.meta issues
    const globalThis_ = globalThis as any;
    if (typeof window !== 'undefined' && globalThis_.__vite_env) {
      return globalThis_.__vite_env;
    }

    // Try to access import.meta via eval to avoid compile-time issues
    if (typeof window !== 'undefined') {
      try {
        const importMeta = new Function('return typeof import !== "undefined" && import.meta')();
        if (importMeta && importMeta.env) {
          return importMeta.env;
        }
      } catch {
        // Ignore errors when import.meta is not available
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Safe way to check if we're in development mode
 * Works with both Node.js process.env and Vite import.meta.env
 */
export function isDevelopment(): boolean {
  // Check if we have process.env (Node.js or bundler that provides it)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }

  // Check Vite environment
  const viteEnv = getViteEnv();
  if (viteEnv) {
    return viteEnv.MODE === 'development';
  }

  // Fallback to false (assume production for safety)
  return false;
}

/**
 * Safe way to check if we're in production mode
 */
export function isProduction(): boolean {
  // Check if we have process.env (Node.js or bundler that provides it)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production';
  }

  // Check Vite environment
  const viteEnv = getViteEnv();
  if (viteEnv) {
    return viteEnv.MODE === 'production';
  }

  // Fallback to true (assume production for safety)
  return true;
}

// NOTE: the API base URL is NOT auto-detected from env anymore. The consuming app passes it
// explicitly via <ReplykeProvider baseUrl={...}> and the SDK reads it from config/runtime.ts.

/**
 * Get any environment variable with fallback
 * Tries both VITE_ and REACT_APP_ prefixes
 */
export function getEnvVar(name: string, defaultValue: string = ''): string {
  // process.env (CRA / React Native) — fall through to Vite if the value is absent (see getApiBaseUrl).
  const fromProcess =
    typeof process !== 'undefined' && process.env
      ? process.env[`REACT_APP_${name}`] || process.env[`VITE_${name}`]
      : undefined;
  if (fromProcess) return fromProcess;

  // Vite environment
  const viteEnv = getViteEnv();
  if (viteEnv) {
    const v = viteEnv[`VITE_${name}`] || viteEnv[`REACT_APP_${name}`];
    if (v) return v;
  }

  return defaultValue;
}