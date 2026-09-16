/**
 * As peças de tela do console — o design system do lojista.
 *
 * Espelha `admin/ui` em intenção e não em código: mesma ideia de painel, estado
 * e cabeçalho, desenhados para quem lê dinheiro em vez de para quem julga loja.
 * Nada aqui importa de `shared/`, de `admin/` ou de biblioteca de UI de
 * terceiro — é o que permite mover a pasta inteira quando o console virar app
 * próprio, e é o que o teste de fronteira garante.
 *
 * A regra de divisão entre este barril e `merchant.css`:
 *
 * - **componente** é tudo que tem comportamento (folha modal, menu, copiar) ou
 *   marcação repetida (botão, chip, campo, tabela). O estilo mora com ele.
 * - **`merchant.css`** é só o que precisa existir antes de qualquer componente:
 *   os tokens, o anel de foco, a barra de rolagem e as utilidades que a página
 *   aplica em elemento que ela mesma escreve (`.mer-mono`, `.mer-col-num`).
 *
 * Quem escreve uma tela nova aqui não deveria precisar de uma classe solta. Se
 * precisar, a peça que falta é um componente — não uma classe a mais.
 */

export { MerButton, type MerButtonSize, type MerButtonVariant } from './button/button';
export { MerChip } from './chip/chip';
export { MerCopy } from './copy/copy';
export { MerEventPicker } from './event-picker/event-picker';
export { MerField } from './field/field';
export { MerNotice } from './notice/notice';
export { MerPageHeader } from './page-header/page-header';
export { MerPageState, type MerPageStateVariant } from './page-state/page-state';
export { MerPagination } from './pagination/pagination';
export { MerPanel } from './panel/panel';
export { MerSheet } from './sheet/sheet';
export { MerStat } from './stat/stat';
export { MerTable } from './table/table';
export { MerThemeService, type MerSkin, type MerTheme } from './theme/theme.service';
export { MerToastService, type MerToast } from './toast/toast.service';
export { MerToaster } from './toast/toaster';
