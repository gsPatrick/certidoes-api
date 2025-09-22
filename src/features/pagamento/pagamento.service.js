// arquivo: src/features/pagamento/pagamento.service.js
// DESCRIÇÃO: Este código foi reestruturado para adotar os padrões de organização e robustez do Código 02.
// As principais mudanças incluem:
// 1. Uso de um objeto de serviço (pagamentoService) para exportar os métodos.
// 2. Implementação de blocos try...catch para um tratamento de erros mais consistente.
// 3. Nomenclatura dos métodos em português para padronização.
// 4. Melhoria na lógica do webhook para cobrir mais status de pagamento.
// 5. Troca de 'upsert' por 'create' para maior clareza na criação do pagamento.

const mercadopago = require('../../config/mercadoPago');
const { Pedido, Pagamento, User } = require('../../models');

const pagamentoService = {
  /**
   * Cria uma preferência de pagamento no Mercado Pago para um pedido.
   * @param {number} pedidoId - O ID do pedido criado no nosso banco.
   * @param {number} userId - O ID do usuário logado.
   * @returns {object} - A URL de checkout e o ID da preferência.
   */
  async criarPreferenciaPagamento(pedidoId, userId) {
    try {
      const pedido = await Pedido.findOne({
        where: { id: pedidoId, userId },
        include: [{ model: User, as: 'cliente' }],
      });

      if (!pedido) {
        throw new Error('Pedido não encontrado ou não pertence ao usuário.');
      }
      if (pedido.status !== 'Aguardando Pagamento') {
        throw new Error('Este pedido já foi processado ou pago.');
      }

      const items = [{
        id: pedido.id.toString(),
        title: `Pedido de Certidões - Protocolo #${pedido.protocolo}`,
        unit_price: Number(pedido.valorTotal),
        quantity: 1,
        category_id: "services",
      }];

      const preference = {
        items,
        payer: {
          name: pedido.cliente.nome,
          email: pedido.cliente.email,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/meus-pedidos/${pedidoId}?status=sucesso`,
          failure: `${process.env.FRONTEND_URL}/meus-pedidos/${pedidoId}?status=falha`,
          pending: `${process.env.FRONTEND_URL}/meus-pedidos/${pedidoId}?status=pendente`,
        },
        auto_return: 'approved',
        external_reference: pedidoId.toString(),
        notification_url: `${process.env.BACKEND_URL}/api/pagamentos/webhook`,
      };

      const response = await mercadopago.preferences.create(preference);

      // Usando 'create' em vez de 'upsert' para ser mais explícito, seguindo o padrão do Código 02.
      // A lógica de negócio já impede a criação de uma nova preferência para um pedido já processado.
      await Pagamento.create({
        pedidoId: pedidoId,
        gatewayId: response.body.id, // O ID da PREFERÊNCIA, que será atualizado no webhook para o ID do PAGAMENTO.
        status: 'pendente',
        metodo: 'mercadopago_pro',
        valor: pedido.valorTotal,
      });

      return {
        checkoutUrl: response.body.init_point,
        preferenceId: response.body.id,
      };
    } catch (error) {
      // Padrão de tratamento de erro do Código 02
      console.error("Erro ao criar preferência de pagamento:", error);
      throw error;
    }
  },

  /**
   * Processa as notificações de webhook do Mercado Pago.
   * @param {object} dados - O corpo da notificação do webhook.
   */
  async processarWebhook(dados) {
    try {
      if (dados.type !== 'payment') {
        console.log(`Webhook do tipo '${dados.type}' ignorado.`);
        return;
      }

      const paymentId = dados.data.id;
      const { body: paymentDetails } = await mercadopago.payment.findById(Number(paymentId));
      const pedidoId = paymentDetails.external_reference;

      if (!pedidoId) {
        console.warn(`Webhook para pagamento ${paymentId} recebido sem external_reference.`);
        return;
      }

      const pagamento = await Pagamento.findOne({ where: { pedidoId } });

      if (!pagamento) {
        console.error(`Webhook: Pagamento para o pedido ${pedidoId} não encontrado no banco.`);
        return;
      }

      // Atualiza o gatewayId com o ID do pagamento real, não mais da preferência
      pagamento.gatewayId = paymentId.toString();

      // Estrutura de status aprimorada, inspirada no Código 02
      let novoStatusLocal;
      switch (paymentDetails.status) {
        case 'approved':
          novoStatusLocal = 'aprovado';
          break;
        case 'rejected':
        case 'cancelled':
          novoStatusLocal = 'recusado';
          break;
        case 'pending':
        case 'in_process':
          novoStatusLocal = 'pendente';
          break;
        default:
          novoStatusLocal = pagamento.status; // Mantém o status atual se for um desconhecido
          break;
      }
      
      // Salva apenas se houver mudança de status
      if (pagamento.status !== novoStatusLocal) {
          pagamento.status = novoStatusLocal;
          await pagamento.save();
          console.log(`Pagamento do Pedido ${pedidoId} atualizado para '${novoStatusLocal}'.`);
      }

      // Lógica de atualização do Pedido (mantida do Código 01 original)
      const pedido = await Pedido.findByPk(pedidoId);
      if (novoStatusLocal === 'aprovado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Processando';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Processando'.`);
        // TODO: Enviar e-mail de confirmação para o cliente e admin.
      } else if (novoStatusLocal === 'recusado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Cancelado';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Cancelado'.`);
      }
    } catch (error) {
      // Padrão de tratamento de erro do Código 02
      console.error("Erro ao processar webhook do Mercado Pago:", error);
      throw error;
    }
  },
};

module.exports = pagamentoService;