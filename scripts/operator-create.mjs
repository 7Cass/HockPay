/**
 * Provisiona um operador.
 *
 * A superficie de operador nao tem cadastro publico: num simulador nao existe
 * fluxo de "contratar funcionario", existe este script. A senha e lida por
 * prompt ou stdin, nunca por argumento — argumento vaza em historico de shell
 * e em lista de processos.
 *
 *   pnpm operator:create --email desk@hockpay.local --name "Mesa"
 *   printf 'senha\n' | pnpm operator:create --email desk@hockpay.local --name "Mesa"
 */
import { createInterface } from 'node:readline';
import { hash, verify } from 'argon2';
import { CreateOperatorUseCase, DomainError } from '@hockpay/core';
import { PrismaClient } from '@hockpay/database';
import { UnitOfWork } from '@hockpay/infrastructure';

const MIN_PASSWORD_LENGTH = 12;

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === '--email' || current === '--name') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${current} precisa de um valor`);
      }
      args[current.slice(2)] = value;
      i += 1;
      continue;
    }

    if (current === '--password' || current.startsWith('--password=')) {
      throw new Error(
        'senha por argumento nao e aceita: ela vaza em historico de shell e em lista de processos. Use o prompt ou stdin.',
      );
    }
  }

  if (!args.email || !args.name) {
    throw new Error('uso: pnpm operator:create --email <email> --name <nome>');
  }

  return args;
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

  process.stdout.write('Senha: ');
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = (await readPassword()).trim();

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  const prisma = new PrismaClient();

  try {
    const useCase = new CreateOperatorUseCase(new UnitOfWork(prisma), {
      hash: (plain) => hash(plain),
      verify: (plain, hashed) => verify(hashed, plain).catch(() => false),
    });

    const operator = await useCase.execute({
      email: args.email,
      name: args.name,
      password,
    });

    console.log(`operador criado: ${operator.id} <${operator.email}>`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof DomainError ? `${error.code}: ${error.message}` : error.message;
  console.error(`falhou: ${message}`);
  process.exitCode = 1;
});
