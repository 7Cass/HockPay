"use client";

import {
  Instagram,
  Music2,
  Youtube,
  Users,
  BarChart3,
  DollarSign,
  MapPin,
  Tag,
} from "lucide-react";

interface Props {
  data: Record<string, unknown>;
}

export function MediaKitRender({ data }: Props) {
  const creatorName = (data.creatorName as string) || "Criador";
  const bio = (data.bio as string) || "";
  const niche = (data.niche as string) || "";
  const location = (data.location as string) || "";
  const socials = (data.socials as Record<string, any>) || {};
  const audience = (data.audience as Record<string, any>) || {};
  const rates = (data.rates as Record<string, any>) || {};

  const ig = socials.instagram || {};
  const tt = socials.tiktok || {};
  const yt = socials.youtube || {};

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
            {creatorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{creatorName}</h1>
            {niche && (
              <p className="text-blue-100 flex items-center gap-1 mt-1">
                <Tag className="w-4 h-4" /> {niche}
              </p>
            )}
          </div>
        </div>
        {bio && <p className="text-blue-50 max-w-lg">{bio}</p>}
        {location && (
          <p className="text-blue-100 flex items-center gap-1 mt-3">
            <MapPin className="w-4 h-4" /> {location}
          </p>
        )}
      </div>

      {/* Social Metrics */}
      <div className="px-8 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Métricas das Redes
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {ig.followers && (
            <div className="bg-pink-50 rounded-xl p-5 text-center">
              <Instagram className="w-8 h-8 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{ig.followers}</p>
              <p className="text-sm text-gray-500">Instagram</p>
              {ig.engagement && (
                <p className="text-xs text-pink-600 mt-1">
                  Eng: {ig.engagement}
                </p>
              )}
            </div>
          )}
          {tt.followers && (
            <div className="bg-gray-50 rounded-xl p-5 text-center">
              <Music2 className="w-8 h-8 text-gray-900 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{tt.followers}</p>
              <p className="text-sm text-gray-500">TikTok</p>
              {tt.engagement && (
                <p className="text-xs text-gray-600 mt-1">
                  Eng: {tt.engagement}
                </p>
              )}
            </div>
          )}
          {yt.followers && (
            <div className="bg-red-50 rounded-xl p-5 text-center">
              <Youtube className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{yt.followers}</p>
              <p className="text-sm text-gray-500">YouTube</p>
              {yt.engagement && (
                <p className="text-xs text-red-600 mt-1">
                  Eng: {yt.engagement}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audience */}
      {(audience.age || audience.gender || audience.topCountries) && (
        <div className="px-8 py-8 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5" /> Audiência
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {audience.age && (
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {audience.age}
                </p>
                <p className="text-sm text-gray-500">Faixa Etária</p>
              </div>
            )}
            {audience.gender && (
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {audience.gender}
                </p>
                <p className="text-sm text-gray-500">Gênero</p>
              </div>
            )}
            {audience.topCountries && (
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {audience.topCountries}
                </p>
                <p className="text-sm text-gray-500">Top Países</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rates */}
      {(rates.post || rates.story || rates.video) && (
        <div className="px-8 py-8 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Tabela de Preços
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {rates.post && (
              <div className="bg-green-50 rounded-xl p-5 text-center">
                <p className="text-xl font-bold text-green-700">{rates.post}</p>
                <p className="text-sm text-gray-600">Post</p>
              </div>
            )}
            {rates.story && (
              <div className="bg-green-50 rounded-xl p-5 text-center">
                <p className="text-xl font-bold text-green-700">
                  {rates.story}
                </p>
                <p className="text-sm text-gray-600">Story</p>
              </div>
            )}
            {rates.video && (
              <div className="bg-green-50 rounded-xl p-5 text-center">
                <p className="text-xl font-bold text-green-700">
                  {rates.video}
                </p>
                <p className="text-sm text-gray-600">Vídeo</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-8 py-6 bg-gray-50 text-center text-sm text-gray-400 border-t border-gray-100">
        Media Kit gerado via HockPay • {new Date().toLocaleDateString("pt-BR")}
      </div>
    </div>
  );
}
