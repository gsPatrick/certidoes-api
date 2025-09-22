'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pagamento extends Model {
    static associate(models) {
      Pagamento.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
    }
  }
  Pagamento.init({
    gatewayId: DataTypes.STRING, // ID da transação no gateway (ex: Mercado Pago)
    status: DataTypes.ENUM('pendente', 'aprovado', 'recusado', 'estornado'),
    metodo: DataTypes.ENUM('pix', 'boleto', 'cartao_credito'),
    valor: DataTypes.DECIMAL(10, 2)
  }, {
    sequelize,
    modelName: 'Pagamento',
  });
  return Pagamento;
};