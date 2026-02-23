import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

/**
 * Interface do PixGeneratorService
 */
export interface PixGeneratorService {
  generate(payload: {
    amount: number;
    description?: string;
    merchantId: string;
    paymentId: string;
  }): Promise<{
    qrCode: string;
    copyPaste: string;
  }>;
}

/**
 * Implementação do PixGeneratorService
 *
 * Gera QR Codes Pix simulados para pagamento.
 * Em produção, isso seria integrado com um provedor de Pix real.
 */
@Injectable()
export class QrCodePixGeneratorService implements PixGeneratorService {
  /**
   * Gera um QR Code Pix para um pagamento
   *
   * @param payload - Dados para geração do QR Code
   * @returns QR Code em base64 e código copia e cola
   */
  async generate(payload: {
    amount: number;
    description?: string;
    merchantId: string;
    paymentId: string;
  }): Promise<{
    qrCode: string; // base64
    copyPaste: string;
  }> {
    // Gera o código Pix Copia e Cola (simulado - formato EMV do Pix)
    const copyPaste = this.generateCopyPasteCode(payload);

    // Gera o QR Code em base64
    const qrCode = await QRCode.toDataURL(copyPaste, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return {
      qrCode,
      copyPaste,
    };
  }

  /**
   * Gera o código Pix Copia e Cola (formato EMV)
   *
   * Este é um código simulado para fins de demonstração.
   * Em produção, seria gerado segundo as especificações do Pix do Banco Central.
   */
  private generateCopyPasteCode(payload: {
    amount: number;
    description?: string;
    merchantId: string;
    paymentId: string;
  }): string {
    // Payload formatado para o Pix (simulado)
    // Em produção, seguir o padrão EMVCo do Pix

    const amount = (payload.amount / 100).toFixed(2);

    // Simulação do código PIX (BR.CODE)
    const pixCode = `00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540${amount}5802BR5925HOCKPAY_PAGAMENTOS${payload.merchantId}6009SAO PAULO62070503***6304`;

    return pixCode;
  }

  /**
   * Gera um código de transação Pix (TxId) simulado
   *
   * @param paymentId - ID do pagamento
   * @returns TxId simulado
   */
  generateTxId(paymentId: string): string {
    // Em produção, o TxId seria gerado pelo provedor de Pix
    // Aqui geramos um TxId determinístico baseado no paymentId
    const timestamp = Date.now();
    const hash = Buffer.from(`${paymentId}-${timestamp}`).toString('base64').slice(0, 26);
    return `${hash}***`;
  }
}
