// Salve em: app.js

// --- CORREÇÃO APLICADA AQUI ---
// 1. GARANTA QUE ESTA SEJA A PRIMEIRA LINHA DO ARQUIVO
// Isso carrega as variáveis de ambiente antes de qualquer outro código ser executado.
require('dotenv').config(); 
// --- FIM DA CORREÇÃO ---

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('./src/models');
const mainRouter = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler.middleware');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rota principal da API
app.use('/api', mainRouter);

// Middleware de Erro (deve ser o último)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    
    await sequelize.sync({ force: true });
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

// Proteção contra crashes
process.on('uncaughtException', (err) => {
  console.error('💥 EXCEÇÃO NÃO CAPTURADA! Desligando o servidor...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (err) => {
  console.error('💥 REJEIÇÃO DE PROMISE NÃO TRATADA! Desligando o servidor...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});