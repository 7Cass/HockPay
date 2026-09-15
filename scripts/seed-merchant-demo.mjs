/**
 * Semeia meses de operacao numa loja nova de um lojista que ja existe, para
 * validar a UI com dado que se parece com uso de verdade.
 *
 * O dinheiro passa pelos use-cases do core no proprio processo -- taxa, ledger,
 * recibo e outbox saem como sairiam da API -- e passa em ordem cronologica:
 * cada operacao roda "agora" e, logo depois, tudo o que ela gravou e deslocado
 * para a data planejada. Por isso o `balanceAfter` do extrato conta a historia
 * na ordem certa. Pela API, os milhares de passos esbarrariam no rate limit
 * (100 requisicoes/min por IP).
 *
 * So a configuracao que depende de servico da API -- loja, chaves, destino Pix,
 * webhook, alerta -- vai por HTTP: poucas chamadas.
 *
 * As entregas de webhook do passado sao escritas direto no banco, uma por
 * evento real do outbox, assinadas com o segredo de verdade. Com o webhook
 * ativo durante o replay, o worker despejaria milhares de entregas na inbox de
 * dev da API, que tem o mesmo rate limit por IP do navegador de quem esta
 * validando a tela. Evento novo, dali para frente, entrega de verdade.
 *
 *   printf 'senha\n' | pnpm seed:demo --email lojista@hockpay.local
 *   pnpm seed:demo --email lojista@hockpay.local --store "Café Figo" --months 6 --seed 7
 *
 * Exige a API de pe (HOCKPAY_API_URL) e o DATABASE_URL do .env. Cada execucao
 * cria uma loja nova; o lojista pode ter varias. A senha e lida por prompt ou
 * stdin, nunca por argumento, como no `operator:create`.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import QRCode from 'qrcode';
import {
  ALLOWED_WEBHOOK_EVENTS,
  CancelPaymentLinkUseCase,
  CompleteWithdrawalUseCase,
  ConfirmPaymentUseCase,
  CreateCheckoutSessionUseCase,
  CreateCustomerUseCase,
  CreatePaymentLinkUseCase,
  CreatePaymentUseCase,
  CreateProductUseCase,
  CreateRefundUseCase,
  CreateWithdrawalUseCase,
  CustomerCollectionMode,
  DomainError,
  Environment,
  ExpirePaymentUseCase,
  FailPaymentLinkUseCase,
  FailPaymentUseCase,
  FailWithdrawalUseCase,
  FeePolicy,
  FulfillCheckoutSessionUseCase,
  OpenPaymentLinkUseCase,
  PayPaymentLinkUseCase,
  ReleasePaymentUseCase,
  UpdateProductUseCase,
  WithdrawalPolicy,
} from '@hockpay/core';
import { Prisma, PrismaClient } from '@hockpay/database';
import {
  CustomerRepository,
  HmacSignerService,
  PaymentLinkRepository,
  PixChargeRepository,
  ProductRepository,
  StoreRepository,
  UnitOfWork,
  utcTimestamp,
} from '@hockpay/infrastructure';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333';
const PIX_KEY = process.env.PIX_KEY ?? 'test@hockpay.com';
const TEST = Environment.TEST;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Brasilia sem horario de verao (desde 2019): meia-noite local e 03:00 UTC. */
const BRT_OFFSET = 3 * HOUR;
/** TTL padrao da cobranca Pix na CreatePaymentUseCase. */
const PIX_TTL = 30 * MINUTE;
/** `Store.settlementDays` padrao: confirmado vira disponivel em D+30. */
const SETTLEMENT_DAYS = 30;
/**
 * Folga da janela de deslocamento: o que foi gravado ate 3 s antes da operacao
 * ainda conta como dela. Cobre o relogio do Postgres (VM do Docker) um pouco
 * atras do Node; linha de operacao anterior ja esta meses no passado.
 */
const WINDOW_SLACK = 3 * SECOND;

// ============================================================================
// ARGUMENTOS E SENHA
// ============================================================================

