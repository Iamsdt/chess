/** S26 · PWA and offline; S29 · diagnostics. */

export { PwaRuntime } from './pwa-runtime'
export { useUpdateState } from './use-update-state'
export { OnlineOnlyNotice } from './online-only-notice'
export { useOnline } from './use-online'
export { captureInstallPrompt, useInstallPrompt, type InstallPrompt } from './use-install-prompt'
export { applyUpdate, registerServiceWorker } from './register'
export {
  copyDiagnostics,
  diagnosticsLog,
  installGlobalDiagnostics,
  recordError,
  type DiagnosticEntry,
} from './diagnostics'
