const express = require('express');
const { registerController, loginController } = require('./auth.controller');
const router = express.Router();
// @route POST /api/auth/register
// @desc Registra um novo usuário
// @access Public
router.post('/register', registerController);
// @route POST /api/auth/login
// @desc Autentica um usuário e retorna o token
// @access Public
router.post('/login', loginController);

module.exports = router;
