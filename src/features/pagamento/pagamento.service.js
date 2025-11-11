// Salve em: src/features/pagamento/pagamento.service.js
const mercadopago = require('../../config/mercadoPago');
const { Pedido, Pagamento, User } = require('../../models');
const emailService = require('../../services/email.service');

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
        payment_methods: {
            installments: 3 // Permite parcelar em até 3x
        },
        external_reference: pedidoId.toString(),
        notification_url: `${process.env.BACKEND_URL}/api/pagamentos/webhook`,
      };

      const response = await mercadopago.preferences.create(preference);

      await Pagamento.create({
        pedidoId: pedidoId,
        gatewayId: response.body.id,
        status: 'pendente',
        metodo: 'mercadopago', // CORRIGIDO: Valor compatível com o ENUM do banco
        valor: pedido.valorTotal,
      });

      return {
        checkoutUrl: response.body.init_point,
        preferenceId: response.body.id,
      };
    } catch (error) {
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
      
      // --- CORREÇÃO APLICADA AQUI ---
      // Remova a conversão Number(). O ID do pagamento deve ser tratado como string.
      const { body: paymentDetails } = await mercadopago.payment.findById(paymentId);
      // --- FIM DA CORREÇÃO ---

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

      pagamento.gatewayId = paymentId.toString();

      let novoStatusLocal;
      switch (paymentDetails.status) {
        case 'approved': novoStatusLocal = 'aprovado'; break;
        case 'rejected':
        case 'cancelled': novoStatusLocal = 'recusado'; break;
        case 'pending':
        case 'in_process': novoStatusLocal = 'pendente'; break;
        default: novoStatusLocal = pagamento.status; break;
      }
      
      if (pagamento.status !== novoStatusLocal) {
          pagamento.status = novoStatusLocal;
          await pagamento.save();
          console.log(`Pagamento do Pedido ${pedidoId} atualizado para '${novoStatusLocal}'.`);
      }

      const pedido = await Pedido.findByPk(pedidoId, { include: [{ model: User, as: 'cliente' }] });
      if (novoStatusLocal === 'aprovado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Processando';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Processando'.`);
        
        await emailService.enviarConfirmacaoPedido(pedido);

      } else if (novoStatusLocal === 'recusado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Cancelado';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Cancelado'.`);
      }
    } catch (error) {
      console.error("Erro ao processar webhook do Mercado Pago:", error.message);
      // Não jogue o erro aqui para não fazer o processo do webhook parar para o MP
    }
  },
};
};

module.exports = pagamentoService;
