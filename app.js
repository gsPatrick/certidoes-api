// arquivo: app.js
require('dotenv').config();
const express = require('express');
const cors =require('cors');
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('./src/models');
const mainRouter = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler.middleware'); // <-- 1. IMPORTE O NOVO MIDDLEWARE

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rota principal da API
app.use('/api', mainRouter);


// --- 2. ADICIONE O MIDDLEWARE DE ERRO AQUI ---
// Ele DEVE ser o último middleware a ser adicionado, depois de todas as rotas.
// Se um erro ocorrer em qualquer rota acima, ele cairá aqui.
app.use(errorHandler);


const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, async () => { // <-- Mudei para 'server' para poder fechar depois
  console.log(`Servidor rodando na porta ${PORT}`);
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    
    await sequelize.sync({ alter: true }); // Mudei para alter: true, que é mais seguro
    console.log('Modelos do banco de dados sincronizados.');

    const createAdminUser = async () => {
      try {
        const adminEmail = 'admin@admin.com';
        console.log('Verificando existência do usuário admin...');
        const existingAdmin = await User.findOne({ where: { email: adminEmail } });
        if (!existingAdmin) {
          console.log('Usuário admin não encontrado. Criando novo...');
          const hashedPassword = await bcrypt.hash('Admin123', 10);
          await User.create({
            nome: 'Administrador',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
          });
          console.log('✅ Usuário admin criado com sucesso!');
        } else {
          console.log('Usuário admin já existe. Nenhuma ação necessária.');
        }
      } catch (error) {
        console.error('❌ Erro ao criar usuário admin:', error);
      }
    };
    
    await createAdminUser();

  } catch (error) {
    console.error('Não foi possível conectar ao banco de dados:', error);
  }
});


// --- 3. ADICIONE A PROTEÇÃO FINAL CONTRA CRASHES ---
// Pega exceções que não foram capturadas em nenhum lugar no código
process.on('uncaughtException', (err) => {
  console.error('💥 EXCEÇÃO NÃO CAPTURADA! Desligando o servidor...');
  console.error(err.name, err.message);
  console.error(err.stack);
  // Fecha o servidor e encerra o processo
  server.close(() => {
    process.exit(1); // 1 indica que saiu com erro
  });
});

// Pega rejeições de Promises que não foram capturadas (ex: um await sem catch)
process.on('unhandledRejection', (err) => {
  console.error('💥 REJEIÇÃO DE PROMISE NÃO TRATADA! Desligando o servidor...');
  console.error(err.name, err.message);
  console.error(err.stack);
  // Fecha o servidor e encerra o processo
  server.close(() => {
    process.exit(1);
  });
});