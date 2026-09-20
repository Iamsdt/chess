import { describe, expect, it } from 'vitest'

import { cn } from './utils'

import type { ClassValue } from 'clsx'

describe('cn', () => {
  it('drops falsy class names', () => {
    const classes: ClassValue[] = ['a', false, undefined, 'c']
    expect(cn(classes)).toBe('a c')
  })

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
