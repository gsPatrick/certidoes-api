const authService = require('./auth.service');

const registerController = async (req, res) => {
  try {
    const newUser = await authService.register(req.body);
    res.status(201).json({
      message: 'Usuário registrado com sucesso!',
      user: newUser,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Erro interno do servidor' });
  }
};

const loginController = async (req, res) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.status(200).json({
      message: 'Login bem-sucedido!',
      user,
      token,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Erro interno do servidor' });
  }
};

module.exports = {
  registerController,
  loginController,
};