const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../../models');

const register = async (userData) => {
  const { nome, email, password } = userData;

  // 1. Verificar se o e-mail já está em uso
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const error = new Error('Este e-mail já está cadastrado.');
    error.statusCode = 409; // 409 Conflict
    throw error;
  }

  // 2. Criptografar a senha
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 3. Criar o novo usuário no banco
  const newUser = await User.create({
    nome,
    email,
    password: hashedPassword,
  });

  // 4. Remover a senha do objeto de retorno por segurança
  newUser.password = undefined;
  return newUser;
};

const login = async (loginData) => {
  const { email, password } = loginData;

  // 1. Encontrar o usuário pelo e-mail
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const error = new Error('Credenciais inválidas.');
    error.statusCode = 401; // 401 Unauthorized
    throw error;
  }

  // 2. Comparar a senha fornecida com a senha criptografada no banco
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Credenciais inválidas.');
    error.statusCode = 401;
    throw error;
  }

  // 3. Gerar o token JWT
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // 4. Preparar o objeto de retorno
  user.password = undefined; // Nunca retorne a senha
  return { user, token };
};

module.exports = {
  register,
  login,
};