// Salve em: src/features/pedido/pedido.controller.js
const pedidoService = require('./pedido.service');

const createPedidoController = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const pedido = await pedidoService.createPedidoService(req.body, userId);
    res.status(201).json({ 
      message: 'Pedido criado com sucesso!',
      pedido: {
        id: pedido.id,
        status: pedido.status,
        valorTotal: pedido.valorTotal,
      } 
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Erro interno ao criar o pedido.' });
  }
};

const listUserPedidosController = async (req, res) => {
    try {
        const userId = req.user.id; // Middleware 'protect' garante que req.user exista
        const pedidos = await pedidoService.listUserPedidosService(userId);
        res.status(200).json(pedidos);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao buscar pedidos.' });
    }
};

const getPedidoByIdController = async (req, res) => {
    try {
        const userId = req.user.id;
        const pedidoId = req.params.id;
        const pedido = await pedidoService.getPedidoByIdService(pedidoId, userId);
        res.status(200).json(pedido);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao buscar detalhes do pedido.' });
    }
};

const downloadArquivoController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { pedidoId, arquivoId } = req.params;
        const { filePath, nomeOriginal } = await pedidoService.downloadArquivoService(pedidoId, arquivoId, userId);
        
        // Envia o arquivo para o cliente
        res.download(filePath, nomeOriginal, (err) => {
            if (err) {
                console.error("Erro ao enviar arquivo para download:", err);
                // Evita enviar outra resposta se o download já iniciou com erro
                if (!res.headersSent) {
                    res.status(500).send('Não foi possível fazer o download do arquivo.');
                }
            }
        });

    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message || 'Erro no download do arquivo.' });
    }
};

module.exports = {
  createPedidoController,
  listUserPedidosController,
  getPedidoByIdController,
  downloadArquivoController
};