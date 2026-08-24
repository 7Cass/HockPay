import { Provider } from '@nestjs/common';

/**
 * Tokens aceitos pelo `inject` do Nest: string para as portas do core
 * (`'IPaymentRepository'`) ou a propria classe para adapters.
 */
type InjectionToken =
  | string
  | symbol
  | (abstract new (...args: never[]) => unknown);

type UseCaseClass<T> = new (...args: never[]) => T;

/**
 * Registra um use case do core como provider.
 *
 * Use cases do core recebem portas por interface, entao o Nest nao consegue
 * resolve-los por metadata de tipo — cada um precisa de um `useFactory` que
 * repassa as dependencias na ordem do construtor. Escrito a mao isso custava
 * de 5 a 15 linhas por use case; aqui vira uma linha.
 *
 * ```ts
 * provideUseCase(ListPaymentsUseCase, ['IPaymentRepository'])
 * ```
 *
 * `extraArgs` cobre os construtores que recebem configuracao alem das portas,
 * sempre depois das dependencias injetadas:
 *
 * ```ts
 * provideUseCase(CreatePaymentUseCase, ['IUnitOfWork', FeePolicy], () => [
 *   process.env.PIX_KEY ?? 'test@hockpay.com',
 * ])
 * ```
 */
export function provideUseCase<T>(
  useCase: UseCaseClass<T>,
  inject: InjectionToken[] = [],
  extraArgs?: () => unknown[],
): Provider {
  return {
    provide: useCase,
    useFactory: (...deps: unknown[]) =>
      new (useCase as new (...args: unknown[]) => T)(
        ...deps,
        ...(extraArgs?.() ?? []),
      ),
    inject: inject as never[],
  };
}