function parseArgs(argv) {
  const args = { store: 'Café Figo', city: 'Belo Horizonte', months: '6', scale: '1' };
  const valued = new Set(['--email', '--store', '--city', '--months', '--seed', '--scale']);

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === '--password' || current.startsWith('--password=')) {
      throw new Error(
        'senha por argumento nao e aceita: ela vaza em historico de shell e em lista de processos. Use o prompt ou stdin.',
      );
    }
    if (!valued.has(current)) {
      throw new Error(`argumento desconhecido: ${current}`);
    }

    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${current} precisa de um valor`);
    }
    args[current.slice(2)] = value;
    i += 1;
  }

  if (!args.email) {
    throw new Error(
      'uso: pnpm seed:demo --email <email> [--store <nome>] [--city <cidade>] [--months 6] [--seed <n>] [--scale 1]',
    );
  }

  const months = Number(args.months);
  const scale = Number(args.scale);
  const seed = args.seed === undefined ? Math.floor(Math.random() * 1e9) : Number(args.seed);
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    throw new Error('--months precisa ser um inteiro entre 1 e 12');
  }
  if (!Number.isFinite(scale) || scale < 0.05 || scale > 5) {
    throw new Error('--scale precisa ser um numero entre 0.05 e 5');
  }
  if (!Number.isInteger(seed)) {
    throw new Error('--seed precisa ser um inteiro');
  }

  return { ...args, months, scale, seed };
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return chunks.join('').split('\n')[0];
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const muted = { value: true };

  process.stdout.write('Senha do lojista: ');
  rl.output.write = (
    (write) =>
    (chunk, ...rest) =>
      muted.value && chunk !== '\n' && chunk !== '\r\n'
        ? true
        : write.call(rl.output, chunk, ...rest)
  )(rl.output.write);

  const password = await new Promise((resolve) => rl.question('', resolve));
  muted.value = false;
  rl.close();
  process.stdout.write('\n');

  return password;
}

// ============================================================================
// ACASO DETERMINISTICO
// ============================================================================

/** mulberry32: a mesma `--seed` conta a mesma historia. */
function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const between = (min, max) => min + next() * (max - min);
  const int = (min, max) => Math.floor(between(min, max + 1));
  const pick = (list) => list[Math.floor(next() * list.length)];
  const chance = (probability) => next() < probability;
  const weighted = (entries) => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  };
  const poisson = (lambda) => {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= next();
    } while (p > limit);
    return k - 1;
  };

  return { next, between, int, pick, chance, weighted, poisson };
}

// ============================================================================
// DADO BRASILEIRO
// ============================================================================

const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Camila',
  'Diego',
  'Eduarda',
  'Felipe',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Juliana',
  'Lucas',
  'Mariana',
  'Mateus',
  'Natália',
  'Otávio',
  'Paula',
  'Rafael',
  'Renata',
  'Rodrigo',
  'Sofia',
  'Thiago',
  'Vanessa',
  'Vinícius',
  'Larissa',
  'Gustavo',
  'Beatriz',
  'Caio',
  'Letícia',
  'André',
  'Fernanda',
  'Pedro',
  'Carolina',
  'Leonardo',
  'Aline',
  'Marcelo',
  'Patrícia',
  'Igor',
  'Tatiane',
  'Daniel',
  'Helena',
  'Arthur',
  'Luíza',
  'Miguel',
];
const LAST_NAMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Rodrigues',
  'Ferreira',
  'Alves',
  'Pereira',
  'Lima',
  'Gomes',
  'Costa',
  'Ribeiro',
  'Martins',
  'Carvalho',
  'Almeida',
  'Lopes',
  'Soares',
  'Fernandes',
  'Vieira',
  'Barbosa',
  'Rocha',
  'Dias',
  'Nascimento',
  'Andrade',
  'Moreira',
  'Nunes',
  'Marques',
  'Machado',
  'Mendes',
  'Freitas',
  'Cardoso',
  'Ramos',
  'Teixeira',
  'Moura',
  'Campos',
  'Pinto',
];
const EMAIL_DOMAINS = [
  ['gmail.com', 55],
  ['hotmail.com', 12],
  ['outlook.com', 12],
  ['icloud.com', 8],
  ['yahoo.com.br', 5],
  ['uol.com.br', 4],
  ['bol.com.br', 4],
];
const CITIES = [
  { city: 'Belo Horizonte', state: 'MG', zip: '30', ddd: '31', weight: 30 },
  { city: 'São Paulo', state: 'SP', zip: '01', ddd: '11', weight: 17 },
  { city: 'Rio de Janeiro', state: 'RJ', zip: '20', ddd: '21', weight: 9 },
  { city: 'Contagem', state: 'MG', zip: '32', ddd: '31', weight: 5 },
  { city: 'Nova Lima', state: 'MG', zip: '34', ddd: '31', weight: 4 },
  { city: 'Curitiba', state: 'PR', zip: '80', ddd: '41', weight: 5 },
  { city: 'Porto Alegre', state: 'RS', zip: '90', ddd: '51', weight: 4 },
  { city: 'Brasília', state: 'DF', zip: '70', ddd: '61', weight: 5 },
  { city: 'Salvador', state: 'BA', zip: '40', ddd: '71', weight: 4 },
  { city: 'Recife', state: 'PE', zip: '50', ddd: '81', weight: 3 },
  { city: 'Florianópolis', state: 'SC', zip: '88', ddd: '48', weight: 3 },
  { city: 'Campinas', state: 'SP', zip: '13', ddd: '19', weight: 4 },
  { city: 'Goiânia', state: 'GO', zip: '74', ddd: '62', weight: 3 },
  { city: 'Fortaleza', state: 'CE', zip: '60', ddd: '85', weight: 3 },
  { city: 'Vitória', state: 'ES', zip: '29', ddd: '27', weight: 2 },
];
const STREETS = [
  'Rua da Bahia',
  'Av. Afonso Pena',
  'Rua Pernambuco',
  'Av. do Contorno',
  'Rua Augusta',
  'Rua das Flores',
  'Av. Brasil',
  'Rua XV de Novembro',
  'Rua Sergipe',
  'Av. Getúlio Vargas',
  'Rua Tomé de Souza',
  'Rua Paraíba',
  'Av. Paulista',
  'Rua Oscar Freire',
  'Rua Voluntários da Pátria',
];
const COMPANIES = [
  { name: 'Padaria Estrela do Sul Ltda', slug: 'padariaestreladosul' },
  { name: 'Coworking Aurora Ltda', slug: 'coworkingaurora' },
  { name: 'Cafeteria Grão Mineiro ME', slug: 'graomineiro' },
  { name: 'Empório Serra Verde Ltda', slug: 'emporioserraverde' },
  { name: 'Hotel Pampulha Garden S.A.', slug: 'pampulhagarden' },
  { name: 'Livraria Café das Letras ME', slug: 'cafedasletras' },
];

/**
 * O catalogo da Figo. `launchDay`/`archiveDay` contam a partir do inicio do
 * periodo; `weight` e a popularidade no carrinho (0 = so vende por fluxo proprio).
 */
const CATALOG = [
  {
    key: 'catuai-250',
    name: 'Figo Catuaí Vermelho 250g',
    description: 'Torra média, notas de caramelo e laranja. Cerrado Mineiro.',
    price: 4890,
    category: 'graos',
    weight: 16,
  },
  {
    key: 'bourbon-250',
    name: 'Figo Bourbon Amarelo 250g',
    description: 'Torra clara, doce e floral. Sul de Minas.',
    price: 5490,
    category: 'graos',
    weight: 12,
  },
  {
    key: 'blend-500',
    name: 'Blend da Casa 500g',
    description: 'O café do balcão da Figo. Chocolate e castanhas.',
    price: 6990,
    category: 'graos',
    weight: 14,
    repriceDay: 95,
    repriceTo: 7490,
  },
  {
    key: 'blend-1kg',
    name: 'Blend da Casa 1kg',
    description: 'Pacote de 1kg para quem passa muito café (ou tem cafeteria).',
    price: 12490,
    category: 'graos',
    weight: 7,
  },
  {
    key: 'descaf-250',
    name: 'Descafeinado Suave 250g',
    description: 'Processo Swiss Water, sem abrir mão do sabor.',
    price: 4690,
    category: 'graos',
    weight: 4,
  },
  {
    key: 'mantiqueira-250',
    name: 'Microlote Mantiqueira 250g',
    description: 'Lote de 300kg, fermentação natural. Edição limitada.',
    price: 7290,
    category: 'graos',
    weight: 7,
    launchDay: 58,
  },
  {
    key: 'geisha-100',
    name: 'Figo Geisha Lote 07 100g',
    description: 'Jasmim, bergamota e mel. 89 pontos SCA.',
    price: 12900,
    category: 'graos',
    weight: 3,
    launchDay: 104,
  },
  {
    key: 'coldbrew-500',
    name: 'Cold Brew em Garrafa 500ml',
    description: 'Extração a frio por 18 horas.',
    price: 2490,
    category: 'bebidas',
    weight: 8,
  },
  {
    key: 'assinatura-mensal',
    name: 'Assinatura Mensal — 2 pacotes',
    description: 'Dois cafés de 250g escolhidos pela casa, todo mês.',
    price: 8990,
    category: 'assinatura',
    weight: 0,
  },
  {
    key: 'assinatura-trimestral',
    name: 'Assinatura Trimestral — 6 pacotes',
    description: 'Três meses de café, com 10% de desconto.',
    price: 24290,
    category: 'assinatura',
    weight: 0,
    launchDay: 45,
  },
  {
    key: 'kit-v60',
    name: 'Kit V60 Iniciante',
    description: 'Suporte V60, jarra de vidro e 40 filtros.',
    price: 18900,
    category: 'metodos',
    weight: 5,
  },
  {
    key: 'prensa-600',
    name: 'Prensa Francesa 600ml',
    description: 'Vidro borossilicato e filtro de aço inox.',
    price: 15900,
    category: 'metodos',
    weight: 4,
  },
  {
    key: 'moedor',
    name: 'Moedor Manual Cônico',
    description: 'Mós de cerâmica, 18 ajustes de moagem.',
    price: 34900,
    category: 'metodos',
    weight: 2,
  },
  {
    key: 'balanca',
    name: 'Balança com Timer',
    description: 'Precisão de 0,1 g para acertar a receita.',
    price: 12900,
    category: 'metodos',
    weight: 3,
  },
  {
    key: 'chaleira',
    name: 'Chaleira Bico de Ganso 1L',
    description: 'Controle de fluxo para métodos filtrados.',
    price: 22900,
    category: 'metodos',
    weight: 2,
  },
  {
    key: 'filtros',
    name: 'Filtros de Papel V60 (100 un.)',
    description: 'Filtros brancos, sem gosto de papel.',
    price: 3290,
    category: 'acessorios',
    weight: 9,
  },
  {
    key: 'caneca',
    name: 'Caneca Esmaltada Figo',
    description: 'Ágata esmaltada, 350 ml. Vai ao fogo.',
    price: 6900,
    category: 'acessorios',
    weight: 5,
  },
  {
    key: 'ecobag',
    name: 'Ecobag Figo',
    description: 'Algodão cru com o figo bordado.',
    price: 3990,
    category: 'acessorios',
    weight: 3,
  },
  {
    key: 'curso-online',
    name: 'Curso Barista em Casa (online)',
    description: '6 aulas gravadas e certificado.',
    price: 19700,
    category: 'cursos',
    weight: 3,
  },
  {
    key: 'latte-art',
    name: 'Workshop de Latte Art (presencial)',
    description: '3 horas na nossa cafeteria, turma de 8 pessoas.',
    price: 34000,
    category: 'cursos',
    weight: 2,
  },
  {
    key: 'degustacao',
    name: 'Degustação Guiada para 2',
    description: 'Cupping de cinco cafés com o nosso torrefador.',
    price: 16000,
    category: 'cursos',
    weight: 2,
  },
  {
    key: 'vale-100',
    name: 'Vale-presente R$ 100',
    description: 'Vale digital para usar na loja ou na cafeteria.',
    price: 10000,
    category: 'presente',
    weight: 3,
  },
  {
    key: 'natal-2025',
    name: 'Figo Natal 2025 250g',
    description: 'Edição de fim de ano. Encerrada.',
    price: 5990,
    category: 'graos',
    weight: 6,
    archiveDay: 18,
  },
];

const PAYMENT_FAILURES = [
  'insufficient_funds',
  'payer_bank_unavailable',
  'pix_key_mismatch',
  'psp_timeout',
];
const REFUND_REASONS = [
  'Cliente desistiu da compra',
  'Produto indisponível no estoque',
  'Cobrança duplicada',
  'Avaria no transporte',
  'Ajuste de frete',
];
const WITHDRAWAL_FAILURES = [
  'Chave Pix do recebedor não encontrada no DICT',
  'Instituição de destino indisponível',
];

function cpfDigit(digits, weight) {
  const sum = digits.reduce((acc, digit, index) => acc + digit * (weight - index), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

function cnpjDigit(digits) {
  const weights =
    digits.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// ============================================================================
// TEMPO
// ============================================================================

function localDayStart(ms) {
  const local = new Date(ms - BRT_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BRT_OFFSET;
}

function localParts(ms) {
  const local = new Date(ms - BRT_OFFSET);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

function nthWeekday(year, month, weekday, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}

/** Datas que mexem no varejo de cafe: o volume sobe na semana que antecede cada uma. */
function spikeFactor(ms) {
  const { year, month, day } = localParts(ms);
  const dayOfYear = (m, d) => Date.UTC(year, m - 1, d);
  const today = dayOfYear(month, day);
  const occasions = [
    [dayOfYear(5, nthWeekday(year, 5, 0, 2)), 7, 1.8], // Dia das Maes
    [dayOfYear(5, 24), 3, 1.5], // Dia Nacional do Cafe
    [dayOfYear(6, 12), 5, 1.6], // Dia dos Namorados
    [dayOfYear(8, nthWeekday(year, 8, 0, 2)), 6, 1.7], // Dia dos Pais
    [dayOfYear(11, 30 - ((new Date(Date.UTC(year, 10, 30)).getUTCDay() + 2) % 7)), 4, 2.2], // Black Friday
    [dayOfYear(12, 24), 18, 1.6], // Natal
  ];
  for (const [date, before, factor] of occasions) {
    if (today <= date && today >= date - before * DAY) return factor;
  }
  return 1;
}

const HOUR_WEIGHTS = [
  1, 0.5, 0.3, 0.2, 0.2, 0.4, 1, 2.5, 4, 5, 5.5, 5, 4.5, 4, 4, 4.2, 4.5, 4.8, 5.5, 6.5, 7, 6.5, 4.5,
  2.5,
];
/** Dom..Sab: sexta e sabado vendem mais, domingo menos. */
const WEEKDAY_FACTOR = [0.8, 0.9, 0.95, 1, 1.05, 1.2, 1.3];

function formatDate(ms) {
  return new Date(ms - BRT_OFFSET).toISOString().slice(0, 10).split('-').reverse().join('/');
}

function formatMoney(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ============================================================================
// LINHA DO TEMPO
// ============================================================================

/** Fila de prioridade por instante: cada passo pode agendar os seguintes. */
class Timeline {
  #heap = [];
  #sequence = 0;

  constructor(horizon) {
    this.horizon = horizon;
  }

  get size() {
    return this.#heap.length;
  }

  /** Agenda `run` em `at`; o que cai depois do horizonte fica para o tempo real. */
  at(at, label, run) {
    if (at > this.horizon) return false;
    const item = { at, sequence: (this.#sequence += 1), label, run };
    const heap = this.#heap;
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#before(heap[parent], heap[index])) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
    return true;
  }

  next() {
    const heap = this.#heap;
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && this.#before(heap[left], heap[smallest])) smallest = left;
        if (right < heap.length && this.#before(heap[right], heap[smallest])) smallest = right;
        if (smallest === index) break;
        [heap[smallest], heap[index]] = [heap[index], heap[smallest]];
        index = smallest;
      }
    }
    return top;
  }

  #before(a, b) {
    return a.at < b.at || (a.at === b.at && a.sequence < b.sequence);
  }
}

// ============================================================================
// HTTP (so a configuracao)
// ============================================================================

function createApi() {
  const jar = new Map();

  async function call(path, { method = 'GET', body, apiKey } = {}) {
    for (let attempt = 1; ; attempt += 1) {
      const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      let response;
      try {
        response = await fetch(`${API_URL}${path}`, {
          method,
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : cookie ? { Cookie: cookie } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        throw new Error(
          `nao alcancei ${method} ${API_URL}${path}; a API esta de pe? (${error.message})`,
        );
      }

      for (const header of response.headers.getSetCookie?.() ?? []) {
        const [pair] = header.split(';');
        const separator = pair.indexOf('=');
        if (separator > 0)
          jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }

      const text = await response.text();
      if (response.status === 429 && attempt < 5) {
        const wait = (Number(response.headers.get('retry-after')) || 15) * SECOND;
        console.log(`[seed] rate limit em ${method} ${path}; esperando ${wait / SECOND}s`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      if (!response.ok) {
        throw new Error(`${method} ${path} respondeu ${response.status}: ${text}`);
      }

      const data = text ? JSON.parse(text) : undefined;
      if (data?.accessToken) jar.set('hockpay_at', data.accessToken);
      if (data?.refreshToken) jar.set('hockpay_rt', data.refreshToken);
      return data;
    }
  }

  return { call };
}

// ============================================================================
// PORTAS QUE MORAM NA API
// ============================================================================

/** Mesmo BR Code EMV da `PixQrCodeGeneratorService` da API. */
function createPixGenerator() {
  const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;
  const clean = (value, max) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toUpperCase()
      .slice(0, max);
  const crc16 = (text) => {
    let crc = 0xffff;
    for (let i = 0; i < text.length; i += 1) {
      crc ^= text.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  };

  return {
    async generate({ pixKey, amountInCents, merchantName, merchantCity, txId }) {
      const id = txId ?? randomUUID().replace(/-/g, '').slice(0, 25);
      const withoutCrc =
        field('00', '01') +
        field('01', '11') +
        field('26', field('00', 'BR.GOV.BCB.PIX') + field('01', pixKey)) +
        field('52', '0000') +
        field('53', '986') +
        field('54', (amountInCents / 100).toFixed(2)) +
        field('58', 'BR') +
        field('59', clean(merchantName, 25)) +
        field('60', clean(merchantCity, 15)) +
        field('62', field('05', id)) +
        '6304';
      const copyPaste = withoutCrc + crc16(withoutCrc);
      const qrCodeBase64 = await QRCode.toDataURL(copyPaste, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
      });
      return { qrCodeBase64, copyPaste, txId: id };
    },
  };
}

const tokenGenerator = {
  generate: (bytes = 32) => randomBytes(bytes).toString('hex'),
  generateBase64: (bytes = 32) => randomBytes(bytes).toString('base64url'),
  hash: (value) => createHash('sha256').update(value).digest('hex'),
  generateUUID: () => randomUUID(),
};

/** A varredura do worker ja expira pendente de verdade; o replay decide o resto. */
const noExpirationQueue = {
  scheduleExpiration: async () => {},
  cancelExpiration: async () => {},
};

// ============================================================================
// O SEED
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = (await readPassword()).trim();
  if (!password) throw new Error('senha vazia');

  const prisma = new PrismaClient();
  try {
    await seed(prisma, args, password);
  } finally {
    await prisma.$disconnect();
  }
}

async function seed(prisma, args, password) {
  const random = createRandom(args.seed);
  const { between, int, pick, chance, weighted, poisson } = random;
  const api = createApi();
  const now = Date.now();
  const periodStart = localDayStart(now - args.months * 30.44 * DAY);
  const horizon = now - 3 * MINUTE;
  const span = horizon - periodStart;
  const dayAt = (day) => periodStart + day * DAY;
  const clampToHorizon = (at) => Math.min(at, horizon);

  const stats = new Map();
  const bump = (key, by = 1) => stats.set(key, (stats.get(key) ?? 0) + by);
  const failures = new Map();

  console.log(
    `[seed] ${args.store} · ${formatDate(periodStart)} → ${formatDate(now)} · seed ${args.seed} · escala ${args.scale}`,
  );

  // ── Configuracao por HTTP ─────────────────────────────────────────────────
  await api.call('/auth/login', { method: 'POST', body: { email: args.email, password } });
  const meResponse = await api.call('/merchants/me');
  const me = meResponse?.merchant ?? meResponse;
  const slug = `${slugify(args.store).slice(0, 36) || 'loja'}-${randomBytes(3).toString('hex')}`;
  const { store } = await api.call('/stores', { method: 'POST', body: { name: args.store, slug } });
  await api.call(`/stores/${store.id}`, {
    method: 'PATCH',
    body: { name: args.store, city: args.city },
  });

  const shopKey = await api.call('/api-keys', {
    method: 'POST',
    body: { name: 'Loja virtual', environment: 'TEST' },
  });
  const erpKey = await api.call('/api-keys', {
    method: 'POST',
    body: { name: 'ERP · Bling', environment: 'TEST' },
  });
  const oldKey = await api.call('/api-keys', {
    method: 'POST',
    body: { name: 'Script de importação (antigo)', environment: 'TEST' },
  });
  await api.call(`/api-keys/${oldKey.id}/revoke`, { method: 'POST' });

  const mainBank = await api.call('/bank-accounts', {
    method: 'POST',
    body: {
      pixKey: me.document,
      pixKeyType: me.documentType ?? 'CPF',
      holderName: me.name,
      holderDocument: me.document,
      isDefault: true,
    },
  });
  const emailBank = await api.call('/bank-accounts', {
    method: 'POST',
    body: {
      pixKey: 'financeiro@cafe-figo.example',
      pixKeyType: 'EMAIL',
      holderName: me.name,
      holderDocument: me.document,
      isDefault: false,
    },
  });

  const storeId = store.id;
  const account = await prisma.account.findUniqueOrThrow({
    where: { storeId_environment: { storeId, environment: 'TEST' } },
  });
  const accountId = account.id;

  // A loja nasce uma semana antes da primeira venda; o resto da configuracao, em volta.
  const setupAt = periodStart - 8 * DAY;
  await prisma.merchant.update({
    where: { id: me.id },
    data: { createdAt: new Date(setupAt - DAY), updatedAt: new Date(setupAt - DAY) },
  });
  await prisma.store.update({
    where: { id: storeId },
    data: { createdAt: new Date(setupAt), updatedAt: new Date(setupAt + 2 * HOUR) },
  });
  await prisma.apiKey.update({
    where: { id: shopKey.id },
    data: { createdAt: new Date(setupAt + HOUR), lastUsedAt: new Date(now - int(2, 9) * MINUTE) },
  });
  await prisma.apiKey.update({
    where: { id: erpKey.id },
    data: {
      createdAt: new Date(dayAt(40) + 15 * HOUR),
      lastUsedAt: new Date(now - int(1, 5) * HOUR),
    },
  });
  await prisma.apiKey.update({
    where: { id: oldKey.id },
    data: {
      createdAt: new Date(setupAt + 2 * HOUR),
      lastUsedAt: new Date(dayAt(50) + 11 * HOUR),
      revokedAt: new Date(dayAt(52) + 16 * HOUR),
    },
  });
  await prisma.bankAccount.update({
    where: { id: mainBank.id },
    data: { createdAt: new Date(setupAt + 3 * HOUR), updatedAt: new Date(setupAt + 3 * HOUR) },
  });
  await prisma.bankAccount.update({
    where: { id: emailBank.id },
    data: {
      createdAt: new Date(dayAt(70) + 13 * HOUR),
      updatedAt: new Date(dayAt(70) + 13 * HOUR),
    },
  });
  console.log(`[seed] loja ${storeId} criada; replay comecando`);

  // ── Use-cases do core, no processo ────────────────────────────────────────
  const unitOfWork = new UnitOfWork(prisma);
  const pix = createPixGenerator();
  const feePolicy = new FeePolicy();
  const linkRepository = new PaymentLinkRepository(prisma, CHECKOUT_BASE_URL);
  const chargeRepository = new PixChargeRepository(prisma);
  const productRepository = new ProductRepository(prisma);

  const createPayment = new CreatePaymentUseCase(
    unitOfWork,
    pix,
    noExpirationQueue,
    feePolicy,
    PIX_KEY,
  );
  const confirmPayment = new ConfirmPaymentUseCase(unitOfWork);
  const failPayment = new FailPaymentUseCase(unitOfWork, noExpirationQueue);
  const expirePayment = new ExpirePaymentUseCase(unitOfWork, noExpirationQueue);
  const releasePayment = new ReleasePaymentUseCase(unitOfWork);
  const createRefund = new CreateRefundUseCase(unitOfWork);
  const createWithdrawal = new CreateWithdrawalUseCase(unitOfWork, new WithdrawalPolicy());
  const completeWithdrawal = new CompleteWithdrawalUseCase(unitOfWork);
  const failWithdrawal = new FailWithdrawalUseCase(unitOfWork);
  const createLink = new CreatePaymentLinkUseCase(
    linkRepository,
    chargeRepository,
    new StoreRepository(prisma),
    tokenGenerator,
    pix,
    CHECKOUT_BASE_URL,
    PIX_KEY,
    unitOfWork,
  );
  const payLink = new PayPaymentLinkUseCase(linkRepository, unitOfWork, feePolicy);
  const failLink = new FailPaymentLinkUseCase(linkRepository, unitOfWork, feePolicy);
  const cancelLink = new CancelPaymentLinkUseCase(linkRepository, chargeRepository, unitOfWork);
  const openLink = new OpenPaymentLinkUseCase(linkRepository);
  const createSession = new CreateCheckoutSessionUseCase(
    unitOfWork,
    tokenGenerator,
    CHECKOUT_BASE_URL,
  );
  const fulfillSession = new FulfillCheckoutSessionUseCase(unitOfWork, createPayment);
  const createCustomer = new CreateCustomerUseCase(new CustomerRepository(prisma));
  const createProduct = new CreateProductUseCase(productRepository);
  const updateProduct = new UpdateProductUseCase(productRepository);

  // ── Viagem no tempo ───────────────────────────────────────────────────────
  // Duas colunas ficam de fora de proposito, porque o worker age sobre elas
  // enquanto o replay ainda esta no passado: `expires_at` (a varredura
  // expiraria um pagamento entre a criacao e a confirmacao) e `payments.paid_at`
  // (o settlement, que em dev roda a cada 30 s, liberaria todo confirmado com
  // mais de D+30 no instante em que ele nasce). As duas recebem o valor
  // planejado no acabamento, em `settlePaidAt` e `settleExpirations`.
  const byStore = Prisma.sql`store_id = ${storeId}`;
  const byPayment = Prisma.sql`payment_id IN (SELECT id FROM payments WHERE store_id = ${storeId})`;
  const shiftTargets = [
    ['payments', ['created_at', 'updated_at', 'released_at'], byStore],
    ['pix_charges', ['created_at', 'updated_at', 'paid_at', 'cancelled_at'], byStore],
    ['payment_items', ['created_at', 'updated_at'], byPayment],
    ['customers', ['created_at', 'updated_at'], byStore],
    ['products', ['created_at', 'updated_at'], byStore],
    ['checkout_sessions', ['created_at', 'updated_at'], byStore],
    [
      'checkout_session_items',
      ['created_at', 'updated_at'],
      Prisma.sql`checkout_session_id IN (SELECT id FROM checkout_sessions WHERE store_id = ${storeId})`,
    ],
    ['payment_links', ['created_at', 'updated_at', 'opened_at', 'cancelled_at'], byStore],
    [
      'payment_link_items',
      ['created_at', 'updated_at'],
      Prisma.sql`payment_link_id IN (SELECT id FROM payment_links WHERE store_id = ${storeId})`,
    ],
    ['refunds', ['created_at', 'processed_at'], byPayment],
    ['receipts', ['created_at', 'updated_at', 'issued_at'], byStore],
    ['transactions', ['created_at', 'updated_at'], Prisma.sql`account_id = ${accountId}`],
    [
      'withdrawals',
      ['created_at', 'updated_at', 'paid_at', 'next_process_at'],
      Prisma.sql`account_id = ${accountId}`,
    ],
  ];

  let requestSequence = 0;
  const requestId = () => `seed-${args.seed}-${(requestSequence += 1)}`;

  async function shiftWritten(since, deltaMs, requestIds, { keepExpiry = false } = {}) {
    const from = utcTimestamp(since);
    const statements = shiftTargets.map(([table, columns, scope]) => {
      const sets = columns.map((column) => {
        const c = Prisma.raw(column);
        return Prisma.sql`${c} = CASE WHEN ${c} >= ${from} THEN ${c} - INTERVAL '1 millisecond' * ${deltaMs}::float8 ELSE ${c} END`;
      });
      const touched = columns.map((column) => Prisma.sql`${Prisma.raw(column)} >= ${from}`);
      return prisma.$executeRaw`UPDATE ${Prisma.raw(table)} SET ${Prisma.join(sets, ', ')} WHERE ${scope} AND (${Prisma.join(touched, ' OR ')})`;
    });
    await prisma.$transaction(statements);

    // O payload do outbox e um retrato da entidade: as datas dentro dele viajam junto.
    const events = await prisma.$queryRaw`
      SELECT id, payload FROM outbox_events
      WHERE created_at >= ${from}
        AND (payload->>'storeId' = ${storeId} OR request_id = ANY(${requestIds}::text[]))`;
    for (const event of events) {
      const payload = shiftDates(event.payload, since.getTime(), deltaMs, keepExpiry);
      await prisma.$executeRaw`
        UPDATE outbox_events
        SET created_at = created_at - INTERVAL '1 millisecond' * ${deltaMs}::float8,
            payload = ${JSON.stringify(payload)}::jsonb
        WHERE id = ${event.id}`;
    }
  }

  /** Roda `work` agora e manda o que ela gravou para `at`. */
  async function travel(at, work, options) {
    const wall = Date.now();
    const ids = [];
    const rid = () => {
      const id = requestId();
      ids.push(id);
      return id;
    };
    try {
      return await work(rid);
    } finally {
      await shiftWritten(new Date(wall - WINDOW_SLACK), wall - at, ids, options);
    }
  }

  // ── Catalogo e clientes ───────────────────────────────────────────────────
  const timeline = new Timeline(horizon);
  const products = new Map();
  const customers = [];
  const payments = new Map();
  const plannedPaidAt = new Map();
  const plannedLinkExpiry = new Map();
  let orderNumber = 10231;

  const onSale = (entry, at) =>
    products.has(entry.key) &&
    at >= dayAt(entry.launchDay ?? 0) &&
    !(entry.archiveDay !== undefined && at >= dayAt(entry.archiveDay));

  for (const [index, entry] of CATALOG.entries()) {
    const at = entry.launchDay
      ? dayAt(entry.launchDay) + 9 * HOUR + index * MINUTE
      : setupAt + DAY + index * 4 * MINUTE;
    timeline.at(at, 'product.create', async () => {
      const { product } = await travel(at, () =>
        createProduct.execute({
          storeId,
          environment: TEST,
          externalId: `sku-${entry.key}`,
          name: entry.name,
          description: entry.description,
          price: entry.price,
          metadata: { categoria: entry.category },
        }),
      );
      products.set(entry.key, { ...entry, id: product.id });
      bump('produtos');
    });

    if (entry.archiveDay !== undefined) {
      const archiveAt = dayAt(entry.archiveDay) + 18 * HOUR;
      timeline.at(archiveAt, 'product.archive', () =>
        travel(archiveAt, () =>
          updateProduct.execute({
            storeId,
            environment: TEST,
            productId: products.get(entry.key).id,
            isActive: false,
          }),
        ),
      );
    }
    if (entry.repriceDay !== undefined) {
      const repriceAt = dayAt(entry.repriceDay) + 8 * HOUR;
      timeline.at(repriceAt, 'product.reprice', async () => {
        await travel(repriceAt, () =>
          updateProduct.execute({
            storeId,
            environment: TEST,
            productId: products.get(entry.key).id,
            price: entry.repriceTo,
          }),
        );
        products.get(entry.key).price = entry.repriceTo;
      });
    }
  }

  const documents = new Set();
  const emails = new Set();
  const newCpf = () => {
    for (;;) {
      const digits = Array.from({ length: 9 }, () => int(0, 9));
      if (new Set(digits).size === 1) continue;
      digits.push(cpfDigit(digits, 10));
      digits.push(cpfDigit(digits, 11));
      const value = digits.join('');
      if (!documents.has(value)) {
        documents.add(value);
        return value;
      }
    }
  };
  const newCnpj = () => {
    for (;;) {
      const digits = [...Array.from({ length: 8 }, () => int(0, 9)), 0, 0, 0, 1];
      digits.push(cnpjDigit(digits));
      digits.push(cnpjDigit(digits));
      const value = digits.join('');
      if (!documents.has(value)) {
        documents.add(value);
        return value;
      }
    }
  };
  const address = () => {
    const place = weighted(CITIES.map((entry) => [entry, entry.weight]));
    return {
      place,
      street: pick(STREETS),
      number: String(int(12, 2480)),
      complement: chance(0.35) ? `Apto ${int(1, 18)}0${int(1, 4)}` : undefined,
      city: place.city,
      state: place.state,
      zipCode: `${place.zip}${String(int(100000, 999999))}`,
    };
  };
  let customerSequence = 0;

  function makePerson(since, { externalId = chance(0.65), weight = 1 } = {}) {
    const first = pick(FIRST_NAMES);
    const last = `${pick(LAST_NAMES)}${chance(0.3) ? ` ${pick(LAST_NAMES)}` : ''}`;
    const where = address();
    let email;
    do {
      email = `${slugify(first)}.${slugify(last.split(' ').at(-1))}${chance(0.4) ? int(1, 99) : ''}@${weighted(EMAIL_DOMAINS)}`;
    } while (emails.has(email));
    emails.add(email);
    customerSequence += 1;
    return {
      kind: 'pf',
      externalId: externalId ? `cli_${String(customerSequence).padStart(5, '0')}` : undefined,
      name: `${first} ${last}`,
      firstName: first,
      email,
      document: newCpf(),
      phone: `${where.place.ddd}9${int(8000, 9999)}${int(1000, 9999)}`,
      ...where,
      since,
      weight,
    };
  }

  const customerPayload = (customer) => ({
    ...(customer.externalId ? { externalId: customer.externalId } : {}),
    document: customer.document,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    street: customer.street,
    number: customer.number,
    ...(customer.complement ? { complement: customer.complement } : {}),
    city: customer.city,
    state: customer.state,
    zipCode: customer.zipCode,
    country: 'BR',
  });

  function registerExplicit(customer, at, origin) {
    timeline.at(at, 'customer.create', async () => {
      await travel(at, () =>
        createCustomer.execute({
          storeId,
          ...customerPayload(customer),
          metadata: { origem: origin },
        }),
      );
      bump('clientes cadastrados');
    });
  }

  // Clientes antigos, importados de planilha antes da primeira venda.
  const imported = Math.round(30 * Math.min(args.scale * 1.5, 3));
  for (let i = 0; i < imported; i += 1) {
    const customer = makePerson(setupAt + 3 * DAY, {
      externalId: true,
      weight: random.between(0.8, 3),
    });
    customers.push(customer);
    registerExplicit(
      customer,
      setupAt + 3 * DAY + 10 * HOUR + i * 20 * SECOND,
      'importacao-planilha',
    );
  }
  // Quem se cadastra na loja ao longo do periodo: mais gente no fim, com o crescimento.
  const registered = Math.round(150 * args.scale);
  for (let i = 0; i < registered; i += 1) {
    const since = periodStart + span * Math.sqrt(random.next());
    const customer = makePerson(since, { externalId: true, weight: random.between(0.3, 2.5) });
    customers.push(customer);
    registerExplicit(customer, since, 'cadastro-loja');
  }
  // Atacado: cafeterias, padaria, hotel -- CNPJ, pedido grande e recorrente.
  const companies = COMPANIES.slice(
    0,
    Math.max(2, Math.round(COMPANIES.length * Math.min(args.scale, 1))),
  ).map((company, index) => {
    const where = address();
    const since = dayAt(int(0, Math.min(40, args.months * 20))) + 11 * HOUR;
    const customer = {
      kind: 'pj',
      externalId: `cli_pj_${String(index + 1).padStart(3, '0')}`,
      name: company.name,
      firstName: company.name.split(' ')[0],
      email: `compras@${company.slug}.example`,
      document: newCnpj(),
      phone: `${where.place.ddd}3${int(200, 399)}${int(1000, 9999)}`,
      ...where,
      since,
      weight: 0,
    };
    registerExplicit(customer, since, 'atacado');
    return customer;
  });

  /** Quem compra em `at`: a maioria volta, uma parte chega pela primeira vez. */
  function chooseCustomer(at) {
    if (chance(0.22)) {
      const guest = makePerson(at, { externalId: false, weight: random.between(0.1, 0.6) });
      customers.push(guest);
      return guest;
    }
    const eligible = customers.filter((customer) => customer.since <= at && customer.weight > 0);
    if (eligible.length === 0) {
      const guest = makePerson(at, { externalId: false, weight: 0.5 });
      customers.push(guest);
      return guest;
    }
    return weighted(eligible.map((customer) => [customer, customer.weight]));
  }

  function chooseItems(at, { categories } = {}) {
    const available = CATALOG.filter(
      (entry) =>
        entry.weight > 0 &&
        onSale(entry, at) &&
        (!categories || categories.includes(entry.category)),
    );
    if (available.length === 0) return [];
    const count = Math.min(
      available.length,
      weighted([
        [1, 60],
        [2, 28],
        [3, 12],
      ]),
    );
    const chosen = [];
    while (chosen.length < count) {
      const entry = weighted(
        available
          .filter((candidate) => !chosen.some((item) => item.entry === candidate))
          .map((candidate) => [candidate, candidate.weight]),
      );
      const maxQuantity = entry.category === 'bebidas' ? 4 : entry.category === 'graos' ? 3 : 1;
      chosen.push({
        entry,
        quantity: Math.min(
          maxQuantity,
          weighted([
            [1, 80],
            [2, 16],
            [3, 4],
          ]),
        ),
      });
    }
    return chosen;
  }

  const itemsTotal = (items) =>
    items.reduce((sum, item) => sum + products.get(item.entry.key).price * item.quantity, 0);
  const itemsLabel = (items) =>
    items.map((item) => `${item.quantity}× ${item.entry.name}`).join(', ');
  const lineItems = (items) =>
    items.map((item) => ({ productId: products.get(item.entry.key).id, quantity: item.quantity }));

  // ── Desfechos ─────────────────────────────────────────────────────────────
  function trackConfirmed(payment, paidAt) {
    payments.set(payment.id, { amount: payment.amount, status: 'CONFIRMED', refunded: 0 });
    plannedPaidAt.set(payment.id, paidAt);
    bump('confirmados');

    // Libera no primeiro 00:00 depois de D+30, como o settlement de producao
    // (o padrao do cron e meia-noite; em dev ele roda a cada 30 s).
    const releaseAt = localDayStart(paidAt + SETTLEMENT_DAYS * DAY) + DAY + int(1, 40) * MINUTE;
    timeline.at(releaseAt, 'payment.release', async () => {
      if (payments.get(payment.id)?.status !== 'CONFIRMED') return;
      await travel(releaseAt, (rid) =>
        releasePayment.execute({
          storeId,
          paymentId: payment.id,
          requestId: rid(),
          callerEnvironment: TEST,
        }),
      );
      payments.get(payment.id).status = 'RELEASED';
      bump('liberados');
    });

    if (chance(0.035)) {
      const refundAt = paidAt + between(0.5, 12) * DAY;
      const full = chance(0.6);
      timeline.at(refundAt, 'payment.refund', async () => {
        const tracked = payments.get(payment.id);
        const remaining = tracked.amount - tracked.refunded;
        const amount = full
          ? remaining
          : Math.max(500, Math.round((tracked.amount * between(0.15, 0.5)) / 10) * 10);
        if (amount > remaining || amount <= 0) return;
        await travel(refundAt, (rid) =>
          createRefund.execute({
            storeId,
            paymentId: payment.id,
            requestId: rid(),
            amount,
            reason: full ? pick(REFUND_REASONS) : 'Ajuste de frete',
            callerEnvironment: TEST,
          }),
        );
        tracked.refunded += amount;
        if (tracked.refunded >= tracked.amount) tracked.status = 'REFUNDED';
        bump(full ? 'estornos totais' : 'estornos parciais');
      });
    }
  }

  /** Leva um pagamento pendente ao desfecho planejado. */
  function settle(paymentId, createdAt, outcome, retry) {
    if (outcome === 'confirmed') {
      const at = clampToHorizon(createdAt + between(15 * SECOND, 6 * MINUTE));
      timeline.at(at, 'payment.confirm', async () => {
        const { payment } = await travel(at, (rid) =>
          confirmPayment.execute({ storeId, paymentId, requestId: rid(), callerEnvironment: TEST }),
        );
        trackConfirmed(payment, at);
      });
    } else if (outcome === 'failed') {
      const at = clampToHorizon(createdAt + between(30 * SECOND, 4 * MINUTE));
      timeline.at(at, 'payment.fail', async () => {
        await travel(at, (rid) =>
          failPayment.execute({
            storeId,
            paymentId,
            requestId: rid(),
            reason: pick(PAYMENT_FAILURES),
            callerEnvironment: TEST,
          }),
        );
        bump('falhos');
        retry?.(at);
      });
    } else {
      const at = clampToHorizon(createdAt + PIX_TTL + int(5, 55) * SECOND);
      timeline.at(at, 'payment.expire', async () => {
        await travel(at, (rid) =>
          expirePayment.execute({
            storeId,
            paymentId,
            requestId: rid(),
            callerEnvironment: TEST,
            strictPending: true,
          }),
        );
        bump('expirados');
        retry?.(at);
      });
    }
  }

  const standardOutcome = () =>
    weighted([
      ['confirmed', 80],
      ['failed', 7],
      ['expired', 13],
    ]);
  const retryOutcome = () =>
    weighted([
      ['confirmed', 88],
      ['failed', 4],
      ['expired', 8],
    ]);

  // ── Canais ────────────────────────────────────────────────────────────────
  function planDirect(
    at,
    customer,
    { amount, description, externalId, metadata, outcome = standardOutcome(), retry } = {},
  ) {
    timeline.at(at, 'payment.direct', async () => {
      const { payment } = await travel(at, (rid) =>
        createPayment.execute({
          storeId,
          requestId: rid(),
          externalId,
          amount,
          description,
          customer: customerPayload(customer),
          environment: TEST,
          metadata,
        }),
      );
      bump('pagamentos via API');
      settle(payment.id, at, outcome, retry);
    });
  }

  function planOrder(at, customer, items, channel, attempt = 1) {
    const order = orderNumber;
    orderNumber += 1;
    const amount = itemsTotal(items);
    const retry =
      attempt < 3
        ? (failedAt) => {
            if (chance(0.45))
              planOrder(failedAt + between(2, 25) * MINUTE, customer, items, channel, attempt + 1);
          }
        : undefined;
    const outcome = attempt === 1 ? standardOutcome() : retryOutcome();

    if (channel === 'direct') {
      planDirect(at, customer, {
        amount,
        description: `Pedido FIG-${order} · ${itemsLabel(items)}`,
        externalId: `FIG-${order}`,
        metadata: {
          pedido: `FIG-${order}`,
          canal: pick(['instagram', 'whatsapp', 'balcao']),
          tentativa: attempt,
        },
        outcome,
        retry,
      });
      return;
    }

    // Loja virtual: a sessao de checkout nasce minutos antes de o cliente pagar.
    const openedAt = at - between(1, 7) * MINUTE;
    const abandoned = attempt === 1 && chance(0.12);
    const known = Boolean(customer.externalId);
    timeline.at(openedAt, 'checkout.create', async () => {
      const session = await travel(openedAt, () =>
        createSession.execute({
          storeId,
          environment: TEST,
          items: lineItems(items),
          description: `Pedido FIG-${order}`,
          customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
          prefillCustomer: known
            ? {
                externalId: customer.externalId,
                document: customer.document,
                name: customer.name,
                email: customer.email,
              }
            : undefined,
          successUrl: 'https://cafe-figo.example/checkout/sucesso',
          cancelUrl: 'https://cafe-figo.example/carrinho',
          metadata: { pedido: `FIG-${order}`, canal: 'loja-virtual', tentativa: attempt },
          expiresInSeconds: 3600,
        }),
      );
      bump('checkouts');
      if (abandoned) {
        bump('checkouts abandonados');
        return;
      }
      timeline.at(at, 'checkout.fulfill', async () => {
        const { paymentId } = await travel(at, (rid) =>
          fulfillSession.execute({
            token: session.checkoutToken,
            requestId: rid(),
            customer: customerPayload(customer),
            environment: TEST,
          }),
        );
        settle(paymentId, at, outcome, retry);
      });
    });
  }

  /** Venda pelo WhatsApp: o lojista manda um link, o cliente abre e paga (ou nao). */
  function planLink(at, customer, { items, amount, title, expiresInDays, outcome }) {
    const createdAt = Math.max(periodStart, at - between(15 * MINUTE, 30 * HOUR));
    const { month, day } = localParts(at);
    timeline.at(createdAt, 'link.create', async () => {
      const { paymentLink } = await travel(createdAt, (rid) =>
        createLink.execute({
          storeId,
          requestId: rid(),
          environment: TEST,
          ...(items ? { items: lineItems(items) } : { amount }),
          title,
          description: `Enviado por WhatsApp para ${customer.firstName}`,
          internalReference: `wpp-${slugify(customer.firstName)}-${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}`,
        }),
      );
      bump('links');
      plannedLinkExpiry.set(paymentLink.id, expiresInDays ? createdAt + expiresInDays * DAY : null);
      const token = paymentLink.publicToken;

      const cancelAt =
        outcome === 'cancelled' ? clampToHorizon(createdAt + between(0.5, 5) * DAY) : undefined;
      if (outcome !== 'cancelled' || chance(0.5)) {
        // Abre antes do desfecho: link cancelado nao abre mais.
        const until = cancelAt ?? at;
        const openAt =
          createdAt + between(2 * MINUTE, Math.max(3 * MINUTE, (until - createdAt) * 0.9));
        timeline.at(openAt, 'link.open', () =>
          travel(openAt, () => openLink.execute({ publicToken: token })),
        );
      }

      if (outcome === 'paid' || outcome === 'failed') {
        if (outcome === 'failed' || chance(0.14)) {
          const failAt = outcome === 'failed' ? at : at - between(2, 20) * MINUTE;
          timeline.at(failAt, 'link.fail', async () => {
            await travel(failAt, (rid) =>
              failLink.execute({
                publicToken: token,
                requestId: rid(),
                environment: TEST,
                reason: pick(PAYMENT_FAILURES),
              }),
            );
            bump('tentativas de link falhas');
          });
        }
        if (outcome === 'paid') {
          timeline.at(at, 'link.pay', async () => {
            const { payment } = await travel(at, (rid) =>
              payLink.execute({
                publicToken: token,
                requestId: rid(),
                environment: TEST,
                customer: customerPayload(customer),
              }),
            );
            bump('links pagos');
            trackConfirmed(payment, at);
          });
        }
      } else if (outcome === 'cancelled') {
        timeline.at(cancelAt, 'link.cancel', async () => {
          await travel(cancelAt, (rid) =>
            cancelLink.execute({
              storeId,
              paymentLinkId: paymentLink.id,
              environment: TEST,
              requestId: rid(),
            }),
          );
          bump('links cancelados');
        });
      }
    });
  }

  function planLinkSale(at, customer) {
    const custom = chance(0.35);
    const items = custom
      ? chooseItems(at)
      : chooseItems(at, { categories: ['cursos', 'presente', 'metodos', 'graos'] });
    if (items.length === 0) return;
    planLink(at, customer, {
      ...(custom ? { amount: itemsTotal(items) + int(0, 3) * 1000 } : { items }),
      title: custom ? `Pedido WhatsApp · ${customer.firstName}` : items[0].entry.name,
      expiresInDays: chance(0.6) ? 7 : undefined,
      outcome: weighted([
        ['paid', 78],
        ['failed', 7],
        ['cancelled', 8],
        ['open', 7],
      ]),
    });
  }

  // ── A demanda, dia a dia ──────────────────────────────────────────────────
  const days = Math.ceil(span / DAY);
  for (let day = 0; day < days; day += 1) {
    const start = dayAt(day);
    const progress = day / days;
    const lambda =
      (2.2 + 5.8 * progress ** 1.25) *
      WEEKDAY_FACTOR[localParts(start + 12 * HOUR).weekday] *
      spikeFactor(start + 12 * HOUR) *
      args.scale;
    const purchases = poisson(lambda);
    for (let i = 0; i < purchases; i += 1) {
      const at =
        start +
        weighted(HOUR_WEIGHTS.map((weight, hour) => [hour, weight])) * HOUR +
        int(0, 3599) * SECOND;
      if (at > horizon) continue;
      const channel = weighted([
        ['checkout', 47],
        ['direct', 35],
        ['link', 18],
      ]);
      // A escolha do cliente acontece na hora da compra, quando quem ja existe ja existe.
      timeline.at(at - SECOND, 'demand', () => {
        const customer = chooseCustomer(at);
        if (channel === 'link') {
          planLinkSale(at, customer);
          return;
        }
        const items = chooseItems(at);
        if (items.length > 0) planOrder(at, customer, items, channel);
      });
    }
  }

  // Assinantes: a cobranca mensal (ou trimestral) sai sozinha, pela API.
  const subscribers = customers
    .filter(
      (customer) =>
        customer.kind === 'pf' && customer.externalId && customer.since < periodStart + span * 0.55,
    )
    .slice(0, Math.max(3, Math.round(16 * args.scale)));
  for (const customer of subscribers) {
    const quarterly = chance(0.25);
    let at = Math.max(customer.since, periodStart) + between(1, 20) * DAY;
    let cycle = 1;
    while (at < horizon) {
      const entry = CATALOG.find(
        (candidate) =>
          candidate.key === (quarterly ? 'assinatura-trimestral' : 'assinatura-mensal'),
      );
      const chargeAt = localDayStart(at) + 8 * HOUR + int(0, 59) * MINUTE;
      const { year, month } = localParts(chargeAt);
      const period = `${String(month).padStart(2, '0')}/${year}`;
      // Pelo ciclo, nao pelo mes: mensal de 30 dias cobra duas vezes no mes de 31.
      const reference = `assin-${customer.externalId}-c${String(cycle).padStart(2, '0')}`;
      const charge = (when, attempt) =>
        timeline.at(when, 'subscription.charge', () => {
          if (!onSale(entry, when)) return;
          planDirect(when, customer, {
            amount: products.get(entry.key).price,
            description: `${entry.name} · ciclo ${period}`,
            externalId: attempt === 1 ? reference : `${reference}-r${attempt}`,
            metadata: {
              canal: 'assinatura',
              ciclo: cycle,
              plano: quarterly ? 'trimestral' : 'mensal',
              tentativa: attempt,
            },
            outcome:
              attempt === 1
                ? weighted([
                    ['confirmed', 90],
                    ['failed', 6],
                    ['expired', 4],
                  ])
                : 'confirmed',
            retry:
              attempt === 1
                ? (failedAt) => charge(localDayStart(failedAt) + DAY + 9 * HOUR, 2)
                : undefined,
          });
        });
      charge(chargeAt, 1);
      if (chance(0.06)) break;
      at += (quarterly ? 91 : 30) * DAY + between(-1, 1) * DAY;
      cycle += 1;
    }
  }

  // Atacado: blend de 1 kg em quantidade, a cada uma ou duas semanas.
  for (const company of companies) {
    let at = company.since + between(1, 6) * DAY;
    while (at < horizon) {
      const when = localDayStart(at) + int(14, 17) * HOUR + int(0, 59) * MINUTE;
      timeline.at(when, 'wholesale', () => {
        const blend = products.get('blend-1kg');
        const filters = products.get('filtros');
        if (!blend || !filters) return;
        const packs = int(4, 10);
        const boxes = int(1, 3);
        const order = orderNumber;
        orderNumber += 1;
        planDirect(when, company, {
          amount: blend.price * packs + filters.price * boxes,
          description: `Pedido atacado FIG-${order} · ${packs}× Blend da Casa 1kg, ${boxes}× Filtros V60`,
          externalId: `FIG-${order}`,
          metadata: { canal: 'atacado', pedido: `FIG-${order}`, nota: `NF-${int(10000, 99999)}` },
          outcome: weighted([
            ['confirmed', 95],
            ['expired', 5],
          ]),
        });
      });
      at += between(9, 18) * DAY;
    }
  }

  // Saques: toda semana, num dia util de manha, quando ha saldo liberado.
  let withdrawalRound = 0;
  function planWithdrawal(at, { retryOf } = {}) {
    timeline.at(at, 'withdrawal', async () => {
      const { available } = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
      if (available < 20000) {
        bump('saques adiados (pouco saldo)');
        return;
      }
      // Parte do disponivel, com um teto que muda a cada saque (o limite v1 e
      // R$ 5.000) e centavos quebrados: saque de gente, nao de planilha.
      const ceiling = int(120000, 500000);
      const amount = Math.min(ceiling, Math.floor((available * between(0.5, 0.9)) / 10) * 10);
      // O quarto sempre falha, para a tela ter um saque recusado com a nova tentativa.
      withdrawalRound += 1;
      const fails = !retryOf && (withdrawalRound === 4 || chance(0.12));
      // So a conta principal nasce verificada (chave = documento do lojista); a
      // de e-mail fica cadastrada aguardando verificacao, e a API recusaria o saque.
      const bankAccountId = mainBank.id;

      const { withdrawal } = await travel(at, (rid) =>
        createWithdrawal.execute({
          storeId,
          bankAccountId,
          amount,
          requestId: rid(),
          environment: TEST,
        }),
      );
      bump('saques');

      // Fecha na mesma volta: o worker pega saque PENDING a cada 15 s.
      const doneAt = clampToHorizon(at + between(fails ? 2 : 4, fails ? 25 : 55) * MINUTE);
      await travel(doneAt, async (rid) => {
        try {
          if (fails) {
            await failWithdrawal.execute({
              withdrawalId: withdrawal.id,
              storeId,
              requestId: rid(),
              reason: pick(WITHDRAWAL_FAILURES),
              simulation: true,
              callerEnvironment: TEST,
            });
          } else {
            await completeWithdrawal.execute({
              withdrawalId: withdrawal.id,
              storeId,
              requestId: rid(),
              simulation: true,
              callerEnvironment: TEST,
            });
          }
        } catch {
          // O worker chegou antes. Espera ele fechar: o deslocamento pega as linhas dele.
          for (let i = 0; i < 40; i += 1) {
            const { status } = await prisma.withdrawal.findUniqueOrThrow({
              where: { id: withdrawal.id },
            });
            if (status === 'COMPLETED' || status === 'FAILED') break;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      });

      if (fails) {
        bump('saques falhos');
        planWithdrawal(localDayStart(doneAt) + DAY + 10 * HOUR + int(0, 50) * MINUTE, {
          retryOf: withdrawal.id,
        });
      }
    });
  }

  for (let at = dayAt(SETTLEMENT_DAYS + int(2, 5)); at < horizon; at += between(5, 9) * DAY) {
    let when = localDayStart(at);
    while ([0, 6].includes(localParts(when + 12 * HOUR).weekday)) when += DAY;
    const morning = when + 10 * HOUR + int(0, 80) * MINUTE;
    planWithdrawal(morning);
    // As vezes um segundo no mesmo dia: a tela precisa lidar com isso tambem.
    if (chance(0.15)) planWithdrawal(morning + int(2, 4) * HOUR);
  }

  // ── Replay ────────────────────────────────────────────────────────────────
  let done = 0;
  const startedAt = Date.now();
  for (let item = timeline.next(); item; item = timeline.next()) {
    try {
      await item.run();
    } catch (error) {
      const key = item.label;
      const entry = failures.get(key) ?? { count: 0, sample: '' };
      entry.count += 1;
      entry.sample ||=
        error instanceof DomainError ? `${error.code}: ${error.message}` : error.message;
      failures.set(key, entry);
    }
    done += 1;
    if (done % 250 === 0) {
      console.log(`[seed] ${done} passos · ${formatDate(item.at)} · fila ${timeline.size}`);
    }
  }
  console.log(`[seed] replay: ${done} passos em ${Math.round((Date.now() - startedAt) / SECOND)}s`);

  // ── O agora: o que ainda esta em aberto ───────────────────────────────────
  const recentCustomers = customers.filter((customer) => customer.since < now - DAY);
  const pendingSpecs = [52, 17, 4];
  for (const minutesAgo of pendingSpecs) {
    const customer = pick(recentCustomers);
    const items = chooseItems(now);
    const at = now - minutesAgo * MINUTE;
    const order = orderNumber;
    orderNumber += 1;
    await travel(
      at,
      (rid) =>
        createPayment.execute({
          storeId,
          requestId: rid(),
          externalId: `FIG-${order}`,
          amount: itemsTotal(items),
          description: `Pedido FIG-${order} · ${itemsLabel(items)}`,
          customer: customerPayload(customer),
          environment: TEST,
          // Pix com vencimento em 24 h: fica pendente enquanto alguem valida a tela.
          expiresAt: new Date(Date.now() + DAY),
          metadata: { pedido: `FIG-${order}`, canal: 'whatsapp' },
        }),
      { keepExpiry: true },
    );
    bump('pendentes agora');
  }
  for (const minutesAgo of [35, 8]) {
    const customer = pick(recentCustomers);
    const at = now - minutesAgo * MINUTE;
    await travel(
      at,
      () =>
        createSession.execute({
          storeId,
          environment: TEST,
          items: lineItems(chooseItems(now)),
          description: `Pedido FIG-${(orderNumber += 1)}`,
          customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
          prefillCustomer: customer.externalId
            ? {
                externalId: customer.externalId,
                document: customer.document,
                name: customer.name,
                email: customer.email,
              }
            : undefined,
          successUrl: 'https://cafe-figo.example/checkout/sucesso',
          cancelUrl: 'https://cafe-figo.example/carrinho',
          metadata: { canal: 'loja-virtual' },
          expiresInSeconds: 86400,
        }),
      { keepExpiry: true },
    );
    bump('checkouts abertos agora');
  }
  const openLinks = [
    { hoursAgo: 46, failedHoursAgo: 22, entry: 'latte-art', expiresInDays: 7 },
    { hoursAgo: 20, entry: 'degustacao' },
    { hoursAgo: 3, entry: 'vale-100', expiresInDays: 7 },
  ];
  for (const spec of openLinks) {
    const customer = pick(recentCustomers);
    const at = now - spec.hoursAgo * HOUR;
    const { paymentLink } = await travel(at, (rid) =>
      createLink.execute({
        storeId,
        requestId: rid(),
        environment: TEST,
        items: [{ productId: products.get(spec.entry).id, quantity: 1 }],
        title: CATALOG.find((entry) => entry.key === spec.entry).name,
        description: `Enviado por WhatsApp para ${customer.firstName}`,
        internalReference: `wpp-${slugify(customer.firstName)}-agora`,
      }),
    );
    plannedLinkExpiry.set(
      paymentLink.id,
      spec.expiresInDays ? at + spec.expiresInDays * DAY : null,
    );
    const openedAt = at + 40 * MINUTE;
    await travel(openedAt, () => openLink.execute({ publicToken: paymentLink.publicToken }));
    if (spec.failedHoursAgo) {
      const failedAt = now - spec.failedHoursAgo * HOUR;
      await travel(failedAt, (rid) =>
        failLink.execute({
          publicToken: paymentLink.publicToken,
          requestId: rid(),
          environment: TEST,
          reason: 'insufficient_funds',
        }),
      );
    }
    bump('links abertos agora');
  }

  // ── Acabamento ────────────────────────────────────────────────────────────
  await settlePaidAt();
  // O settlement do worker (a cada 30 s em dev) libera agora o que passou de
  // D+30 sem a liberacao ter caido no replay: essa volta entra no retrato.
  await new Promise((resolve) => setTimeout(resolve, 35 * SECOND));
  await settleExpirations();
  await renumberReceipts();
  await drainOutbox();
  await prisma.$executeRaw`
    UPDATE accounts SET updated_at = COALESCE(
      (SELECT MAX(created_at) FROM transactions WHERE account_id = ${accountId}), updated_at)
    WHERE id = ${accountId}`;
  const deliveries = await seedWebhooksAndAlerts();

  await printSummary(deliveries);

  // ── Funcoes de acabamento ─────────────────────────────────────────────────

  /**
   * O `paid_at` de cada confirmado, que ficou no agora durante o replay. Daqui
   * em diante o settlement do worker volta a enxergar esses pagamentos: o que
   * passou de D+30 sem ter a liberacao caido no replay, ele libera agora.
   */
  async function settlePaidAt() {
    const entries = [...plannedPaidAt];
    // GREATEST: link pago nasce e confirma na mesma operacao, e o `created_at`
    // deslocado fica milissegundos depois do instante planejado.
    for (let i = 0; i < entries.length; i += 200) {
      await prisma.$transaction(
        entries
          .slice(i, i + 200)
          .map(
            ([id, at]) =>
              prisma.$executeRaw`UPDATE payments SET paid_at = GREATEST(${utcTimestamp(new Date(at))}, created_at) WHERE id = ${id}`,
          ),
      );
    }
  }

  /** O vencimento de cada coisa, agora que nada mais depende dele estar no futuro. */
  async function settleExpirations() {
    await prisma.$executeRaw`
      UPDATE payments SET expires_at = created_at + INTERVAL '30 minutes'
      WHERE store_id = ${storeId} AND status <> 'PENDING'`;
    await prisma.$executeRaw`
      UPDATE pix_charges SET expires_at = created_at + INTERVAL '30 minutes'
      WHERE store_id = ${storeId} AND expires_at IS NOT NULL
        AND id NOT IN (SELECT pix_charge_id FROM payment_links WHERE store_id = ${storeId})
        AND id NOT IN (SELECT pix_charge_id FROM payments WHERE store_id = ${storeId} AND status = 'PENDING' AND pix_charge_id IS NOT NULL)`;
    await prisma.$executeRaw`
      UPDATE checkout_sessions SET expires_at = created_at + INTERVAL '1 hour'
      WHERE store_id = ${storeId} AND (status <> 'OPEN' OR created_at < ${utcTimestamp(new Date(now - 3 * HOUR))})`;
    for (const [linkId, expiresAt] of plannedLinkExpiry) {
      const value = expiresAt === null ? null : new Date(expiresAt);
      const link = await prisma.paymentLink.findUnique({
        where: { id: linkId },
        select: { pixChargeId: true, updatedAt: true },
      });
      if (!link) continue;
      await prisma.$executeRaw`UPDATE payment_links SET expires_at = ${value} WHERE id = ${linkId}`;
      await prisma.$executeRaw`UPDATE pix_charges SET expires_at = ${value} WHERE id = ${link.pixChargeId}`;
    }
  }

  /**
   * O numero do recibo leva a data em que foi emitido (`buildReceiptNumber` no
   * core). Emitidos todos hoje e deslocados depois, precisam da data e da
   * sequencia do dia deslocadas tambem -- e o contador por dia, junto.
   */
  async function renumberReceipts() {
    const receipts = await prisma.$queryRaw`
      SELECT id, issued_at FROM receipts WHERE store_id = ${storeId} ORDER BY issued_at, id`;
    const segment = storeId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const perDay = new Map();
    const updates = [
      prisma.$executeRaw`UPDATE receipts SET receipt_number = 'TMP-' || id WHERE store_id = ${storeId}`,
    ];
    for (const receipt of receipts) {
      const date = receipt.issued_at.toISOString().slice(0, 10).replace(/-/g, '');
      const sequence = (perDay.get(date) ?? 0) + 1;
      perDay.set(date, sequence);
      const number = `RCP-${date}-${segment}-${String(sequence).padStart(5, '0')}`;
      updates.push(
        prisma.$executeRaw`UPDATE receipts SET receipt_number = ${number} WHERE id = ${receipt.id}`,
      );
    }
    await prisma.$transaction(updates);
    await prisma.receiptCounter.deleteMany({ where: { storeId } });
    await prisma.receiptCounter.createMany({
      data: [...perDay].map(([date, sequence]) => ({ storeId, date, sequence })),
    });
  }

  /**
   * Espera o worker processar tudo e poe o `processed_at` no tempo certo.
   * `DISPATCHED` ainda conta como em voo: o evento esta na fila do BullMQ, e o
   * processador so procura os webhooks da loja quando pega o job.
   */
  async function drainOutbox() {
    // Sem teto curto: com meses de volume o worker leva minutos, e um webhook
    // criado antes do fim receberia evento velho de verdade -- com o rate limit
    // da inbox de dev caindo no navegador de quem valida a tela.
    const deadline = Date.now() + 20 * MINUTE;
    for (let i = 0; ; i += 1) {
      const [{ pending }] = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS pending FROM outbox_events
        WHERE payload->>'storeId' = ${storeId} AND status IN ('PENDING', 'DISPATCHED')`;
      if (pending === 0) break;
      if (Date.now() > deadline) {
        throw new Error(
          `o worker nao processou o outbox em 20 min (${pending} em voo); ele esta de pe? Nenhum webhook foi criado.`,
        );
      }
      if (i % 15 === 0)
        console.log(`[seed] esperando o worker processar ${pending} eventos do outbox`);
      await new Promise((resolve) => setTimeout(resolve, 2 * SECOND));
    }
    await prisma.$executeRaw`
      UPDATE outbox_events
      SET processed_at = created_at + INTERVAL '1 millisecond' * (400 + floor(random() * 9000))
      WHERE payload->>'storeId' = ${storeId} AND processed_at IS NOT NULL`;
  }

  /**
   * Webhooks e alerta. As configuracoes nascem por HTTP (segredo cifrado pela
   * API); o historico de entregas e escrito a partir de cada evento real do
   * outbox, assinado como o worker assinaria.
   *
   * O retrato dos eventos sai antes de a inbox existir, e so com o que ja foi
   * processado: evento processado nunca e redespachado. O que nasce depois --
   * a liberacao que o settlement faz agora, por exemplo -- o worker entrega de
   * verdade, e uma entrega sintetica por cima colidiria com a real.
   */
  async function seedWebhooksAndAlerts() {
    const events = await prisma.outboxEvent.findMany({
      where: { payload: { path: ['storeId'], equals: storeId }, status: 'PROCESSED' },
      orderBy: { createdAt: 'asc' },
    });

    const inbox = await api.call('/webhooks/inbox', {
      method: 'POST',
      apiKey: shopKey.plainKey,
      body: { events: [...ALLOWED_WEBHOOK_EVENTS] },
    });
    // Desligada ja: evento que nascer enquanto o historico e escrito nao sai de verdade.
    await api.call(`/webhooks/${inbox.id}`, {
      method: 'PATCH',
      apiKey: shopKey.plainKey,
      body: { isActive: false },
    });
    const erpEvents = ['payment.confirmed', 'payment.refunded', 'payment.released'];
    const erp = await api.call('/webhooks', {
      method: 'POST',
      apiKey: erpKey.plainKey,
      body: { url: 'https://erp.cafe-figo.example/webhooks/hockpay', events: erpEvents },
    });
    await api.call(`/webhooks/${erp.id}`, {
      method: 'PATCH',
      apiKey: erpKey.plainKey,
      body: { isActive: false },
    });

    const inboxCreatedAt = setupAt + 5 * HOUR;
    const erpCreatedAt = dayAt(41) + 10 * HOUR;
    const incidentStart = periodStart + span * 0.62;
    const incidentEnd = incidentStart + 3 * DAY;
    const erpDisabledAt = periodStart + span * 0.8;
    await prisma.webhookConfig.update({
      where: { id: inbox.id },
      data: { createdAt: new Date(inboxCreatedAt), updatedAt: new Date(inboxCreatedAt) },
    });
    await prisma.webhookConfig.update({
      where: { id: erp.id },
      data: { createdAt: new Date(erpCreatedAt), updatedAt: new Date(erpDisabledAt) },
    });

    const alertResponse = await api.call('/alerts', {
      method: 'POST',
      body: {
        name: 'Discord · #financeiro',
        channel: 'discord',
        discord: { webhookUrl: 'https://discord.com/api/webhooks/seed-demo/hockpay-figo' },
        events: ['payment.failed', 'payment.refunded', 'withdrawal.failed'],
        isActive: false,
      },
    });
    const alert = alertResponse?.alert ?? alertResponse;
    const alertActiveFrom = periodStart + span * 0.3;
    const alertActiveTo = periodStart + span * 0.9;
    await prisma.alertConfig.update({
      where: { id: alert.id },
      data: { createdAt: new Date(alertActiveFrom), updatedAt: new Date(alertActiveTo) },
    });

    const paymentIds = new Set(
      (await prisma.payment.findMany({ where: { storeId }, select: { id: true } })).map(
        (payment) => payment.id,
      ),
    );
    const signer = new HmacSignerService();
    const logs = [];
    const inboxEvents = [];
    const alertLogs = [];

    const delivery = (
      config,
      secret,
      event,
      envelope,
      paymentId,
      {
        createdAt,
        deliveredAt,
        attempt = 1,
        status = 'DELIVERED',
        responseStatus = 200,
        responseBody,
        lastError,
        failedAt,
      },
    ) => {
      const id = randomUUID();
      const timestamp = (deliveredAt ?? failedAt ?? createdAt).getTime();
      const headers = {
        'Content-Type': 'application/json',
        'X-Hockpay-Signature': signer.sign(secret, envelope, timestamp),
        'X-Hockpay-Timestamp': String(timestamp),
        'X-Hockpay-Webhook-Id': id,
        ...(event.requestId ? { 'X-Request-ID': event.requestId } : {}),
        'User-Agent': 'Hockpay-Webhook/1.0',
      };
      logs.push({
        id,
        configId: config.id,
        paymentId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        outboxEventId: event.id,
        requestId: event.requestId,
        eventType: event.eventType,
        payload: envelope,
        requestHeaders: headers,
        responseStatus,
        responseBody,
        status,
        attempt,
        maxAttempts: 5,
        deliveredAt: deliveredAt ?? null,
        failedAt: failedAt ?? null,
        lastError: lastError ?? null,
        createdAt,
      });
      return { id, headers };
    };

    for (const event of events) {
      const at = event.createdAt.getTime();
      const envelope = {
        id: event.id,
        type: event.eventType,
        version: event.version,
        created_at: event.createdAt.toISOString(),
        data: event.payload,
      };
      const candidate =
        event.aggregateType === 'Payment' ? event.aggregateId : event.payload?.paymentId;
      const paymentId = paymentIds.has(candidate) ? candidate : null;

      if (at >= inboxCreatedAt) {
        const createdAt = new Date(at + int(400, 9500));
        const deliveredAt = new Date(createdAt.getTime() + int(12, 90));
        const inboxEventId = randomUUID();
        const { id, headers } = delivery(inbox, inbox.secret, event, envelope, paymentId, {
          createdAt,
          deliveredAt,
          responseBody: JSON.stringify({ received: true, eventId: inboxEventId }),
        });
        inboxEvents.push({
          id: inboxEventId,
          storeId,
          configId: inbox.id,
          eventType: event.eventType,
          payload: envelope,
          requestHeaders: Object.fromEntries(
            Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
          ),
          requestId: event.requestId,
          deliveryId: id,
          outboxEventId: event.id,
          paymentId,
          signatureValid: true,
          receivedAt: new Date(deliveredAt.getTime() - int(2, 8)),
        });
      }

      if (erpEvents.includes(event.eventType) && at >= erpCreatedAt && at < erpDisabledAt) {
        const createdAt = new Date(at + int(400, 9500));
        if (at >= incidentStart && at < incidentEnd) {
          // O ERP caiu por tres dias: 503 e timeout, cinco tentativas, e desiste.
          const timeout = chance(0.35);
          const recovered = chance(0.3);
          const lastError = timeout
            ? 'timeout of 10000ms exceeded'
            : 'Request failed with status code 503';
          if (recovered) {
            delivery(erp, erp.secret, event, envelope, paymentId, {
              createdAt,
              deliveredAt: new Date(
                createdAt.getTime() + (30 + 120 + 600) * SECOND + int(300, 2500),
              ),
              attempt: 4,
              responseBody: '{"ok":true}',
              lastError,
            });
          } else {
            delivery(erp, erp.secret, event, envelope, paymentId, {
              createdAt,
              failedAt: new Date(
                createdAt.getTime() + (30 + 120 + 600 + 3600) * SECOND + int(300, 2500),
              ),
              attempt: 5,
              status: 'FAILED_FINAL',
              responseStatus: timeout ? null : 503,
              responseBody: timeout
                ? null
                : '<html><body><h1>503 Service Temporarily Unavailable</h1></body></html>',
              lastError,
            });
          }
        } else if (chance(0.02)) {
          delivery(erp, erp.secret, event, envelope, paymentId, {
            createdAt,
            deliveredAt: new Date(createdAt.getTime() + 30 * SECOND + int(300, 2500)),
            attempt: 2,
            responseBody: '{"ok":true}',
            lastError: 'Request failed with status code 502',
          });
        } else {
          delivery(erp, erp.secret, event, envelope, paymentId, {
            createdAt,
            deliveredAt: new Date(createdAt.getTime() + int(350, 2400)),
            responseBody: '{"ok":true}',
          });
        }
      }

      if (
        ['payment.failed', 'payment.refunded', 'withdrawal.failed'].includes(event.eventType) &&
        at >= alertActiveFrom &&
        at < alertActiveTo
      ) {
        const amount =
          typeof event.payload?.amount === 'number' ? formatMoney(event.payload.amount) : '';
        alertLogs.push({
          alertConfigId: alert.id,
          outboxEventId: event.id,
          paymentId,
          eventType: event.eventType,
          channel: 'DISCORD',
          status: 'DELIVERED',
          payload: {
            username: 'Hockpay',
            content: `**${event.eventType}** · ${args.store} · ${amount} · \`${event.aggregateId}\``,
          },
          responseStatus: 204,
          responseBody: '',
          attempt: 1,
          maxAttempts: 5,
          deliveredAt: new Date(at + int(900, 4000)),
          createdAt: new Date(at + int(400, 800)),
        });
      }
    }

    // `skipDuplicates` e cinto de seguranca: se uma entrega real escapar do
    // retrato, ela vence e a sintetica cai fora.
    for (let i = 0; i < logs.length; i += 500) {
      await prisma.webhookLog.createMany({ data: logs.slice(i, i + 500), skipDuplicates: true });
    }
    for (let i = 0; i < inboxEvents.length; i += 500) {
      await prisma.webhookInboxEvent.createMany({ data: inboxEvents.slice(i, i + 500) });
    }
    if (alertLogs.length > 0) {
      await prisma.alertDeliveryLog.createMany({ data: alertLogs, skipDuplicates: true });
    }

    // So agora a inbox recebe de verdade: o que ja existia tem a sua entrega
    // sintetica, e o que nascer daqui para frente o worker entrega.
    await api.call(`/webhooks/${inbox.id}`, {
      method: 'PATCH',
      apiKey: shopKey.plainKey,
      body: { isActive: true },
    });

    return { webhooks: logs.length, inbox: inboxEvents.length, alerts: alertLogs.length };
  }

  async function printSummary(deliveries) {
    const byStatus = await prisma.payment.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true,
    });
    const finalAccount = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const [first] =
      await prisma.$queryRaw`SELECT MIN(created_at) AS first FROM payments WHERE store_id = ${storeId}`;
    const counts = {
      clientes: await prisma.customer.count({ where: { storeId } }),
      links: await prisma.paymentLink.count({ where: { storeId } }),
      checkouts: await prisma.checkoutSession.count({ where: { storeId } }),
      recibos: await prisma.receipt.count({ where: { storeId } }),
      saques: await prisma.withdrawal.count({ where: { accountId } }),
      lancamentos: await prisma.transaction.count({ where: { accountId } }),
    };

    console.log('');
    console.log(`[seed] ${args.store} (${storeId}) · desde ${formatDate(first.first.getTime())}`);
    console.log(
      `  pagamentos: ${byStatus.map((row) => `${row.status} ${row._count}`).join(' · ')}`,
    );
    console.log(
      `  ${Object.entries(counts)
        .map(([key, value]) => `${key} ${value}`)
        .join(' · ')}`,
    );
    console.log(
      `  saldo TEST: disponível ${formatMoney(finalAccount.available)} · a liberar ${formatMoney(finalAccount.pending)} · bloqueado ${formatMoney(finalAccount.blocked)}`,
    );
    console.log(
      `  webhooks: ${deliveries.webhooks} entregas (${deliveries.inbox} na inbox) · alertas: ${deliveries.alerts}`,
    );
    console.log(`  ${[...stats].map(([key, value]) => `${key} ${value}`).join(' · ')}`);
    if (failures.size > 0) {
      console.log('  passos que falharam (o resto seguiu):');
      for (const [label, { count, sample }] of failures) {
        console.log(`    ${label}: ${count}× — ${sample}`);
      }
    }
    console.log(`  repita a mesma historia com --seed ${args.seed}`);
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Desloca toda data ISO que ainda esta "agora" dentro de um payload. */
function shiftDates(value, sinceMs, deltaMs, keepExpiry, key) {
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    if (keepExpiry && key === 'expiresAt') return value;
    const time = Date.parse(value);
    return time >= sinceMs ? new Date(time - deltaMs).toISOString() : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => shiftDates(item, sinceMs, deltaMs, keepExpiry, key));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [
        entryKey,
        shiftDates(entry, sinceMs, deltaMs, keepExpiry, entryKey),
      ]),
    );
  }
  return value;
}

main().catch((error) => {
  const message = error instanceof DomainError ? `${error.code}: ${error.message}` : error.message;
  console.error(`falhou: ${message}`);
  process.exitCode = 1;
});
