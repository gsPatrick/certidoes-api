// Salve em: src/services/frenet.service.js
const axios = require('axios');

// URL base da API da Frenet
const FRENIT_API_URL = 'https://api.frenet.com.br/shipping/quote';

// Define um pacote padrão para envio de documentos, seguindo a documentação
const DEFAULT_PACKAGE = {
  Weight: "0.3",       // Peso em kg, como string
  Length: 35,          // Comprimento em cm
  Height: 2,           // Altura em cm
  Width: 25,           // Largura em cm
};

const frenetService = {
  /**
   * Calcula as opções de frete para um CEP de destino usando uma chamada HTTP direta.
   * @param {string} cepDestino - O CEP para onde o documento será enviado.
   * @param {number} valorTotalProdutos - O valor total dos produtos para o seguro.
   * @returns {Promise<Array>} - Uma lista de opções de frete.
   */
  async calcularFrete(cepDestino, valorTotalProdutos) {
    try {
      const cepOrigemLimpo = process.env.FRENET_CEP_ORIGEM.replace(/\D/g, '');
      const cepDestinoLimpo = cepDestino.replace(/\D/g, '');

      if (cepDestinoLimpo.length !== 8) {
        throw new Error('CEP de destino inválido.');
      }

      // Monta o corpo (payload) da requisição exatamente como na documentação
      const requestBody = {
        SellerCEP: cepOrigemLimpo,
        RecipientCEP: cepDestinoLimpo,
        ShipmentInvoiceValue: valorTotalProdutos,
        ShippingItemArray: [
          {
            ...DEFAULT_PACKAGE,
            Quantity: 1,
            SKU: 'CERTIDAO', // Um identificador para o seu produto
          },
        ],
        RecipientCountry: 'BR',
      };

      // Configura os cabeçalhos (headers) da requisição
      const requestHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': process.env.FRENET_TOKEN,
      };

      // Faz a chamada POST para a API da Frenet usando axios
      const response = await axios.post(FRENIT_API_URL, requestBody, { headers: requestHeaders });
      
      const shippingResult = response.data;
      
      // Processa a resposta
      if (shippingResult && shippingResult.ShippingSevicesArray) {
        return shippingResult.ShippingSevicesArray
          // Filtra serviços que retornaram erro (ex: dimensões excedidas para Mini Envios)
          .filter(service => service.Error === false)
          // Mapeia para um formato mais simples para o frontend
          .map(service => ({
            servico: service.ServiceDescription,
            preco: parseFloat(service.ShippingPrice),
            prazo: parseInt(service.DeliveryTime, 10),
          }));
      }

      // Retorna vazio se a API não retornar serviços
      return [];

    } catch (error) {
      // Captura erros de rede ou da API da Frenet
      console.error('Erro ao calcular frete com a Frenet:', error.response?.data || error.message);
      // Retorna um array vazio para não quebrar a aplicação no frontend
      return [];
    }
  },
};

module.exports = frenetService;