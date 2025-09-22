// Salve em: src/features/pedido/pedido.routes.js
const express = require('express');
const { 
    createPedidoController,
    listUserPedidosController,
    getPedidoByIdController,
    downloadArquivoController
} = require('./pedido.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

// @route   POST /api/pedidos
// @desc    Cria um novo pedido para o usuário autenticado.
// @access  Private (CORRIGIDO: Agora requer login)
router.post('/', protect, createPedidoController); // <-- CORREÇÃO APLICADA AQUI

// @route   GET /api/pedidos/meus-pedidos
// @desc    Lista os pedidos do usuário autenticado.
// @access  Private
router.get('/meus-pedidos', protect, listUserPedidosController);

// @route   GET /api/pedidos/:id
// @desc    Busca os detalhes de um pedido específico do usuário autenticado.
// @access  Private
router.get('/:id', protect, getPedidoByIdController);

// @route   GET /api/pedidos/:pedidoId/arquivos/:arquivoId/download
// @desc    Faz o download de um arquivo de um pedido do usuário autenticado.
// @access  Private
router.get('/:pedidoId/arquivos/:arquivoId/download', protect, downloadArquivoController);

module.exports = router;