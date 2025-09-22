const express = require('express');
const { 
  syncCartoriosController, 
  getCartoriosController, 
  getEstadosController, 
  getCidadesController 
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




module.exports = router;