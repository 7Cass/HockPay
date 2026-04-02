"use client";

import { Loader2 } from "lucide-react";

export function PaymentPending() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Gerando seu Media Kit...
      </h2>
      <p className="text-gray-600 max-w-md">
        Aguardando confirmação do pagamento. Isso pode levar alguns instantes.
      </p>
      <p className="text-sm text-gray-400 mt-4">
        Se você já pagou, a confirmação chegará em breve via webhook.
      </p>
    </div>
  );
}
