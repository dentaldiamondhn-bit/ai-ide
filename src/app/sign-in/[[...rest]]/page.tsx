'use client'

import { SignIn } from '@clerk/nextjs'
import { dark } from '@clerk/themes'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <SignIn
        appearance={{
          baseTheme: dark,
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-zinc-900 border border-zinc-800 shadow-xl rounded-lg',
            headerTitle: 'text-zinc-100 text-lg font-semibold',
            headerSubtitle: 'text-zinc-400 text-sm',
            socialButtonsBlockButton: 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200',
            formFieldLabel: 'text-zinc-300 text-xs',
            formFieldInput: 'bg-zinc-800 border-zinc-700 text-zinc-100 text-sm rounded',
            formButtonPrimary: 'bg-sky-600 hover:bg-sky-500 text-white text-sm',
            footerActionLink: 'text-sky-400 hover:text-sky-300',
            footer: 'border-t border-zinc-800',
            dividerLine: 'bg-zinc-800',
            dividerText: 'text-zinc-500 text-xs',
            identityPreviewText: 'text-zinc-300',
            identityPreviewEditButton: 'text-sky-400',
          },
        } as any}
        forceRedirectUrl="/"
      />
    </div>
  )
}
