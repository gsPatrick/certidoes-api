// Salve em: src/routes/index.js

const express = require('express');
const authRoutes = require('../features/auth/auth.routes');
const cartorioRoutes = require('../features/cartorio/cartorio.routes');
const pedidoRoutes = require('../features/pedido/pedido.routes');
const pagamentoRoutes = require('../features/pagamento/pagamento.routes');
const adminRoutes = require('../features/admin/admin.routes'); // <-- 1. LINHA ADICIONADA: Importar as rotas do admin

const router = express.Router();

// Rota de teste
router.get('/', (req, res) => {
  res.send('API e-certidões no ar!');
});

// Agrupa as rotas de autenticação sob o prefixo /auth
router.use('/auth', authRoutes);

// Agrupa as rotas de cartório sob o prefixo /cartorios
router.use('/cartorios', cartorioRoutes);

// Agrupa as rotas de pedido sob o prefixo /pedidos
router.use('/pedidos', pedidoRoutes);

// Agrupa as rotas de pagamento sob o prefixo /pagamentos
router.use('/pagamentos', pagamentoRoutes);

// Agrupa as rotas de admin sob o prefixo /admin
router.use('/admin', adminRoutes); // <-- 2. LINHA ADICIONADA: Usar as rotas do admin

module.exports = router;