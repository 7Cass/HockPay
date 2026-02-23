'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyPasteButtonProps {
  pixCopyPaste: string;
}

export function CopyPasteButton({ pixCopyPaste }: CopyPasteButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleCopy}
      className="w-full flex items-center gap-2"
    >
      {copied ? (
        <>
          <Check className="w-5 h-5" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="w-5 h-5" />
          Copiar código Pix
        </>
      )}
    </Button>
  );
}
