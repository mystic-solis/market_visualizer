/// <reference types="vite/client" />

declare module '@tauri-apps/api/core' {
  export function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI__: any;
  }
}