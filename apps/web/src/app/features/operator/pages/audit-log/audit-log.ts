import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRefreshCcw, lucideScrollText } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';

import {
  OperatorAuditLog,
  OperatorAuditService,
} from '../../../../core/services/operator-audit.service';
import { OperatorAuthService } from '../../../../core/services/operator-auth.service';
import { PageHeader, PageState } from '../../../../shared/ui';
import { actionLabel, actionTone, readableChanges } from '../../audit-vocabulary';

const LIMIT = 50;

/**
 * A trilha da mesa, legível.
 *
 * O PRD pai é explícito: uma trilha que só existe no banco é um log. Esta tela
 * é o que a torna trilha — e por isso ela mostra o antes e o depois em
 * português, não o JSON que o banco guarda.
 *
 * Ela não filtra por loja porque a API não oferece esse filtro; o que ela
 * oferece é "só as minhas", que é a pergunta que um operador faz sobre o
 * próprio trabalho.
 */
@Component({
  selector: 'app-operator-audit-log',
  standalone: true,
  imports: [DatePipe, NgIcon, RouterLink, PageHeader, PageState],
  providers: [provideIcons({ lucideRefreshCcw, lucideScrollText })],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.css',
})
export class OperatorAuditLogPage implements OnInit, OnDestroy {
  protected readonly trail = inject(OperatorAuditService);
  protected readonly operatorAuth = inject(OperatorAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeSub?: Subscription;

  protected readonly actionLabel = actionLabel;
  protected readonly actionTone = actionTone;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  protected readonly mineOnly = signal(false);
  protected readonly offset = signal(0);
  protected readonly page = computed(() => Math.floor(this.offset() / LIMIT) + 1);

  ngOnInit(): void {
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      this.mineOnly.set(params.get('mine') === '1');
      this.offset.set(Math.max(Number(params.get('offset') ?? 0) || 0, 0));
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  protected reload(): void {
    this.load();
  }

  protected toggleMine(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mine: this.mineOnly() ? null : '1', offset: null },
      queryParamsHandling: 'merge',
    });
  }

  protected goToOffset(offset: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { offset: offset > 0 ? offset : null },
      queryParamsHandling: 'merge',
    });
  }

  protected changesOf(log: OperatorAuditLog) {
    return readableChanges(log.before, log.after);
  }

  /** Só loja tem tela para onde ir; outro alvo fica como texto. */
  protected storeLink(log: OperatorAuditLog): string[] | null {
    return log.targetType === 'store' && log.targetId ? ['/operator/stores', log.targetId] : null;
  }

  private load(): void {
    const operatorId = this.mineOnly() ? this.operatorAuth.currentOperator()?.id : undefined;

    this.trail.loadLogs({ limit: LIMIT, offset: this.offset(), operatorId });
  }
}
