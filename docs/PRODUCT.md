# Hockpay - Produto

Hockpay e uma plataforma dev-first de pagamentos simulados para desenvolvedores independentes, estudantes e pequenas startups que precisam demonstrar, testar ou treinar integracoes de pagamento sem processar dinheiro real.

## Proposta de Valor

- Criar um ambiente local reproduzivel para pagamentos Pix simulados.
- Reduzir o tempo ate o primeiro pagamento, primeiro webhook e primeiro checkout demonstravel.
- Oferecer dashboard operacional para investigar payments, receipts, webhooks, saldos e saques simulados, em TEST ou em LIVE.
- Mostrar o **lado de dentro** de um gateway: a mesa que habilita loja, define condicao comercial e investiga chamado, com trilha de auditoria de tudo que decidiu.
- Dar um caminho simples para study-cases e demos integradas, como `apps/demo-mediakit`.

## Personas

| Persona | Necessidade |
| --- | --- |
| Desenvolvedor indie | Testar checkout, webhooks, idempotencia e estados de pagamento sem conta em adquirente. |
| Pequena startup | Demonstrar fluxo de pagamento e pos-venda antes de contratar infraestrutura real. |
| Estudante/mentor | Ensinar integracao de API, webhook assinado, fila e dashboard operacional. |
| Builder de demo | Montar study-case com checkout hospedado, simulacao TEST e recebimento de webhook. |
| Quem estuda o lado de dentro | Ver como um gateway decide quem opera em producao, sob que taxa e com que rastro -- o formato de decisao que nenhuma documentacao publica de adquirente mostra. |

## Jornadas Atuais

### Primeiro pagamento por API

1. Merchant cria conta, store e API key TEST.
2. Integrador chama `POST /api/v1/payments` com `Idempotency-Key`.
3. Em TEST, confirma ou falha o pagamento por endpoint de simulacao.
4. Dashboard mostra payment, timeline, receipt quando aplicavel, saldo e transaction.
5. Worker entrega webhook assinado ao integrador.

### Checkout hospedado

1. Integrador cria uma checkout session.
2. Comprador acessa `apps/checkout`, informa dados minimos e finaliza.
3. O checkout acompanha o status e permite simulacao em ambiente TEST.
4. A demo recebe webhook e libera a experiencia final.

### Payment Link

1. Merchant cria um link de cobranca com valor direto ou escolhendo produtos do catalogo.
2. Comprador acessa `/pay/:token` e ve o resumo dos itens quando o link foi montado a partir do catalogo.
3. Cada falha/pagamento vira uma tentativa `Payment` ligada a uma `PixCharge`.
4. Dashboard permite acompanhar o link, tentativas e conversao.

### Habilitacao para LIVE

1. Toda loja nasce operando em TEST, sem passar por aprovacao nenhuma. Essa e a
   promessa: cobrar no minuto zero.
2. Para operar em LIVE, o lojista pede habilitacao em Settings
   (`NOT_REQUESTED -> PENDING`) e ve o estado ali mesmo.
3. A mesa de operador aprova, rejeita ou suspende, sempre com motivo. Cada
   decisao deixa uma linha na trilha de auditoria.
4. Loja aprovada passa a cobrar com a key `hk_live_`, e o saldo entra no ledger
   LIVE, separado do TEST.
5. O lojista troca de ambiente pelo seletor da topbar, e o dashboard inteiro
   recarrega no ledger escolhido: saldo, extrato, pagamento, produto e chave.
   Saque e estorno tambem passam a sair do ledger LIVE.

Loja **suspensa** para de movimentar dinheiro por conta propria: nao cobra, e a
intencao e que tambem nao saque nem estorne. O saldo continua sendo dela -- o
que muda e quem executa. Retirada de loja suspensa passa a ser trabalho da mesa,
por chamado, como num gateway de verdade. Decidido em `2026-09-08`; o gate do
saque e a via do operador ainda nao existem, e o `CURRENT_STATE` registra a
lacuna.

Loja sem habilitacao ve a opcao LIVE **desabilitada, e nao escondida**, com o
estado atual e o caminho para pedir. Ver a porta fechada e como o lojista
descobre que ela existe -- esconde-la ensinaria que producao e um lugar para
onde nunca se vai.

