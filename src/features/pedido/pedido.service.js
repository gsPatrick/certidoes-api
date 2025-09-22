// Salve em: src/features/pedido/pedido.service.js

const { Pedido, Cartorio, User, ArquivoPedido, ItemPedido, sequelize } = require('../../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[PedidoService] ${timestamp}: ${message}`);
};

/**
 * Cria um novo pedido.
 */

const createPedidoService = async (pedidoData, userId, files) => { // <-- 1. RECEBE 'files'
  const { itens, dadosCliente } = pedidoData;

  // Validações
  if (!itens || !Array.isArray(JSON.parse(itens)) || JSON.parse(itens).length === 0) {
    const error = new Error("O pedido deve conter pelo menos um item.");
    error.statusCode = 400;
    throw error;
  }
  const parsedDadosCliente = JSON.parse(dadosCliente);
  if (!parsedDadosCliente || !parsedDadosCliente.nome || !parsedDadosCliente.email || !parsedDadosCliente.cpf) {
      const error = new Error("Dados do cliente (nome, email, cpf) são obrigatórios.");
      error.statusCode = 400;
      throw error;
  }
  
  const parsedItens = JSON.parse(itens);

  const transaction = await sequelize.transaction();
  try {
    const valorTotal = parsedItens.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);

    const novoPedido = await Pedido.create({
      userId,
      dadosCliente: parsedDadosCliente,
      status: 'Aguardando Pagamento',
      valorTotal,
      cartorioId: null,
    }, { transaction });
    
    const today = new Date();
    novoPedido.protocolo = `EC${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${novoPedido.id}`;
    await novoPedido.save({ transaction });
    
    const itensParaSalvar = parsedItens.map(item => ({
      pedidoId: novoPedido.id,
      nomeProduto: item.name,
      slugProduto: item.slug,
      preco: parseFloat(item.price) || 0,
      dadosFormulario: item.formData || {},
    }));
    
    await ItemPedido.bulkCreate(itensParaSalvar, { transaction });
    
    // --- 2. LÓGICA PARA SALVAR OS ANEXOS DO CLIENTE ---
    if (files && files.length > 0) {
        const arquivosParaSalvar = files.map(file => ({
            pedidoId: novoPedido.id,
            nomeOriginal: file.originalname,
            path: file.filename,
            tipo: 'comprovante', // Tipo para arquivos do cliente
        }));
        await ArquivoPedido.bulkCreate(arquivosParaSalvar, { transaction });
    }
    // --- FIM DA LÓGICA ---

    await transaction.commit();
    return novoPedido;

  } catch (error) {
    await transaction.rollback();
    console.error(`Erro ao criar pedido: ${error.message}`);
    // Limpa arquivos órfãos em caso de erro no banco
    if (files && files.length > 0) {
        files.forEach(file => {
            const filePath = path.resolve(process.cwd(), 'uploads', file.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    }
    throw error;
  }
};

/**
 * Lista todos os pedidos de um usuário.
 */
const listUserPedidosService = async (userId) => {
  const pedidos = await Pedido.findAll({
    where: { userId },
    include: [{ model: ItemPedido, as: 'itens' }],
    order: [['createdAt', 'DESC']],
  });
  return pedidos;
};

/**
 * Busca os detalhes de um pedido específico.
 */
const getPedidoByIdService = async (pedidoId, userId) => {
  const pedido = await Pedido.findOne({
    where: { id: pedidoId, userId: userId },
    include: [
      { model: ItemPedido, as: 'itens' },
      { model: ArquivoPedido, as: 'arquivos' }
    ]
  });

  if (!pedido) {
    const error = new Error('Pedido não encontrado ou você não tem permissão para acessá-lo.');
    error.statusCode = 404;
    throw error;
  }
  return pedido;
};

/**
 * Prepara um arquivo para download.
 */
const downloadArquivoService = async (pedidoId, arquivoId, userId) => {
  const arquivo = await ArquivoPedido.findOne({
    where: { id: arquivoId, pedidoId: pedidoId },
    include: [{
      model: Pedido,
      as: 'pedido',
      where: { userId: userId },
      attributes: []
    }]
  });

  if (!arquivo) {
    const error = new Error('Arquivo não encontrado ou você não tem permissão para baixá-lo.');
    error.statusCode = 404;
    throw error;
  }

  const filePath = path.resolve(process.cwd(), 'uploads', arquivo.path);
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado no sistema de arquivos: ${filePath}`);
    const error = new Error('Ocorreu um erro e o arquivo não pôde ser encontrado.');
    error.statusCode = 500;
    throw error;
  }

  return { filePath, nomeOriginal: arquivo.nomeOriginal };
};

module.exports = {
  createPedidoService,
  listUserPedidosService,
  getPedidoByIdService,
  downloadArquivoService,
};