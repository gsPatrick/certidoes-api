// Salve em: src/models/Pagamento.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pagamento extends Model {
    static associate(models) {
      Pagamento.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
    }
  }
  Pagamento.init({
    gatewayId: DataTypes.STRING,
    status: DataTypes.ENUM('pendente', 'aprovado', 'recusado', 'estornado'),
    metodo: { // <-- Envolvendo em um objeto para mais controle
      type: DataTypes.ENUM(
        'pix',
        'boleto',
        'cartao_credito',
        'mercadopago' // --- ADICIONE ESTA OPÇÃO ---
      ),
      allowNull: true // Permite ser nulo se o método não for identificado
    },
    valor: DataTypes.DECIMAL(10, 2)
  }, {
    sequelize,
    modelName: 'Pagamento',
  });
  return Pagamento;
};