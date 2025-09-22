'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Cartorio extends Model {
    static associate(models) {
      Cartorio.hasMany(models.Pedido, { foreignKey: 'cartorioId', as: 'pedidos' });
    }
  }
  Cartorio.init({
    cns: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    nome: {
      type: DataTypes.TEXT, // <-- ALTERADO DE STRING PARA TEXT
      allowNull: false
    },
    estado: DataTypes.STRING(2),
    cidade: DataTypes.STRING,
    atribuicoes: {
      type: DataTypes.TEXT, // <-- ALTERADO DE STRING PARA TEXT
    },
    status: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Cartorio',
  });
  return Cartorio;
};