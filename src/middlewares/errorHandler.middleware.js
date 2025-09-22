// Salve em: src/middlewares/errorHandler.middleware.js

/**
 * Middleware de tratamento de erros global.
 * DEVE ser o último middleware adicionado no app.js.
 * Ele é acionado quando um erro é passado para a função `next()` (ex: next(error))
 * ou quando um erro é lançado de uma rota assíncrona.
 */
const errorHandler = (err, req, res, next) => {
  // Loga o erro completo no console para depuração (importante para o lado do servidor)
  console.error('🔥 ERRO NÃO TRATADO:', err.stack);

  // Define um status code padrão, caso o erro não tenha um
  const statusCode = err.statusCode || 500;

  // Define uma mensagem de erro padrão
  const message = err.message || 'Ocorreu um erro interno no servidor.';

  // Envia uma resposta JSON padronizada para o cliente
  res.status(statusCode).json({
    status: 'error',
    statusCode: statusCode,
    message: message,
    // Em ambiente de desenvolvimento, podemos enviar mais detalhes
    // NUNCA envie o stack trace em produção por questões de segurança
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;