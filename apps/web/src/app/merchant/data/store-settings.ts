import { inject } from '@angular/core';

import { StoreService, type Store } from '../domain/api-contracts';
import { MerchantApi, type Result } from './api';

/**
 * As escritas da tela de Configurações.
 *
 * Diferente do resto de `data/`, estas não montam a requisição: elas passam
 * pela costura, porque `StoreService` é quem guarda a loja corrente e quem
 * troca os tokens quando ela muda. Chamar a API por fora daqui deixaria o
 * `StoreService` com uma cópia velha do nome da loja logo depois de salvá-lo.
 *
 * O que estas funções acrescentam é o `Result`: a tela precisa do código do
 * erro para decidir, e `subscribe` com dois callbacks espalha essa decisão.
 */
export class StoreSettingsCommands {
  constructor(
    private readonly api: MerchantApi,
    private readonly stores: StoreService,
  ) {}

  updateProfile(storeId: string, input: { name: string; city?: string }): Promise<Result<Store>> {
    return this.api.run(this.stores.updateProfile(storeId, input));
  }

  /**
   * Pede à mesa para habilitar LIVE.
   *
   * Não leva `Idempotency-Key`: o backend guarda o estado do pedido, então
   * pedir duas vezes não cria dois — o segundo encontra a loja já em análise.
   */
  requestLive(storeId: string): Promise<Result<Store>> {
    return this.api.run(this.stores.requestLiveEnablement(storeId));
  }

  reload(): Promise<Result<unknown>> {
    return this.api.run(this.stores.loadStores());
  }
}

export function storeSettingsCommands(): StoreSettingsCommands {
  return new StoreSettingsCommands(inject(MerchantApi), inject(StoreService));
}
