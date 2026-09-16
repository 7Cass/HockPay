/**
 * Por onde um alerta sai.
 *
 * Hoje só o Discord está de pé. E-mail e WhatsApp aparecem na tela **como
 * prévia desligada**, de propósito: o lojista que procura "recebo por e-mail?"
 * merece a resposta "ainda não" no lugar onde ele procurou, e não o silêncio
 * de uma lista com uma opção só — que ele lê como "este produto não faz isso".
 *
 * `available: false` é o que desliga a opção na lista; a razão vira o texto ao
 * lado dela. Ligar um canal novo é trocar esse par, e mais nada na tela.
 */
export interface ChannelOption {
  readonly value: string;
  readonly label: string;
  readonly hint: string;
  readonly available: boolean;
}

export const CHANNEL_OPTIONS: readonly ChannelOption[] = [
  {
    value: 'discord',
    label: 'Discord',
    hint: 'Um webhook de canal do seu servidor.',
    available: true,
  },
  {
    value: 'email',
    label: 'E-mail',
    hint: 'Em breve.',
    available: false,
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Em breve.',
    available: false,
  },
];

export function channelLabel(value: string): string {
  return CHANNEL_OPTIONS.find((channel) => channel.value === value)?.label ?? value;
}

/**
 * O que impede de salvar este alerta — ou `null` quando está tudo certo.
 *
 * A URL é opcional **na edição**: a API não devolve a que já está gravada
 * (é segredo), então um campo vazio ali significa "mantenha a de antes", e não
 * "apague". Na criação, vazio é vazio e barra.
 */
export function alertBlocker(input: {
  name: string;
  webhookUrl: string;
  events: readonly string[];
  isEditing: boolean;
}): string | null {
  if (!input.name.trim()) return 'Dê um nome para reconhecer este alerta na lista.';

  if (!input.webhookUrl.trim()) {
    return input.isEditing
      ? null
      : 'Cole a URL do webhook do canal do Discord que vai receber os avisos.';
  }

  if (!isDiscordWebhook(input.webhookUrl)) {
    return 'Essa URL não parece um webhook do Discord. Ela começa com https://discord.com/api/webhooks/.';
  }

  if (input.events.length === 0) return 'Escolha pelo menos um evento para avisar.';

  return null;
}

/**
 * A conferência da URL, na tela.
 *
 * Existe para transformar um 400 do backend em uma frase antes do clique —
 * colar a URL do *canal* em vez da do *webhook* é o erro que todo mundo comete
 * na primeira vez, e as duas se parecem o bastante para ninguém notar.
 */
export function isDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === 'https:' &&
      /^(canary\.|ptb\.)?discord(app)?\.com$/.test(parsed.hostname) &&
      /^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/** O que mostrar de uma URL que a API só devolve mascarada. */
export function maskWebhookUrl(preview: string): string {
  if (!preview) return 'URL guardada';
  return preview;
}
