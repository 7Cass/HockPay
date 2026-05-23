"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PaymentPending } from "@/components/payment-pending";
import { MediaKitRender } from "@/components/mediakit-render";
import { CheckCircle, AlertCircle, ArrowLeft, XCircle } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [status, setStatus] = useState<
    "pending" | "ready" | "failed" | "expired" | "error"
  >("pending");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const pollMediaKit = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/mediakit?sessionId=${sessionId}`);
      const json = await res.json();

      if (json.status === "ready" && json.data) {
        setData(json.data);
        setStatus("ready");
      } else if (json.status === "failed" || json.status === "expired") {
        setFailureReason(json.failureReason || json.status);
        setStatus(json.status);
      } else {
        setStatus("pending");
      }
    } catch {
      setStatus("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    pollMediaKit();
    const interval = setInterval(pollMediaKit, 2000);
    return () => clearInterval(interval);
  }, [sessionId, pollMediaKit]);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Sessão Inválida
          </h2>
          <Link
            href="/"
            className="text-blue-600 hover:underline flex items-center justify-center gap-1 mt-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">
            Media Kit Generator
          </h1>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        {status === "pending" && <PaymentPending />}

        {status === "ready" && data && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 mb-8">
              <CheckCircle className="w-8 h-8 shrink-0 text-green-500" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  Seu Media Kit está pronto!
                </h2>
                <p className="text-gray-600">
                  Pagamento confirmado via HockPay
                </p>
              </div>
            </div>
            <MediaKitRender data={data} />
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Erro ao gerar Media Kit
            </h2>
            <p className="text-gray-600 mb-6">
              Não foi possível processar seu pagamento. Tente novamente.
            </p>
            <Link
              href="/"
              className="text-blue-600 hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </Link>
          </div>
        )}

        {(status === "failed" || status === "expired") && (
          <div className="text-center py-16">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Pagamento não concluído
            </h2>
            <p className="text-gray-600 mb-2">
              O Media Kit não foi liberado porque o pagamento terminou como{" "}
              {status === "expired" ? "expirado" : "falhou"}.
            </p>
            {failureReason && (
              <p className="text-sm text-gray-500 mb-6">
                Motivo: {failureReason}
              </p>
            )}
            <Link
              href="/"
              className="text-blue-600 hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p>Carregando...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
