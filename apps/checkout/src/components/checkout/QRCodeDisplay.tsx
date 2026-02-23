'use client';

import Image from 'next/image';

interface QRCodeDisplayProps {
  qrCodeBase64: string;
  alt?: string;
}

export function QRCodeDisplay({ qrCodeBase64, alt = 'QR Code Pix' }: QRCodeDisplayProps) {
  // API already returns the full data URI, so use it directly if it starts with 'data:'
  const src = qrCodeBase64.startsWith('data:')
    ? qrCodeBase64
    : `data:image/png;base64,${qrCodeBase64}`;

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg">
      <div className="relative w-64 h-64">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          priority
        />
      </div>
      <p className="mt-3 text-sm text-gray-500">Escaneie o QR Code com seu app do banco</p>
    </div>
  );
}
