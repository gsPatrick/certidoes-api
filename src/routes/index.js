// Salve em: src/routes/index.js
const express = require('express');
const authRoutes = require('../features/auth/auth.routes');
const cartorioRoutes = require('../features/cartorio/cartorio.routes');
const pedidoRoutes = require('../features/pedido/pedido.routes');
const pagamentoRoutes = require('../features/pagamento/pagamento.routes');
const adminRoutes = require('../features/admin/admin.routes');
const freteRoutes = require('../features/frete/frete.routes'); // <-- 1. IMPORTE AS ROTAS DE FRETE

const router = express.Router();

router.get('/', (req, res) => res.send('API e-certidões no ar!'));
router.use('/auth', authRoutes);
router.use('/cartorios', cartorioRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/pagamentos', pagamentoRoutes);
router.use('/admin', adminRoutes);
router.use('/frete', freteRoutes); // <-- 2. USE AS ROTAS DE FRETE

module.exports = router;