const adminService = require('./admin.service');

const listAllPedidosController = async (req, res) => {
  try {
    const result = await adminService.listAllPedidosService(req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao listar pedidos.' });
  }
};

const getPedidoDetailsAdminController = async (req, res) => {
  try {
    const pedido = await adminService.getPedidoDetailsAdminService(req.params.id);
    res.status(200).json(pedido);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const updatePedidoAdminController = async (req, res) => {
  try {
    const updatedPedido = await adminService.updatePedidoAdminService(req.params.id, req.body);
    res.status(200).json({ message: 'Pedido atualizado com sucesso!', pedido: updatedPedido });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const uploadArquivoAdminController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo foi enviado.' });
    }
    const result = await adminService.uploadArquivoAdminService(req.params.id, req.file);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

module.exports = {
  listAllPedidosController,
  getPedidoDetailsAdminController,
  updatePedidoAdminController,
  uploadArquivoAdminController,
};