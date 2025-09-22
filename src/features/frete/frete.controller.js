// Salve em: src/features/frete/frete.controller.js
const frenetService = require('../../services/frenet.service');

const calcularFreteController = async (req, res, next) => {
  try {
    const { cepDestino, valorTotal } = req.body;

    if (!cepDestino || !valorTotal) {
      return res.status(400).json({ message: 'CEP de destino e valor total são obrigatórios.' });
    }

    const opcoesFrete = await frenetService.calcularFrete(cepDestino, valorTotal);
    
    res.status(200).json(opcoesFrete);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calcularFreteController,
};