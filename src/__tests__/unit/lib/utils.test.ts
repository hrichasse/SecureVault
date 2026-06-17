import { cn } from '@/lib/utils'

describe('cn (class name utility)', () => {
  it('combina clases simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('omite valores falsy', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar')
  })

  it('aplica clases condicionales', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })

  it('resuelve conflictos de tailwind — último gana', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('resuelve conflictos de color tailwind', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('devuelve string vacío sin argumentos', () => {
    expect(cn()).toBe('')
  })

  it('maneja objetos de clase condicional', () => {
    expect(cn({ 'text-lg': true, 'font-bold': false })).toBe('text-lg')
  })
})
