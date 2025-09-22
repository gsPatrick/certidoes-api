// Salve em: src/services/frenet.service.js
const frenet = require('frenet-api');

// Configuração inicial da instância da Frenet
const client = frenet({
  token: process.env.FRENET_TOKEN,
});

// Define um pacote padrão para envio de documentos
const DEFAULT_PACKAGE = {
  weight: 0.3,       // Peso padrão de 300g
  length: 35,        // Comprimento em cm
  height: 2,         // Altura em cm
  width: 25,         // Largura em cm
  diameter: 0,
};

const frenetService = {
  /**
   * Calcula as opções de frete para um CEP de destino.
   * @param {string} cepDestino - O CEP para onde o documento será enviado.
   * @param {number} valorTotalProdutos - O valor total dos produtos para o seguro.
   * @returns {Promise<Array>} - Uma lista de opções de frete (ex: PAC, SEDEX).
   */
  async calcularFrete(cepDestino, valorTotalProdutos) {
    try {
      // Limpa o CEP, deixando apenas números
      const cepLimpo = cepDestino.replace(/\D/g, '');
      if (cepLimpo.length !== 8) {
        throw new Error('CEP de destino inválido.');
      }

      const shippingResult = await client.calculateShipping({
        sellerZipCode: process.env.FRENET_CEP_ORIGEM.replace(/\D/g, ''),
        recipientZipCode: cepLimpo,
        items: [
          {
            ...DEFAULT_PACKAGE,
            quantity: 1,
            sku: 'CERTIDAO',
            invoiceValue: valorTotalProdutos, // Valor para seguro
          },
        ],
      });
      
      // Filtra e formata a resposta para ser mais amigável
      if (shippingResult && shippingResult.ShippingSevicesArray) {
        return shippingResult.ShippingSevicesArray.filter(
          (service) => !service.Error
        ).map((service) => ({
          servico: service.ServiceDescription,
          preco: parseFloat(service.ShippingPrice),
          prazo: parseInt(service.DeliveryTime, 10),
        }));
      }

      return [];
    } catch (error) {
      console.error('Erro ao calcular frete com a Frenet:', error.message);
      // Retorna um array vazio em caso de erro para não quebrar o checkout
      return [];
    }
  },
};

module.exports = frenetService;