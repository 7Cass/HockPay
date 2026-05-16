"use client";

import { useState } from "react";
import { MediaKitForm } from "@/components/mediakit-form";
import { Zap, Shield, Clock } from "lucide-react";
import { studyCaseConfig } from "@/study-case.config";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionId = crypto.randomUUID();

      const payload = {
        sessionId,
        creatorName: formData.creatorName,
        bio: formData.bio,
        niche: formData.niche,
        location: formData.location,
        socials: {
          instagram: {
            followers: formData.instagramFollowers,
            engagement: formData.instagramEngagement,
          },
          tiktok: {
            followers: formData.tiktokFollowers,
            engagement: formData.tiktokEngagement,
          },
          youtube: {
            followers: formData.youtubeFollowers,
            engagement: formData.youtubeEngagement,
          },
        },
        audience: {
          age: formData.audienceAge,
          gender: formData.audienceGender,
          topCountries: formData.audienceCountries,
        },
        rates: {
          post: formData.ratePost,
          story: formData.rateStory,
          video: formData.rateVideo,
        },
      };

      const res = await fetch("/api/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao criar sessão de pagamento");
      }

      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            {studyCaseConfig.productName}
          </h1>
          <span className="text-sm text-gray-500">Powered by HockPay</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {studyCaseConfig.productTitle}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {studyCaseConfig.productDescription}
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="text-center p-4">
            <Zap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Instantâneo</p>
            <p className="text-xs text-gray-500 mt-1">
              Geração automática após pagamento
            </p>
          </div>
          <div className="text-center p-4">
            <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Seguro</p>
            <p className="text-xs text-gray-500 mt-1">
              Pagamento via Pix com HockPay
            </p>
          </div>
          <div className="text-center p-4">
            <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">
              Webhook Real-time
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Confirmação automática via webhook
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          <MediaKitForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}
