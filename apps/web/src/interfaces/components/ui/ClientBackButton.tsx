'use client'

import { Button, type ButtonProps } from './Button'

/** Botão client-side que dispara window.history.back(). */
export function ClientBackButton(props: Omit<ButtonProps, 'onClick'>) {
  return <Button {...props} onClick={() => window.history.back()} />
}
