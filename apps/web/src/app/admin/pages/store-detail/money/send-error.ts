import type { HttpErrorResponse } from '@angular/common/http';

/**
 * A frase que a tela mostra quando mover dinheiro falha.
 *
 * Sem resposta nenhuma (`status 0`) é o caso que a chave de idempotência
 * existe para cobrir: o pedido pode ter chegado e a resposta, não. A frase diz
 * que reenviar é seguro, porque é — a mesma tentativa leva a mesma chave. Com
 * resposta, a mensagem é a da API, que é quem sabe por que recusou.
 */
export function sendErrorMessage(err: HttpErrorResponse, fallback: string): string {
  if (err.status === 0) {
    return (
      'Sem resposta da API — o pedido pode ou não ter chegado. Reenviar é seguro: a mesma ' +
      'tentativa leva a mesma chave, e a API não move o dinheiro duas vezes.'
    );
  }

  return err.error?.error?.message || fallback;
}
