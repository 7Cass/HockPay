export interface MediaKitFormData {
  sessionId: string;
  creatorName: string;
  bio?: string;
  niche?: string;
  location?: string;
  socials?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  rates?: Record<string, unknown>;
}

export type StudyCaseTerminalStatus = "ready" | "failed" | "expired";

export interface StudyCaseWebhookEvent {
  event: string;
  terminalStatus: StudyCaseTerminalStatus;
}

export const studyCaseConfig = {
  id: "mediakit",
  metadataType: "mediakit",
  productName: "Media Kit Generator",
  productTitle: "Gere seu Media Kit Profissional",
  productDescription:
    "Preencha suas informações, pague via Pix e receba seu Media Kit instantaneamente.",
  amountInCents: 990,
  priceLabel: "R$ 9,90",
  successPath: "/success",
  webhookEvents: [
    { event: "payment.confirmed", terminalStatus: "ready" },
    { event: "payment.failed", terminalStatus: "failed" },
    { event: "payment.expired", terminalStatus: "expired" },
  ] satisfies StudyCaseWebhookEvent[],
  acceptanceChecklist: [
    "Criar checkout session pelo app demo",
    "Fulfill da checkout session no checkout hospedado",
    "Confirmar pagamento TEST via endpoint de simulação",
    "Receber webhook assinado no demo",
    "Renderizar página de sucesso com o artefato final",
  ],
  buildMetadata(input: MediaKitFormData): Record<string, unknown> {
    return {
      type: "mediakit",
      sessionId: input.sessionId,
      creatorName: input.creatorName,
      bio: input.bio || "",
      niche: input.niche || "",
      location: input.location || "",
      socials: input.socials || {},
      audience: input.audience || {},
      rates: input.rates || {},
    };
  },
};

export function getStudyCaseEvent(
  eventType: string,
): StudyCaseWebhookEvent | undefined {
  return studyCaseConfig.webhookEvents.find((item) => item.event === eventType);
}
