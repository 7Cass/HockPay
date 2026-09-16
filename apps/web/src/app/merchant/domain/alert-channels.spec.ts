import { CHANNEL_OPTIONS, alertBlocker, isDiscordWebhook } from './alert-channels';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF-ghi_JKL';

describe('canais de alerta', () => {
  it('mostra os canais que ainda não existem, desligados', () => {
    // A lista com uma opção só é lida como "o produto não faz isso".
    const off = CHANNEL_OPTIONS.filter((channel) => !channel.available);
    expect(off.map((channel) => channel.value)).toEqual(['email', 'whatsapp']);
    expect(CHANNEL_OPTIONS.filter((channel) => channel.available)).toHaveLength(1);
  });
});

describe('URL de webhook do Discord', () => {
  it('aceita a URL que o Discord entrega', () => {
    expect(isDiscordWebhook(WEBHOOK)).toBe(true);
    expect(isDiscordWebhook(`  ${WEBHOOK}  `)).toBe(true);
  });

  it('aceita as variantes de domínio e a versão da API', () => {
    expect(isDiscordWebhook('https://discordapp.com/api/webhooks/1/abc')).toBe(true);
    expect(isDiscordWebhook('https://canary.discord.com/api/v10/webhooks/1/abc')).toBe(true);
  });

  it('recusa a URL do canal, que é o engano de todo mundo', () => {
    expect(isDiscordWebhook('https://discord.com/channels/123/456')).toBe(false);
  });

  it('recusa http, outro domínio e lixo', () => {
    expect(isDiscordWebhook('http://discord.com/api/webhooks/1/abc')).toBe(false);
    expect(isDiscordWebhook('https://discord.evil.com/api/webhooks/1/abc')).toBe(false);
    expect(isDiscordWebhook('não é url')).toBe(false);
    expect(isDiscordWebhook('')).toBe(false);
  });
});

describe('o que impede de salvar um alerta', () => {
  const base = { name: 'Vendas', webhookUrl: WEBHOOK, events: ['payment.confirmed'] };

  it('deixa passar o que está completo', () => {
    expect(alertBlocker({ ...base, isEditing: false })).toBeNull();
  });

  it('cobra um nome', () => {
    expect(alertBlocker({ ...base, name: '   ', isEditing: false })).toContain('nome');
  });

  it('cobra a URL na criação', () => {
    expect(alertBlocker({ ...base, webhookUrl: '', isEditing: false })).toContain('Discord');
  });

  it('na edição, URL vazia significa manter a que já está gravada', () => {
    // A API não devolve a URL guardada; vazio ali não é "apague".
    expect(alertBlocker({ ...base, webhookUrl: '', isEditing: true })).toBeNull();
  });

  it('cobra pelo menos um evento', () => {
    expect(alertBlocker({ ...base, events: [], isEditing: false })).toContain('evento');
  });
});
