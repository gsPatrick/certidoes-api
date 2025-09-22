'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Pedido, { foreignKey: 'userId', as: 'pedidos' });
    }
  }
  User.init({
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sobrenome: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('cliente', 'admin'),
      defaultValue: 'cliente',
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};