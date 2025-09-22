// arquivo: src/features/pagamento/pagamento.controller.js
const pagamentoService = require('./pagamento.service');

const createCheckoutController = async (req, res) => {
  try {
    const { pedidoId } = req.body;
    const userId = req.user.id; // Vem do middleware 'protect'

    if (!pedidoId) {
      return res.status(400).json({ message: 'O ID do pedido é obrigatório.' });
    }

    // NOME DA FUNÇÃO CORRIGIDO AQUI
    const checkoutData = await pagamentoService.criarPreferenciaPagamento(pedidoId, userId);
    
    res.status(200).json(checkoutData);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao gerar checkout.' });
  }
};

const handleWebhookController = async (req, res) => {
  // Responde imediatamente ao Mercado Pago para evitar timeouts
  res.status(200).send('OK');
  
  try {
    console.log('Webhook recebido:', req.body);
    // Nome da função no webhook
    await pagamentoService.processarWebhook(req.body);
  } catch (error) {
    console.error('Erro ao processar webhook do Mercado Pago:', error.message);
  }
};

module.exports = {
  createCheckoutController,
  handleWebhookController,
};