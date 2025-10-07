

const express = require('express');
const { 
  syncCartoriosController, 
  getCartoriosController, 
  getEstadosController, 
  getCidadesController,
  contarCartoriosProtestoController // <-- 1. Importa o novo controller
} = require('./cartorio.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();

// ROTA MANTIDA: Sincronização manual para o Admin
router.post('/sync', protect, authorize('admin'), syncCartoriosController);

// ROTA ALTERADA: Agora busca cartórios em tempo real via Infosimples
// Exemplo: /api/cartorios?estado=SP&cidade=SAO PAULO
router.get('/', getCartoriosController);

// ROTA MANTIDA: Busca a lista de todos os estados
// Exemplo: /api/cartorios/estados
router.get('/estados', getEstadosController);

// ROTA MANTIDA: Busca cidades de um estado específico via IBGE
// Exemplo: /api/cartorios/estados/SP/cidades
router.get('/estados/:estado/cidades', getCidadesController);

// --- NOVA ROTA PARA CONTAGEM DE CARTÓRIOS DE PROTESTO ---
// @route   GET /api/cartorios/contar-protesto
// @desc    Conta quantos cartórios de protesto existem em uma cidade
// @access  Public
// Exemplo: /api/cartorios/contar-protesto?estado=SP&cidade=SAO PAULO
router.get('/contar-protesto', contarCartoriosProtestoController); // <-- 2. Adiciona a nova rota


module.exports = router;