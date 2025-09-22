// Salve em: src/models/Pedido.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pedido extends Model {
    static associate(models) {
      // Associação com o Usuário (cliente) que fez o pedido
      Pedido.belongsTo(models.User, { foreignKey: 'userId', as: 'cliente' });
      
      // Associação com Cartorio (Reativada)
      // Mesmo que um pedido tenha múltiplos cartórios nos itens,
      // esta pode ser uma referência principal ou ser deixada nula.
      // É importante mantê-la para consistência com o resto do código.
      Pedido.belongsTo(models.Cartorio, { foreignKey: 'cartorioId', as: 'cartorio' }); 
      
      // Associação com a tabela de Pagamentos
      Pedido.hasOne(models.Pagamento, { foreignKey: 'pedidoId', as: 'pagamento' });
      
      // Associação com a tabela de Arquivos (certidões, comprovantes, etc.)
      Pedido.hasMany(models.ArquivoPedido, { foreignKey: 'pedidoId', as: 'arquivos' });
      
      // Associação com os Itens do Pedido (os produtos/serviços comprados)
      Pedido.hasMany(models.ItemPedido, { foreignKey: 'pedidoId', as: 'itens' });
    }
  }
  Pedido.init({
    // Campos que foram removidos da estrutura antiga (redundantes com ItemPedido)
    // foram mantidos fora para clareza.
    protocolo: {
      type: DataTypes.STRING,
      unique: true
    },
    status: {
      type: DataTypes.ENUM(
        'Aguardando Pagamento',
        'Processando',
        'Busca em Andamento',
        'Concluído',
        'Cancelado'
      ),
      defaultValue: 'Aguardando Pagamento'
    },
    dadosCliente: { // Campo para guardar os dados de cobrança (nome, cpf, endereço, etc.)
        type: DataTypes.JSON,
        allowNull: false
    },
    valorTotal: DataTypes.DECIMAL(10, 2),
    codigoRastreio: DataTypes.STRING,
    observacoesAdmin: DataTypes.TEXT,

    // CAMPO ADICIONADO AQUI PARA CORRIGIR A INCONSISTÊNCIA
    cartorioId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Permitir nulo, pois o cartório está nos itens
      references: {
        model: 'Cartorios', // Nome da tabela no banco de dados
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    }
  }, {
    sequelize,
    modelName: 'Pedido',
  });
  return Pedido;
};