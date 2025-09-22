// Salve em: src/features/frete/frete.routes.js
const express = require('express');
const { calcularFreteController } = require('./frete.controller');

const router = express.Router();

// @route   POST /api/frete/calcular
// @desc    Calcula as opções de frete para um CEP
// @access  Public
router.post('/calcular', calcularFreteController);

module.exports = router;