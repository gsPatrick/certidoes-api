const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Embora não usado diretamente aqui, é bom ter para futuras expansões

/**
 * Middleware para verificar o token JWT e proteger rotas.
 * Garante que apenas usuários autenticados possam prosseguir.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Verifica se o token está presente no header 'Authorization'
  // O formato esperado é 'Bearer <token>'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Extrai o token do header (removendo a palavra 'Bearer ')
      token = req.headers.authorization.split(' ')[1];

      // 3. Verifica e decodifica o token usando a chave secreta
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Anexa os dados decodificados (payload) ao objeto 'req'
      // Isso torna os dados do usuário (id, email, role) disponíveis
      // para qualquer rota protegida que venha a seguir.
      req.user = decoded; 

      next(); // Permite que a requisição continue para o próximo middleware ou controller
    } catch (error) {
      console.error('Erro na autenticação do token:', error.message);
      return res.status(401).json({ message: 'Não autorizado, token inválido.' });
    }
  }

  // 5. Se nenhum token for encontrado no header
  if (!token) {
    return res.status(401).json({ message: 'Não autorizado, nenhum token fornecido.' });
  }
};

/**
 * Middleware para verificar a permissão (role) do usuário.
 * Usado APÓS o middleware 'protect'.
 * @param  {...string} roles - Uma lista de roles permitidas (ex: 'admin', 'cliente')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Verifica se a role do usuário (anexada por 'protect') está na lista de roles permitidas
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Acesso negado. A permissão '${req.user.role}' não é suficiente para acessar este recurso.`
      });
    }
    next(); // Se a permissão for válida, continua a requisição
  };
};

module.exports = { 
  protect, 
  authorize 
};