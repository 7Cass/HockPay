"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { studyCaseConfig } from "@/study-case.config";

interface MediaKitFormData {
  creatorName: string;
  bio: string;
  niche: string;
  location: string;
  instagramFollowers: string;
  instagramEngagement: string;
  tiktokFollowers: string;
  tiktokEngagement: string;
  youtubeFollowers: string;
  youtubeEngagement: string;
  audienceAge: string;
  audienceGender: string;
  audienceCountries: string;
  ratePost: string;
  rateStory: string;
  rateVideo: string;
}

interface Props {
  onSubmit: (data: MediaKitFormData) => Promise<void>;
  isLoading: boolean;
}

export function MediaKitForm({ onSubmit, isLoading }: Props) {
  const [form, setForm] = useState<MediaKitFormData>({
    creatorName: "",
    bio: "",
    niche: "",
    location: "",
    instagramFollowers: "",
    instagramEngagement: "",
    tiktokFollowers: "",
    tiktokEngagement: "",
    youtubeFollowers: "",
    youtubeEngagement: "",
    audienceAge: "",
    audienceGender: "",
    audienceCountries: "",
    ratePost: "",
    rateStory: "",
    rateVideo: "",
  });

  const update = (field: keyof MediaKitFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const sectionClass = "space-y-4";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className={sectionClass}>
        <h3 className="text-lg font-semibold text-gray-900">Sobre Você</h3>
        <div>
          <label className={labelClass}>
            Seu Nome (como aparecerá no Media Kit)
          </label>
          <input
            type="text"
            required
            value={form.creatorName}
            onChange={(e) => update("creatorName", e.target.value)}
            className={inputClass}
            placeholder="João Silva"
          />
        </div>
        <div>
          <label className={labelClass}>Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="Criador de conteúdo tech..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nicho</label>
            <input
              type="text"
              value={form.niche}
              onChange={(e) => update("niche", e.target.value)}
              className={inputClass}
              placeholder="Tecnologia"
            />
          </div>
          <div>
            <label className={labelClass}>Localização</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              className={inputClass}
              placeholder="São Paulo, BR"
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-lg font-semibold text-gray-900">Redes Sociais</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-600">Instagram</p>
            <input
              type="text"
              value={form.instagramFollowers}
              onChange={(e) => update("instagramFollowers", e.target.value)}
              className={inputClass}
              placeholder="Followers (ex: 100K)"
            />
            <input
              type="text"
              value={form.instagramEngagement}
              onChange={(e) => update("instagramEngagement", e.target.value)}
              className={inputClass}
              placeholder="Engagement (ex: 4.2%)"
            />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-600">TikTok</p>
            <input
              type="text"
              value={form.tiktokFollowers}
              onChange={(e) => update("tiktokFollowers", e.target.value)}
              className={inputClass}
              placeholder="Followers (ex: 250K)"
            />
            <input
              type="text"
              value={form.tiktokEngagement}
              onChange={(e) => update("tiktokEngagement", e.target.value)}
              className={inputClass}
              placeholder="Engagement (ex: 6.1%)"
            />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-600">YouTube</p>
            <input
              type="text"
              value={form.youtubeFollowers}
              onChange={(e) => update("youtubeFollowers", e.target.value)}
              className={inputClass}
              placeholder="Followers (ex: 50K)"
            />
            <input
              type="text"
              value={form.youtubeEngagement}
              onChange={(e) => update("youtubeEngagement", e.target.value)}
              className={inputClass}
              placeholder="Engagement (ex: 3.8%)"
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-lg font-semibold text-gray-900">Audiência</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Faixa Etária</label>
            <input
              type="text"
              value={form.audienceAge}
              onChange={(e) => update("audienceAge", e.target.value)}
              className={inputClass}
              placeholder="18-34 (72%)"
            />
          </div>
          <div>
            <label className={labelClass}>Gênero</label>
            <input
              type="text"
              value={form.audienceGender}
              onChange={(e) => update("audienceGender", e.target.value)}
              className={inputClass}
              placeholder="60% M / 38% F"
            />
          </div>
          <div>
            <label className={labelClass}>Top Países</label>
            <input
              type="text"
              value={form.audienceCountries}
              onChange={(e) => update("audienceCountries", e.target.value)}
              className={inputClass}
              placeholder="BR, PT, US"
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-lg font-semibold text-gray-900">
          Tabela de Preços
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Post</label>
            <input
              type="text"
              value={form.ratePost}
              onChange={(e) => update("ratePost", e.target.value)}
              className={inputClass}
              placeholder="R$ 2.500"
            />
          </div>
          <div>
            <label className={labelClass}>Story</label>
            <input
              type="text"
              value={form.rateStory}
              onChange={(e) => update("rateStory", e.target.value)}
              className={inputClass}
              placeholder="R$ 1.200"
            />
          </div>
          <div>
            <label className={labelClass}>Vídeo</label>
            <input
              type="text"
              value={form.rateVideo}
              onChange={(e) => update("rateVideo", e.target.value)}
              className={inputClass}
              placeholder="R$ 5.000"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Criando sessão de pagamento...
          </>
        ) : (
          `Gerar Media Kit - ${studyCaseConfig.priceLabel}`
        )}
      </button>
    </form>
  );
}
