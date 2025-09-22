// Salve em: src/features/admin/admin.service.js

const { Pedido, User, Cartorio, Pagamento, ArquivoPedido, ItemPedido } = require('../../models'); // Adicionado ItemPedido aqui
const { Op } = require('sequelize');

/**
 * Lista todos os pedidos do sistema com filtros e paginação.
 */
const listAllPedidosService = async (query) => {
  const { status, page = 1, limit = 10 } = query;
  const whereClause = {};
  if (status) {
    whereClause.status = status;
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await Pedido.findAndCountAll({
    where: whereClause,
    include: [{ model: User, as: 'cliente', attributes: ['nome', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  return {
    totalPedidos: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    pedidos: rows,
  };
};

/**
 * Busca os detalhes completos de um pedido para o admin.
 */
const getPedidoDetailsAdminService = async (pedidoId) => {
  const pedido = await Pedido.findByPk(pedidoId, {
    include: [
      { model: User, as: 'cliente', attributes: { exclude: ['password'] } },
      { model: Cartorio, as: 'cartorio' },
      { model: Pagamento, as: 'pagamento' },
      { model: ArquivoPedido, as: 'arquivos' },
      { model: ItemPedido, as: 'itens' }, // <-- CORREÇÃO: LINHA ADICIONADA AQUI
    ],
  });

  if (!pedido) {
    const error = new Error('Pedido não encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return pedido;
};

/**
 * Atualiza os dados de um pedido.
 */
const updatePedidoAdminService = async (pedidoId, updateData) => {
  const { status, codigoRastreio, observacoesAdmin } = updateData;

  const pedido = await Pedido.findByPk(pedidoId);
  if (!pedido) {
    const error = new Error('Pedido não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  if (status) pedido.status = status;
  if (codigoRastreio !== undefined) pedido.codigoRastreio = codigoRastreio; // Permite limpar o campo
  if (observacoesAdmin !== undefined) pedido.observacoesAdmin = observacoesAdmin; // Permite limpar o campo

  await pedido.save();
  
  // TODO: Disparar e-mail para o cliente informando a atualização de status.

  return pedido;
};

/**
 * Associa um arquivo enviado a um pedido.
 */
const uploadArquivoAdminService = async (pedidoId, fileData) => {
  const { originalname, filename } = fileData;

  const pedido = await Pedido.findByPk(pedidoId);
  if (!pedido) {
    const error = new Error('Pedido não encontrado para associar o arquivo.');
    error.statusCode = 404;
    throw error;
  }

  const novoArquivo = await ArquivoPedido.create({
    pedidoId: pedidoId,
    nomeOriginal: originalname,
    path: filename,
    tipo: 'certidao',
  });
  
  // Opcional: Atualizar o status do pedido para "Concluído" após o upload
  if (pedido.status !== 'Concluído') {
      pedido.status = 'Concluído';
      await pedido.save();
  }

  return {
    message: 'Arquivo enviado com sucesso e associado ao pedido.',
    arquivo: novoArquivo,
    pedidoStatus: pedido.status,
  };
};

module.exports = {
  listAllPedidosService,
  getPedidoDetailsAdminService,
  updatePedidoAdminService,
  uploadArquivoAdminService,
};