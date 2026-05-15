'use client'

import LegalModalShell from '@/components/auth/LegalModalShell'
import { PrivacyLegalContent } from '@/components/auth/legal-content'

type PrivacyModalProps = {
  open: boolean
  onClose: () => void
}

export default function PrivacyModal({ open, onClose }: PrivacyModalProps) {
  return (
    <LegalModalShell open={open} title="개인정보처리방침" onClose={onClose}>
      <PrivacyLegalContent />
    </LegalModalShell>
  )
}
