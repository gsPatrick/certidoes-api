// arquivo: src/services/geminiCorrectionService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiCorrectionService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Corrige um lote de cartórios usando Gemini.
   * @param {Array} cartorios - Array de cartórios para corrigir
   * @returns {Promise<Array>} Array de cartórios corrigidos
   */
  async correctCartoriosBatch(cartorios) {
    console.log(`🤖 Enviando ${cartorios.length} cartórios para correção pela IA...`);
    
    try {
      // Prepara os dados para enviar à IA
      const dadosParaCorrecao = cartorios.map(cartorio => ({
        id: cartorio.CNS,
        nome: cartorio.DENOMINACAO_SERVENTIA,
        municipio: cartorio.MUNICIPIO,
        uf: cartorio.UF,
        titular: cartorio.NOME_TITULAR || ''
      }));

      const prompt = this.buildCorrectionPrompt(dadosParaCorrecao);
      
      console.log('📤 Enviando para Gemini...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const correctedText = response.text();
      
      console.log('📥 Resposta recebida do Gemini');
      
      // Usa o novo parser inteligente que tenta reparar o JSON
      const correctedData = this.parseAndRepairCorrectedResponse(correctedText);
      
      // Aplica as correções nos cartórios originais
      const cartoriosCorrigidos = this.applyCorrectionToCartorios(cartorios, correctedData);
      
      console.log(`✅ ${cartoriosCorrigidos.length} cartórios processados pela IA (com possível reparo).`);
      
      return cartoriosCorrigidos;
      
    } catch (error) {
      // O erro será capturado pela função de retry
      console.error('❌ Erro durante a chamada para a IA:', error.message);
      // Relança o erro para que a função `correctCartoriosBatchWithRetry` possa lidar com ele
      throw error;
    }
  }

  /**
   * Constrói um prompt mais robusto para o Gemini.
   */
  buildCorrectionPrompt(dados) {
    return `
Você é um especialista em dados de cartórios brasileiros. Sua tarefa é analisar e corrigir os dados abaixo.

**REGRAS DE CORREÇÃO:**
1.  **Nomes de Cartórios**: Corrija "TTULOS" para "TÍTULOS", "IMVEIS" para "IMÓVEIS", etc.
2.  **Nomes de Cidades**: Corrija "BRASLIA" para "BRASÍLIA", "BRAZLNDIA" para "BRAZLÂNDIA", etc.
3.  **Caracteres Corrompidos**: Substitua '�' por caracteres corretos.

**REGRAS DE FORMATO (MUITO IMPORTANTE):**
- Retorne APENAS um JSON válido. Não adicione explicações ou markdown.
- Mantenha a estrutura: [{"id": "CNS", "nome": "corrigido", "municipio": "corrigido", "titular": "corrigido"}]
- **CRÍTICO: Sua resposta DEVE ser um JSON completo e válido. NUNCA retorne um JSON truncado ou incompleto. Sempre finalize o array com ']' e os objetos com '}'.**

**DADOS PARA CORRIGIR:**
${JSON.stringify(dados, null, 2)}

**RESPOSTA (apenas JSON completo):`;
  }

  /**
   * PARSER INTELIGENTE: Faz parse da resposta e tenta repará-la se estiver truncada.
   */
  parseAndRepairCorrectedResponse(responseText) {
    const cleanText = responseText
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
      .trim();

    try {
      // 1. Tenta fazer o parse da forma normal
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.warn('⚠️ Falha no parse inicial do JSON. Tentando reparar a resposta...');
      
      try {
        // 2. Se falhar, tenta encontrar o último objeto JSON completo
        const lastValidObjectEnd = cleanText.lastIndexOf('}');
        
        if (lastValidObjectEnd === -1) {
          throw new Error('Não foi possível encontrar nenhum objeto JSON válido na resposta.');
        }

        let repairedText = cleanText.substring(0, lastValidObjectEnd + 1);

        // Garante que começa com um array
        if (!repairedText.startsWith('[')) {
            repairedText = '[' + repairedText;
        }

        repairedText += '\n]';

        console.log('🔧 Tentando fazer o parse do JSON reparado...');
        const parsed = JSON.parse(repairedText);

        if (!Array.isArray(parsed)) {
            throw new Error('Resposta reparada não resultou em um array.');
        }

        console.log(`✅ Reparo bem-sucedido! ${parsed.length} objetos recuperados.`);
        return parsed;

      } catch (repairError) {
        console.error('❌ Erro final ao tentar reparar e fazer o parse da resposta do Gemini:', repairError.message);
        console.log('📄 Resposta original que causou o erro:', responseText);
        throw new Error('Falha no parse da resposta da IA, mesmo após tentativa de reparo.');
      }
    }
  }

  /**
   * Aplica as correções nos dados originais.
   */
  applyCorrectionToCartorios(cartoriosOriginais, dadosCorrigidos) {
    const correctedMap = new Map();
    
    dadosCorrigidos.forEach(corrigido => {
      if (corrigido && corrigido.id) { // Checagem de segurança
        correctedMap.set(corrigido.id, corrigido);
      }
    });
    
    return cartoriosOriginais.map(cartorio => {
      const correcao = correctedMap.get(cartorio.CNS);
      
      if (correcao) {
        return {
          ...cartorio,
          DENOMINACAO_SERVENTIA: correcao.nome || cartorio.DENOMINACAO_SERVENTIA,
          MUNICIPIO: correcao.municipio || cartorio.MUNICIPIO,
          NOME_TITULAR: correcao.titular || cartorio.NOME_TITULAR
        };
      }
      
      return cartorio;
    });
  }

  /**
   * Wrapper para correctCartoriosBatch que adiciona lógica de retry com exponential backoff.
   * Esta função é chamada pelo cartorio.service.js.
   */
  async correctCartoriosBatchWithRetry(batch, maxRetries = 3, initialDelay = 1000) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // Chama a função principal que agora tem o parser inteligente
        const correctedBatch = await this.correctCartoriosBatch(batch);
        return correctedBatch;
      } catch (error) {
        attempt++;
        // Tenta novamente apenas em erros de rede (503) ou outros erros recuperáveis
        if (error.message && error.message.includes('[503 Service Unavailable]')) {
          if (attempt >= maxRetries) {
            console.error(`❌ Erro 503: Falha final no lote após ${maxRetries} tentativas.`);
            throw error;
          }
          const delay = initialDelay * Math.pow(2, attempt - 1);
          console.warn(`⚠️ Erro 503 (tentativa ${attempt}/${maxRetries}). Tentando novamente em ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Para erros de parse ou outros erros críticos, a falha é imediata.
          console.error(`❌ Erro não recuperável no lote (tentativa ${attempt}/${maxRetries}): ${error.message}`);
          throw error; // Desiste e lança o erro
        }
      }
    }
    // Retorna o lote original se todas as tentativas falharem
    console.warn('⚠️ Retornando lote original após falha em todas as tentativas de correção.');
    return batch;
  }
}

module.exports = GeminiCorrectionService;