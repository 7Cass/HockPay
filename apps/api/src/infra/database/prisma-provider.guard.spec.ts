import { readdirSync, readFileSync, statSync } from 'fs';
import { relative, resolve } from 'path';
import ts from 'typescript';

describe('Prisma provider ownership', () => {
  it('does not redeclare PrismaService in API business modules', () => {
    const modulesDir = resolve(__dirname, '../../modules');
    const offenders = findModuleFiles(modulesDir).flatMap((filePath) =>
      findDirectPrismaProviders(filePath).map((providerName) => ({
        file: relative(modulesDir, filePath),
        providerName,
      })),
    );

    expect(offenders).toEqual([]);
  });
});

function findModuleFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = resolve(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return findModuleFiles(entryPath);
    }

    return entry.endsWith('.module.ts') ? [entryPath] : [];
  });
}

function findDirectPrismaProviders(filePath: string): string[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const offenders: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      isProvidersProperty(node.name) &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const element of node.initializer.elements) {
        if (ts.isIdentifier(element) && element.text === 'PrismaService') {
          offenders.push(element.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return offenders;
}

function isProvidersProperty(name: ts.PropertyName): boolean {
  return (
    (ts.isIdentifier(name) && name.text === 'providers') ||
    (ts.isStringLiteral(name) && name.text === 'providers')
  );
}
