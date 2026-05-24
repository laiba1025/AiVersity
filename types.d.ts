import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Vite env typings for client-side feature flags
interface ImportMetaEnv {
  readonly VITE_FEATURE_QUICK_UPLOAD?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Fallback typing for 'mssql' when ambient types are not picked up
// (the package includes types; this avoids editor noise if resolution fails)
declare module 'mssql';
// Allow importing JS module without types
declare module 'pdf-parse';