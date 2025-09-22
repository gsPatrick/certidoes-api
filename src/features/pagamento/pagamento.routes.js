// arquivo: src/features/pagamento/pagamento.routes.js
const express = require('express');
const { createCheckoutController, handleWebhookController } = require('./pagamento.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

// @route   POST /api/pagamentos/criar-checkout
// @desc    Cria uma preferência de pagamento no MP e retorna a URL
// @access  Private (requer login do cliente)
router.post('/criar-checkout', protect, createCheckoutController);

// @route   POST /api/pagamentos/webhook
// @desc    Recebe notificações de status do Mercado Pago
// @access  Public
router.post('/webhook', handleWebhookController);

module.exports = router;