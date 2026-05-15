'use client'

import LegalModalShell from '@/components/auth/LegalModalShell'
import { TermsLegalContent } from '@/components/auth/legal-content'

type TermsModalProps = {
  open: boolean
  onClose: () => void
}

export default function TermsModal({ open, onClose }: TermsModalProps) {
  return (
    <LegalModalShell open={open} title="이용약관" onClose={onClose}>
      <TermsLegalContent />
    </LegalModalShell>
  )
}
