const express = require('express');
const { protect, authorize } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const {
  listAllPedidosController,
  getPedidoDetailsAdminController,
  updatePedidoAdminController,
  uploadArquivoAdminController,
  estornarPedidoController
} = require('./admin.controller');

const router = express.Router();

// Aplica os middlewares de proteção e autorização para TODAS as rotas deste arquivo.
router.use(protect, authorize('admin'));

// @route   GET /api/admin/pedidos
// @desc    Lista todos os pedidos com filtros
// @access  Private (Admin)
router.get('/pedidos', listAllPedidosController);

// @route   GET /api/admin/pedidos/:id
// @desc    Busca os detalhes de um pedido específico
// @access  Private (Admin)
router.get('/pedidos/:id', getPedidoDetailsAdminController);

// @route   PUT /api/admin/pedidos/:id
// @desc    Atualiza o status, código de rastreio, etc. de um pedido
// @access  Private (Admin)
router.put('/pedidos/:id', updatePedidoAdminController);

// @route   POST /api/admin/pedidos/:id/upload
// @desc    Faz o upload de um arquivo para um pedido
// @access  Private (Admin)
router.post('/pedidos/:id/upload', upload.single('arquivoCertidao'), uploadArquivoAdminController);

// @route   POST /api/admin/pedidos/:id/estornar
// @desc    Realiza o estorno de um pedido pago
// @access  Private (Admin)
router.post('/pedidos/:id/estornar', estornarPedidoController);

module.exports = router;