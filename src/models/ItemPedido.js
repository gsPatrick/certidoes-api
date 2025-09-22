// Salve em: src/models/ItemPedido.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ItemPedido extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define a associação: Um ItemPedido pertence a um Pedido
      ItemPedido.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
    }
  }
  ItemPedido.init({
    nomeProduto: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slugProduto: {
        type: DataTypes.STRING,
        allowNull: false
    },
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    dadosFormulario: {
      type: DataTypes.JSON, // Armazena todos os campos do formulário (Estado, Cidade, Nomes, etc.)
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ItemPedido',
  });
  return ItemPedido;
};