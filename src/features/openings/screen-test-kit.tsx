import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { vi, type MockInstance } from 'vitest'

import { ThemeProvider } from '@/design'

import type { ReactNode } from 'react'

/** jsdom has no layout, no pointer model and no scroll; these are the smallest stand-ins. */
export function installDomShims(): MockInstance {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom.
    }
    unobserve(): void {
      // See above.
    }
    disconnect(): void {
      // See above.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // No viewport in jsdom.
  }
  class PointerEventStub extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  globalThis.PointerEvent = PointerEventStub as unknown as typeof PointerEvent
  Element.prototype.setPointerCapture = function setPointerCapture(): void {
    // Capture is meaningless without a real pointer.
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
    // See above.
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return new DOMRect(0, 0, 800, 800)
  }
  return vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
}

function HubStub() {
  return <div>Openings hub</div>
}

function DrillStub() {
  return <div>Opening drill</div>
}

/** The screen under test at its own path, with stub neighbours for the links it renders. */
export function renderAt(path: '/openings' | '/openings/drill', Screen: () => ReactNode) {
  const rootRoute = createRootRoute()
  const openings = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings',
    component: path === '/openings' ? Screen : HubStub,
  })
  const drill = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings/drill',
    component: path === '/openings/drill' ? Screen : DrillStub,
  })
  const settings = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([openings, drill, settings]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}
