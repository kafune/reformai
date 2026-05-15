"use client"

import { signOut } from "next-auth/react"

interface SignOutButtonProps {
  className?: string
  label?: string
}

export function SignOutButton({ className, label = "Sair" }: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className}
      data-testid="logout-link"
    >
      {label}
    </button>
  )
}
