import { Component, input } from '@angular/core';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

/**
 * AppDialog — Reusable dialog wrapper built on top of Spartan UI (BrnDialog).
 *
 * Usage:
 * ```html
 * <app-dialog>
 *   <button brnDialogTrigger>Open</button>
 *
 *   <ng-template brnDialogContent>
 *     <app-dialog-header title="My Title" description="Some subtitle" />
 *     <div appDialogBody>
 *       <!-- Your content here -->
 *     </div>
 *     <app-dialog-footer>
 *       <button brnDialogClose>Cancel</button>
 *       <button (click)="doSomething()">Confirm</button>
 *     </app-dialog-footer>
 *   </ng-template>
 * </app-dialog>
 * ```
 */
@Component({
    selector: 'app-dialog',
    standalone: true,
    imports: [BrnDialogImports],
    template: `
        <brn-dialog [closeDelay]="150">
            <ng-content select="[brnDialogTrigger]" />
            <ng-content />
        </brn-dialog>
    `,
})
export class DialogComponent { }

/**
 * Dialog Overlay — Styled backdrop for the dialog.
 */
@Component({
    selector: 'app-dialog-overlay',
    standalone: true,
    imports: [BrnDialogImports],
    template: `<brn-dialog-overlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0" />`,
})
export class DialogOverlayComponent { }

/**
 * Dialog Header — Contains title and optional description.
 */
@Component({
    selector: 'app-dialog-header',
    standalone: true,
    imports: [],
    template: `
        <div class="flex flex-col space-y-1.5 pb-4">
            @if (title()) {
                <h3 class="text-lg font-semibold tracking-tight text-zinc-900">{{ title() }}</h3>
            }
            @if (description()) {
                <p class="text-sm text-zinc-500">{{ description() }}</p>
            }
        </div>
    `,
})
export class DialogHeaderComponent {
    readonly title = input<string>('');
    readonly description = input<string>('');
}

/**
 * Dialog Footer — Container for action buttons.
 */
@Component({
    selector: 'app-dialog-footer',
    standalone: true,
    template: `
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
            <ng-content />
        </div>
    `,
})
export class DialogFooterComponent { }

/**
 * Dialog Close Button — Styled X button for closing.
 */
@Component({
    selector: 'app-dialog-close',
    standalone: true,
    imports: [BrnDialogImports, HlmIconImports],
    providers: [provideIcons({ lucideX })],
    template: `
        <button brnDialogClose class="absolute right-4 top-4 rounded-md p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
            <ng-icon hlm name="lucideX" size="sm"></ng-icon>
        </button>
    `,
})
export class DialogCloseButtonComponent { }

/**
 * Barrel export array for easy imports in consumer components.
 *
 * Usage in your component:
 * ```ts
 * import { DialogImports } from '../../shared/components/dialog/dialog.component';
 *
 * @Component({
 *   imports: [...DialogImports],
 * })
 * ```
 */
export const DialogImports = [
    DialogComponent,
    DialogOverlayComponent,
    DialogHeaderComponent,
    DialogFooterComponent,
    DialogCloseButtonComponent,
    BrnDialogImports,
] as const;
