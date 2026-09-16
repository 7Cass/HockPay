import { parseReaisToCents } from './api-contracts';

/**
 * O produto sendo escrito, como a tela o guarda: tudo texto.
 *
 * A tela antiga usava `ReactiveForms` — e era a única do dashboard que usava.
 * O console inteiro é por sinal, então o formulário é um punhado de sinais e a
 * validação mora aqui, em função pura com teste, em vez de virar um
 * `Validators.required` que só se prova abrindo o navegador.
 */
export interface ProductDraft {
  readonly name: string;
  readonly price: string;
  readonly externalId: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly metadata: string;
}

export const EMPTY_DRAFT: ProductDraft = {
  name: '',
  price: '',
  externalId: '',
  description: '',
  imageUrl: '',
  metadata: '',
};

export type MetadataResult =
  | { readonly ok: true; readonly value: Record<string, unknown> | undefined }
  | { readonly ok: false; readonly message: string };

/**
 * O `metadata` é JSON digitado à mão, e é a única parte do formulário onde dá
 * para errar sem perceber.
 *
 * Vazio é ausência, não `{}`: mandar objeto vazio apagaria o metadata que já
 * estava gravado. Lista também não serve — a API guarda um mapa, e um array
 * entraria como `{"0": …}` na primeira leitura de quem consome.
 */
export function parseMetadata(text: string): MetadataResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: undefined };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: 'O metadata precisa ser um JSON válido.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'O metadata precisa ser um objeto JSON, como {"pedido": "123"}.' };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

/** O preço em centavos, pelo parser estrito. `0` quando não dá para ler. */
export function draftPrice(draft: ProductDraft): number {
  return parseReaisToCents(draft.price) ?? 0;
}

/**
 * O que impede de salvar — ou `null` quando está tudo certo.
 *
 * A ordem das perguntas é a ordem em que o campo aparece na folha, para o aviso
 * apontar sempre para o primeiro problema que a pessoa encontra descendo.
 */
export function productBlocker(draft: ProductDraft): string | null {
  if (!draft.name.trim()) return 'Dê um nome ao produto.';

  const price = draftPrice(draft);
  if (price <= 0) {
    // `10.50` é recusado pelo parser estrito de propósito: num campo em reais,
    // o ponto é separador de milhar, e aceitar os dois vira cobrança de mil.
    return 'Informe um preço em reais, como 49,90.';
  }

  const url = draft.imageUrl.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    return 'A URL da imagem precisa começar com http:// ou https://.';
  }

  const metadata = parseMetadata(draft.metadata);
  if (!metadata.ok) return metadata.message;

  return null;
}

/** O corpo que a API recebe, com os vazios omitidos em vez de virarem `""`. */
export function productPayload(draft: ProductDraft): Record<string, unknown> {
  const metadata = parseMetadata(draft.metadata);

  return {
    name: draft.name.trim(),
    price: draftPrice(draft),
    ...(draft.externalId.trim() ? { externalId: draft.externalId.trim() } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.imageUrl.trim() ? { imageUrl: draft.imageUrl.trim() } : {}),
    ...(metadata.ok && metadata.value ? { metadata: metadata.value } : {}),
  };
}
