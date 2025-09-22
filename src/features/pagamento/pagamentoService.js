// Salve em: src/features/pagamento/pagamento.service.js
const mercadopago = require('../../config/mercadoPago');
const { Pedido, Pagamento, User } = require('../../models');
const emailService = require('../../services/email.service'); // <-- 1. IMPORTE O SERVIÇO DE E-MAIL

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
        const error = new Error('Pedido não encontrado ou não pertence ao usuário.');
        error.statusCode = 404;
        throw error;
      }
      if (pedido.status !== 'Aguardando Pagamento') {
        const error = new Error('Este pedido já foi processado ou pago.');
        error.statusCode = 400;
        throw error;
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
        // --- 2. ADICIONAR PARCELAMENTO ---
        payment_methods: {
          installments: 3 // Permite parcelar em até 3x
        },
        // --- FIM DA ADIÇÃO ---
        external_reference: pedidoId.toString(),
        notification_url: `${process.env.BACKEND_URL}/api/pagamentos/webhook`,
      };

      const response = await mercadopago.preferences.create(preference);

      await Pagamento.create({
        pedidoId: pedidoId,
        gatewayId: response.body.id,
        status: 'pendente',
        metodo: 'mercadopago_pro', // Este campo pode ser melhorado no futuro
        valor: pedido.valorTotal,
      });

      return {
        checkoutUrl: response.body.init_point,
        preferenceId: response.body.id,
      };
    } catch (error) {
      console.error("Erro ao criar preferência de pagamento:", error);
      const newError = new Error(error.message || 'Falha ao gerar preferência de pagamento.');
      newError.statusCode = error.statusCode || 500;
      throw newError;
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

      pagamento.gatewayId = paymentId.toString();

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
          novoStatusLocal = pagamento.status;
          break;
      }
      
      if (pagamento.status !== novoStatusLocal) {
          pagamento.status = novoStatusLocal;
          await pagamento.save();
          console.log(`Pagamento do Pedido ${pedidoId} atualizado para '${novoStatusLocal}'.`);
      }

      // --- 3. MODIFICAÇÃO PARA INCLUIR DADOS DO CLIENTE PARA O E-MAIL ---
      const pedido = await Pedido.findByPk(pedidoId, { 
        include: [{ model: User, as: 'cliente' }] 
      });

      if (!pedido) {
          console.error(`Webhook: Pedido ${pedidoId} não encontrado no banco para atualização de status.`);
          return;
      }

      if (novoStatusLocal === 'aprovado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Processando';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Processando'.`);

        // --- 4. CHAMAR O SERVIÇO DE E-MAIL ---
        await emailService.enviarConfirmacaoPedido(pedido);
        // --- FIM DA CHAMADA ---

      } else if (novoStatusLocal === 'recusado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Cancelado';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Cancelado'.`);
      }
    } catch (error) {
      console.error("Erro ao processar webhook do Mercado Pago:", error);
      // Não relança o erro aqui para evitar que o Mercado Pago fique tentando reenviar o webhook indefinidamente por um erro interno nosso.
    }
  },
};

module.exports = pagamentoService;