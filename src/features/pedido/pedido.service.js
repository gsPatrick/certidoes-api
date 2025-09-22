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

const createPedidoService = async (pedidoData, userId) => {
  const { itens, dadosCliente } = pedidoData;

  // Validações... (código existente omitido por brevidade)
  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    const error = new Error("O pedido deve conter pelo menos um item.");
    error.statusCode = 400;
    throw error;
  }
  if (!dadosCliente || !dadosCliente.nome || !dadosCliente.email || !dadosCliente.cpf) {
      const error = new Error("Dados do cliente (nome, email, cpf) são obrigatórios.");
      error.statusCode = 400;
      throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    log('Iniciando criação de pedido...');
    const valorTotal = itens.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);

    const novoPedido = await Pedido.create({
      userId: userId,
      dadosCliente: dadosCliente,
      status: 'Aguardando Pagamento',
      valorTotal: valorTotal,
      cartorioId: null,
    }, { transaction });
    
    // --- CORREÇÃO: GERANDO E SALVANDO O PROTOCOLO ---
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    novoPedido.protocolo = `EC${year}${month}${day}-${novoPedido.id}`;
    await novoPedido.save({ transaction }); // Salva o protocolo dentro da mesma transação
    // --- FIM DA CORREÇÃO ---
    
    log(`Pedido #${novoPedido.id} (Protocolo: ${novoPedido.protocolo}) criado. Adicionando itens...`);

    const itensParaSalvar = itens.map(item => ({
      pedidoId: novoPedido.id,
      nomeProduto: item.name,
      slugProduto: item.slug,
      preco: parseFloat(item.price) || 0,
      dadosFormulario: item.formData || {},
    }));
    
    await ItemPedido.bulkCreate(itensParaSalvar, { transaction });

    await transaction.commit();
    log(`✅ Pedido #${novoPedido.id} finalizado com sucesso.`);
    return novoPedido;

  } catch (error) {
    await transaction.rollback();
    log(`❌ Erro ao criar pedido: ${error.message}`);
    if (!error.statusCode) {
        console.error('Erro detalhado no banco de dados:', error);
        throw new Error('Falha ao processar o pedido no banco de dados.');
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