**LIVE aqui tambem e simulado.** O que a habilitacao ensina e o que separa
producao de teste num gateway de verdade -- **quem pode operar, e sob que
cerimonia** -- e nao "de onde vem o dinheiro". Nenhum centavo e real em nenhum
dos dois ambientes, e o rotulo "simulado" acompanha LIVE em todo lugar onde ele
aparece na tela: no seletor, na opcao e no saldo. Um selo LIVE identico ao de um
gateway de verdade seria a mentira mais cara que um simulador consegue contar.

### Mesa de operacao

1. O operador entra por `/operator/login`, com sessao, cookie e segredo
   proprios. Nao existe elevacao de lojista para operador, nem o contrario: sao
   dois principais, e as duas sessoes convivem no mesmo browser sem se ver.
2. A fila de habilitacao mostra as lojas que pediram LIVE. A mesa aprova,
   rejeita ou suspende, sempre com motivo escrito.
3. No detalhe da loja, a mesa ajusta a condicao comercial -- taxa percentual,
   taxa fixa e prazo de liquidacao -- **como um objeto so**, com o antes e o
   depois visiveis. A mudanca vale para cobranca futura: o que ja foi cobrado
   guarda a taxa do dia em que foi cobrado.
4. Para investigar um chamado, a mesa le pagamento, timeline, saldo, extrato e
   entrega de webhook daquela loja, escolhendo o ambiente explicitamente. Abrir
   a loja ja deixa `store.investigated` na trilha.
5. A trilha e legivel na propria mesa. Toda decisao esta la, com quem decidiu, o
   motivo, o antes e o depois.

**A mesa nao le segredo.** Secret de webhook e chave de API sao invisiveis
inclusive para o operador -- nao filtrados na tela, ausentes da resposta. Um
teste de varredura percorre as rotas de leitura de operador por reflexao e falha
se uma rota futura devolver qualquer um dos dois.

### Catalogo de Products

1. Merchant cria produtos vendaveis em `/dashboard/products` ou via `/api/v1/products`.
2. Integrador cria checkout sessions com `items` pela API, referenciando produtos por `productId`.
3. Checkout publico mostra resumo compacto dos itens sem metadata privada.
4. Pagamento final recebe snapshots em `PaymentItem`, visiveis em APIs autenticadas, recibos e webhooks.

### Operacao financeira simulada

1. Merchant acompanha saldos e transactions em `/dashboard/financials`, no
   ambiente selecionado na topbar.
2. Merchant cadastra destinos Pix e solicita saques em `/dashboard/withdrawals`.
   O destino Pix e store-wide; a reserva sai do ledger do ambiente da sessao.
3. Saques reservam saldo, geram ledger e podem ser completados/falhados por
   simulacao -- em LIVE, so com a loja habilitada pela mesa.

## Cobertura de Produto

| Area | Estado de produto |
| --- | --- |
| Pagamento Pix simulado | Pronto para uso local/demo. |
| Checkout hospedado | Pronto para uso local/demo. |
| Payment Links | Pronto para uso local/demo. |
| Webhooks assinados | Pronto para uso local/demo com logs e retry. |
| Receipts e timeline | Pronto para investigacao operacional. |
| Financials read-only | Pronto para consulta de saldo/extrato. |
| Withdrawals simulados | Pronto para API e dashboard, em TEST ou LIVE. |
| Alerts | Pronto para configuracao operacional basica. |
| Products/catalog | Pronto como catalogo opcional para checkout sessions. |
| Settings | Perfil (`name`, `city`) mutavel e pedido de habilitacao LIVE; fee/settlement read-only para o lojista. |
| Mesa de operador | Pronta como tela: fila, decisao com motivo, condicao comercial, investigacao e trilha. Sem papeis, sem antifraude. |
| Ambiente TEST/LIVE no dashboard | Pronto: seletor na topbar, com LIVE rotulado como simulado e barrado sem habilitacao. |
| Marketplace/split/multi-seller | Fora do produto atual. |

## Limites Nao Negociaveis

- Hockpay nao movimenta dinheiro real.
- Nao ha Pix real, adquirencia real, payout bancario real ou liquidacao externa.
- Cartao, boleto e debito aparecem no modelo, mas nao sao metodos processados de ponta a ponta.
- Qualquer promessa publica deve deixar claro que o produto atual e simulador/dev tooling.

## Indicadores de Sucesso

- Tempo ate primeiro pagamento TEST confirmado.
- Tempo ate primeiro webhook entregue.
- Numero de demos/study-cases que rodam com `smoke:docker`.
- Capacidade de investigar um caso pelo dashboard sem abrir o banco.
- Capacidade de operar a mesa inteira -- fila, decisao, taxa e investigacao -- sem `curl`.
