// Salve em: src/services/email.service.js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const emailService = {
  /**
   * Envia um e-mail de confirmação de pedido quando o pagamento é aprovado.
   * @param {object} pedido - O objeto do pedido com os dados do cliente.
   */
  async enviarConfirmacaoPedido(pedido) {
    try {
      const nomeCliente = pedido.cliente?.nome?.split(' ')[0] || 'Cliente';

      await resend.emails.send({
        from: 'e-Certidões <contato@e-certidoes.net.br>', // Use um domínio verificado no Resend
        to: [pedido.cliente.email],
        subject: `✅ Pedido Confirmado: Protocolo #${pedido.protocolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Olá, ${nomeCliente}!</h2>
            <p>Seu pagamento foi aprovado e o pedido <strong>#${pedido.protocolo}</strong> já está em processamento.</p>
            <p>Você pode acompanhar todas as atualizações acessando sua área do cliente em nosso site.</p>
            <p>Agradecemos a sua confiança!</p>
            <p><strong>Equipe e-Certidões</strong></p>
          </div>
        `,
      });
      console.log(`E-mail de confirmação enviado para o pedido ${pedido.id}.`);
    } catch (error) {
      console.error(`Falha ao enviar e-mail de confirmação para o pedido ${pedido.id}:`, error);
    }
  },

  /**
   * Envia um e-mail notificando sobre uma atualização de status, observação ou rastreio.
   * @param {object} pedido - O objeto do pedido atualizado.
   */
  async enviarAtualizacaoStatus(pedido) {
    try {
      const nomeCliente = pedido.cliente?.nome?.split(' ')[0] || 'Cliente';

      await resend.emails.send({
        from: 'e-Certidões <contato@e-certidoes.net.br>',
        to: [pedido.cliente.email],
        subject: `🔔 Atualização do Pedido: Protocolo #${pedido.protocolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Olá, ${nomeCliente}!</h2>
            <p>Seu pedido <strong>#${pedido.protocolo}</strong> foi atualizado.</p>
            <p><strong>Novo Status:</strong> ${pedido.status}</p>
            ${pedido.observacoesAdmin ? `<p><strong>Observações:</strong> ${pedido.observacoesAdmin}</p>` : ''}
            ${pedido.codigoRastreio ? `<p><strong>Código de Rastreio:</strong> ${pedido.codigoRastreio}</p>` : ''}
            <p>Acesse nosso site para ver todos os detalhes.</p>
            <p><strong>Equipe e-Certidões</strong></p>
          </div>
        `,
      });
      console.log(`E-mail de atualização de status enviado para o pedido ${pedido.id}.`);
    } catch (error) {
      console.error(`Falha ao enviar e-mail de atualização para o pedido ${pedido.id}:`, error);
    }
  },

  /**
   * Envia um e-mail quando um documento (certidão) está disponível para download.
   * @param {object} pedido - O objeto do pedido.
   * @param {object} arquivo - O objeto do arquivo que foi enviado.
   */
  async enviarDocumentoDisponivel(pedido, arquivo) {
    try {
      const nomeCliente = pedido.cliente?.nome?.split(' ')[0] || 'Cliente';
      const downloadUrl = `${process.env.BACKEND_URL}/api/pedidos/${pedido.id}/arquivos/${arquivo.id}/download`;

      await resend.emails.send({
        from: 'e-Certidões <contato@e-certidoes.net.br>',
        to: [pedido.cliente.email],
        subject: `📄 Documento Disponível: Protocolo #${pedido.protocolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Olá, ${nomeCliente}!</h2>
            <p>Boas notícias! O documento referente ao seu pedido <strong>#${pedido.protocolo}</strong> está pronto.</p>
            <p>Você já pode acessá-lo na sua área do cliente ou diretamente pelo link abaixo:</p>
            <a href="${downloadUrl}" style="display: inline-block; padding: 10px 20px; background-color: #294B29; color: #fff; text-decoration: none; border-radius: 5px;">
              Baixar ${arquivo.nomeOriginal}
            </a>
            <p><strong>Equipe e-Certidões</strong></p>
          </div>
        `,
      });
      console.log(`E-mail de documento disponível enviado para o pedido ${pedido.id}.`);
    } catch (error) {
      console.error(`Falha ao enviar e-mail de documento disponível para o pedido ${pedido.id}:`, error);
    }
  },
};

module.exports = emailService;