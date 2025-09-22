// Salve em: src/features/admin/admin.service.js

const { Pedido, User, Cartorio, Pagamento, ArquivoPedido, ItemPedido } = require('../../models');
const { Op } = require('sequelize');
const emailService = require('../../services/email.service'); // Importa o novo serviço de e-mail
const mercadopago = require('../../config/mercadoPago'); // Importa o Mercado Pago para estornos

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
      { model: ItemPedido, as: 'itens' },
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
 * Atualiza os dados de um pedido e notifica o cliente por e-mail.
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
  if (codigoRastreio !== undefined) pedido.codigoRastreio = codigoRastreio;
  if (observacoesAdmin !== undefined) pedido.observacoesAdmin = observacoesAdmin;

  await pedido.save();
  
  // Notifica o cliente sobre a atualização
  const pedidoAtualizado = await Pedido.findByPk(pedidoId, { 
    include: [{ model: User, as: 'cliente' }] 
  });
  if (pedidoAtualizado) {
    await emailService.enviarAtualizacaoStatus(pedidoAtualizado);
  }

  return pedido;
};

/**
 * Associa um arquivo enviado a um pedido e notifica o cliente.
 */
const uploadArquivoAdminService = async (pedidoId, fileData) => {
  const { originalname, filename } = fileData;

  const pedido = await Pedido.findByPk(pedidoId, {
    include: [{ model: User, as: 'cliente' }] // Já inclui o cliente para o e-mail
  });
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
  
  if (pedido.status !== 'Concluído') {
      pedido.status = 'Concluído';
      await pedido.save();
  }
  
  // Notifica o cliente que o documento está disponível
  await emailService.enviarDocumentoDisponivel(pedido, novoArquivo);

  return {
    message: 'Arquivo enviado com sucesso e associado ao pedido.',
    arquivo: novoArquivo,
    pedidoStatus: pedido.status,
  };
};

/**
 * Realiza o estorno de um pagamento no Mercado Pago e atualiza o status local.
 */
const estornarPedidoService = async (pedidoId) => {
    const pedido = await Pedido.findByPk(pedidoId, {
        include: [{ model: Pagamento, as: 'pagamento' }]
    });

    if (!pedido) {
        const error = new Error('Pedido não encontrado.');
        error.statusCode = 404;
        throw error;
    }

    const pagamento = pedido.pagamento;
    if (!pagamento || !pagamento.gatewayId) {
        const error = new Error('Pagamento não encontrado ou não processado pelo gateway.');
        error.statusCode = 400;
        throw error;
    }
    
    if (pagamento.status !== 'aprovado') {
        const error = new Error(`Não é possível estornar um pagamento com status '${pagamento.status}'.`);
        error.statusCode = 400;
        throw error;
    }

    try {
        // Tenta estornar no Mercado Pago
        await mercadopago.refund.create({ payment_id: pagamento.gatewayId });

        // Atualiza o status local se o estorno no gateway for bem-sucedido
        pagamento.status = 'estornado';
        pedido.status = 'Cancelado'; // Altera o status do pedido para 'Cancelado'

        await pagamento.save();
        await pedido.save();

        // TODO: Enviar e-mail de notificação de estorno ao cliente, se desejado.
        
        return { message: 'Pedido estornado com sucesso!' };

    } catch (error) {
        console.error('Erro ao estornar pagamento no Mercado Pago:', error);
        const serviceError = new Error('Falha ao processar o estorno no gateway de pagamento. Verifique o painel do Mercado Pago.');
        serviceError.statusCode = 500;
        throw serviceError;
    }
};

module.exports = {
  listAllPedidosService,
  getPedidoDetailsAdminService,
  updatePedidoAdminService,
  uploadArquivoAdminService,
  estornarPedidoService,
};