/**
 * As peças de tela do admin — o design system da mesa.
 *
 * Espelha `shared/ui` em intenção e não em código: mesma ideia de cabeçalho,
 * estado e painel, desenhados para uma superfície densa em vez de uma superfície
 * de marca. Nada aqui importa de `shared/`, e nada aqui importa de biblioteca de
 * UI de terceiro — é o que permite mover a pasta inteira quando o admin virar
 * app próprio.
 *
 * A regra de divisão entre este barril e `admin.css`:
 *
 * - **componente** é tudo que tem comportamento (painel modal, menu, paleta,
 *   toast) ou marcação repetida (botão, chip, campo, tabela). O estilo mora com
 *   ele, encapsulado.
 * - **`admin.css`** é só o que precisa existir antes de qualquer componente: os
 *   tokens, o anel de foco, a barra de rolagem e as utilidades que a página
 *   aplica em elementos que ela mesma escreve (`.adm-mono`, `.adm-col-num`).
 *
 * Quem escreve uma tela nova aqui não deveria precisar de uma classe solta.
 * Se precisar, a peça que falta é um componente — não uma classe a mais.
 */

export { AdmAvatar } from './avatar/avatar';
export { AdmBrandMark } from './brand/brand-mark';
export { AdmButton, type AdmButtonSize, type AdmButtonVariant } from './button/button';
export { AdmChip } from './chip/chip';
export { AdmCommandPalette, type AdmCommand } from './command/command';
export { AdmCopy } from './copy/copy';
export { AdmFact, AdmFacts } from './facts/facts';
export { AdmField } from './field/field';
export { AdmKbd } from './kbd/kbd';
export { AdmMenu } from './menu/menu';
export { AdmNotice } from './notice/notice';
export { AdmPageHeader } from './page-header/page-header';
export { AdmPageState, type AdmPageStateVariant } from './page-state/page-state';
export { AdmPagination } from './pagination/pagination';
export { AdmPanel } from './panel/panel';
export { AdmSegmented, type AdmSegmentedOption } from './segmented/segmented';
export { AdmSheet } from './sheet/sheet';
export { AdmSkeleton, AdmSkeletonRows } from './skeleton/skeleton';
export { AdmStatusChip } from './status-chip/status-chip';
export { AdmTable } from './table/table';
export { AdmTimeline, type AdmTimelineEvent } from './timeline/timeline';
export { AdmToaster } from './toast/toaster';
export { AdmToastService, type AdmToast } from './toast/toast.service';
export { AdmThemeService, type AdmDensity, type AdmTheme } from './theme/theme.service';
export { statusLabel, statusTone, type Tone } from './tone';
