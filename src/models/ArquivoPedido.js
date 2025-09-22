'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ArquivoPedido extends Model {
    static associate(models) {
      ArquivoPedido.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
    }
  }
  ArquivoPedido.init({
    nomeOriginal: DataTypes.STRING,
    path: DataTypes.STRING, // Caminho onde o arquivo está salvo
    tipo: DataTypes.ENUM('certidao', 'comprovante', 'outro')
  }, {
    sequelize,
    modelName: 'ArquivoPedido',
  });
  return ArquivoPedido;
};