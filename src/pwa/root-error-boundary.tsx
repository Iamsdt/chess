import { Component, type ErrorInfo, type ReactNode } from 'react'

import { copyDiagnostics, recordError } from './diagnostics'

/**
 * The last line of defence: the router has its own error page, but a throw in the theme
 * provider, the shell or the toaster happens outside it. This renders without the design
 * system on purpose — if the failure is in the design system, it must still show.
 */
export class RootErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean; readonly copied: boolean }
> {
  override state = { failed: false, copied: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    recordError(
      'Root error boundary caught an error',
      `${error.stack ?? error.message}\n${info.componentStack ?? ''}`,
    )
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Chess King hit a problem</h1>
        <p>Nothing you have done is lost. Everything lives in this browser.</p>
        <button
          type="button"
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            void copyDiagnostics().then((ok) => {
              this.setState({ copied: ok })
            })
          }}
        >
          {this.state.copied ? 'Diagnostics copied' : 'Copy diagnostics'}
        </button>
      </div>
    )
  }
}
