const cartorioService = require('./cartorio.service');

// Mantido para uso futuro pelo Admin
const syncCartoriosController = async (req, res) => {
  try {
    const result = await cartorioService.syncCartoriosService();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Falha ao sincronizar cartórios.' });
  }
};

// ALTERADO: Agora chama o novo serviço de busca em tempo real
const getCartoriosController = async (req, res) => {
  try {
    // req.query conterá { estado: 'SP', cidade: 'CAMPINAS', atribuicaoId: '4' }
    const cartorios = await cartorioService.getCartoriosService(req.query);
    res.status(200).json(cartorios);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao buscar cartórios.' });
  }
};
// ALTERADO: Agora chama o novo serviço de busca de estados
const getEstadosController = async (req, res) => {
  try {
    const estados = await cartorioService.getEstadosService();
    res.status(200).json(estados);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Erro ao buscar estados.' });
  }
};

// ALTERADO: Agora chama o novo serviço de busca de cidades
const getCidadesController = async (req, res) => {
  try {
    const { estado } = req.params;
    const cidades = await cartorioService.getCidadesPorUFService(estado);
    res.status(200).json(cidades);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Erro ao buscar cidades.' });
  }
};

// REMOVIDO: O controller getCartoriosPorCidadeController foi removido por ser redundante.

module.exports = {
  syncCartoriosController,
  getCartoriosController,
  getEstadosController,
  getCidadesController,
};