/**
 * As peças de tela do admin.
 *
 * Espelha `shared/ui` em intenção e não em código: mesma ideia de cabeçalho,
 * estado e painel, desenhados para uma superfície densa em vez de uma superfície
 * de marca. Nada aqui importa de `shared/` — é o que permite mover a pasta
 * inteira quando o admin virar app próprio.
 */
export { AdmPageHeader } from './page-header/page-header';
export { AdmPageState, type AdmPageStateVariant } from './page-state/page-state';
export { AdmSheet } from './sheet/sheet';
export { AdmStatusChip } from './status-chip/status-chip';
export { statusLabel, statusTone, type Tone } from './tone';
