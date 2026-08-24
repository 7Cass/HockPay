import { readdirSync, readFileSync, statSync } from 'fs';
import { relative, resolve } from 'path';
import ts from 'typescript';

/**
 * Irmao de `prisma-provider.guard.spec.ts`: aquele impede que um feature
 * module redeclare `PrismaService`, este impede que redeclare a camada que o
 * `InfrastructureModule` ja possui.
 *
 * Sem isso a duplicacao volta em silencio — era assim que
 * `ITransactionRepository` e `IAccountRepository` acabaram com tres instancias
 * cada e `IUnitOfWork` com nove.
 */
describe('Infrastructure provider ownership', () => {
  it('does not redeclare repository tokens in API business modules', () => {
    expect(
      findOffenders(/^I[A-Z][A-Za-z]*(Repository)$|^IUnitOfWork$/),
    ).toEqual([]);
  });

  it('does not redeclare repository classes in API business modules', () => {
    expect(findOffenders(/^[A-Z][A-Za-z]*Repository$/)).toEqual([]);
  });
});

function findOffenders(
  tokenPattern: RegExp,
): { file: string; token: string }[] {
  const modulesDir = resolve(__dirname, '../modules');
  return findModuleFiles(modulesDir).flatMap((filePath) =>
    findProvidedTokens(filePath)
      .filter((token) => tokenPattern.test(token))
      .map((token) => ({ file: relative(modulesDir, filePath), token })),
  );
}

function findModuleFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = resolve(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      return findModuleFiles(entryPath);
    }
    return entry.endsWith('.module.ts') ? [entryPath] : [];
  });
}

/**
 * Coleta o valor de cada `provide:` dentro do array `providers` do @Module.
 * Um `provide` e uma string literal (token de porta) ou um identificador
 * (a propria classe).
 */
function findProvidedTokens(filePath: string): string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const tokens: string[] = [];

  const collectFromProviders = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'provide'
    ) {
      if (ts.isStringLiteral(node.initializer)) {
        tokens.push(node.initializer.text);
      } else if (ts.isIdentifier(node.initializer)) {
        tokens.push(node.initializer.text);
      }
    }
    ts.forEachChild(node, collectFromProviders);
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'providers' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      node.initializer.elements.forEach(collectFromProviders);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return tokens;
}
