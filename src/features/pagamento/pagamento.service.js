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
          // Se tiver CPF no cadastro, é bom enviar para evitar recusas, mas não é obrigatório
          // identification: { type: "CPF", number: "..." } 
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/meus-pedidos/${pedidoId}?status=sucesso`,
          failure: `${process.env.FRONTEND_URL}/meus-pedidos/${pedidoId}?status=falha`,
          pending: `${process.env.FRONTEND_URL}/meus-pedidos/${pedidoId}?status=pendente`,
        },
        auto_return: 'approved',
        
        // --- ALTERAÇÃO AQUI: LIBERANDO TUDO ---
        payment_methods: {
            excluded_payment_types: [], // Garante que não exclui Boleto nem Pix
            excluded_payment_methods: [], // Garante que não exclui nenhuma bandeira
            installments: null // Libera o parcelamento máximo da sua conta (ex: 12x)
        },
        // --------------------------------------

        external_reference: pedidoId.toString(),
        notification_url: `${process.env.BACKEND_URL}/api/pagamentos/webhook`,
      };

      const response = await mercadopago.preferences.create(preference);

      await Pagamento.create({
        pedidoId: pedidoId,
        gatewayId: response.body.id,
        status: 'pendente',
        metodo: 'mercadopago', 
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
      // Verifica se é o evento correto (algumas versões mandam 'payment', outras 'action: payment.created')
      const type = dados.type || dados.topic;
      
      if (type !== 'payment') {
        console.log(`Webhook do tipo '${type}' ignorado.`);
        return;
      }

      // Pega o ID (pode vir em dados.data.id ou dados.id dependendo da versão da API que disparou)
      const paymentId = (dados.data && dados.data.id) ? dados.data.id : dados.id;
      
      if (!paymentId) {
          console.log('ID do pagamento não encontrado no webhook.');
          return;
      }

      // Busca os detalhes do pagamento na API do Mercado Pago
      const { body: paymentDetails } = await mercadopago.payment.findById(paymentId);

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

      // Mapeia os status do MP para os status do seu banco
      let novoStatusLocal;
      switch (paymentDetails.status) {
        case 'approved': novoStatusLocal = 'aprovado'; break;
        case 'rejected':
        case 'cancelled': novoStatusLocal = 'recusado'; break;
        case 'pending':
        case 'in_process': novoStatusLocal = 'pendente'; break;
        case 'refunded': novoStatusLocal = 'estornado'; break;
        default: novoStatusLocal = pagamento.status; break;
      }
      
      // Atualiza o pagamento se mudou o status
      if (pagamento.status !== novoStatusLocal) {
          pagamento.status = novoStatusLocal;
          
          // Tenta identificar o método usado (pix, bol, master, etc) para salvar no banco
          if (paymentDetails.payment_method_id) {
              if (paymentDetails.payment_method_id === 'pix') {
                  pagamento.metodo = 'pix';
              } else if (paymentDetails.payment_method_id === 'bolbradesco' || paymentDetails.payment_method_id.includes('bol')) {
                  pagamento.metodo = 'boleto';
              } else {
                  pagamento.metodo = 'cartao_credito';
              }
          }
          
          await pagamento.save();
          console.log(`Pagamento do Pedido ${pedidoId} atualizado para '${novoStatusLocal}'.`);
      }

      // Atualiza o pedido principal
      const pedido = await Pedido.findByPk(pedidoId, { include: [{ model: User, as: 'cliente' }] });
      
      if (novoStatusLocal === 'aprovado' && pedido.status === 'Aguardando Pagamento') {
        pedido.status = 'Processando';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Processando'.`);
        
        await emailService.enviarConfirmacaoPedido(pedido);

      } else if (novoStatusLocal === 'recusado' && pedido.status === 'Aguardando Pagamento') {
        // Opcional: Cancelar o pedido imediatamente ou esperar o cliente tentar pagar de novo
        pedido.status = 'Cancelado';
        await pedido.save();
        console.log(`Pedido ${pedidoId} atualizado para 'Cancelado'.`);
      }
    } catch (error) {
      console.error("Erro ao processar webhook do Mercado Pago:", error.message);
    }
  },
};

module.exports = pagamentoService;