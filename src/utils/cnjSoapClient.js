// arquivo: src/utils/cnjSoapClient.js

const soap = require('soap');
const { XMLParser } = require('fast-xml-parser');

const wsdlUrl = 'https://www.cnj.jus.br/corregedoria/ws/extraJudicial.php?wsdl';

// Função para remover acentos e caracteres especiais
const removeAccents = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    // Remove caracteres de controle e substitutos Unicode problemáticos
    .replace(/[\uFFFD\uFEFF]/g, '') // Remove replacement characters
    .replace(/[áàãâäÁÀÃÂÄ]/g, 'A')
    .replace(/[éèêëÉÈÊË]/g, 'E') 
    .replace(/[íìîïÍÌÎÏ]/g, 'I')
    .replace(/[óòõôöÓÒÕÔÖ]/g, 'O')
    .replace(/[úùûüÚÙÛÜ]/g, 'U')
    .replace(/[çÇ]/g, 'C')
    .replace(/[ñÑ]/g, 'N')
    .replace(/[ýÿÝŸ]/g, 'Y')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos restantes
    .replace(/[^\x00-\x7F]/g, '') // Remove qualquer caractere não-ASCII restante
    .trim()
    .toUpperCase(); // Converte para maiúsculo para padronizar
};

// Função para normalizar objeto recursivamente
const normalizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = normalizeObject(value);
    }
    return normalized;
  }
  
  if (typeof obj === 'string') {
    return removeAccents(obj);
  }
  
  return obj;
};

// Função de log para acompanhar o processo
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

/**
 * Parse XML string to extract serventias data
 * @param {string} xmlString - XML string from CNJ response
 * @returns {Array} Array of serventia objects
 */
const parseXmlString = (xmlString) => {
  try {
    // Remove BOM se presente
    const cleanXml = xmlString.replace(/^\uFEFF/, '');
    
    // Verifica se há erro na resposta
    if (cleanXml.includes('<ERRO>')) {
      const errorMatch = cleanXml.match(/<MSG>(.*?)<\/MSG>/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Erro desconhecido';
      log(`Erro do CNJ: ${errorMsg}`);
      return [];
    }
    
    // Parse manual básico para extrair ROWs
    const rows = [];
    const rowMatches = cleanXml.match(/<ROW>(.*?)<\/ROW>/gs);
    
    if (!rowMatches) {
      log('Nenhuma ROW encontrada no XML');
      return [];
    }
    
    log(`Encontradas ${rowMatches.length} ROWs no XML`);
    
    rowMatches.forEach((rowXml, index) => {
      try {
        const row = {};
        
        // Extrai campos principais
        const fields = [
          'SEQ', 'CNS', 'CPNJ', 'DENOMINACAO_SERVENTIA', 'STATUS_SERVENTIA',
          'DT_INSTALACAO', 'DAT_INCLUSAO', 'DAT_ALTERACAO', 'UF', 'MUNICIPIO',
          'COD_IBGE', 'BAIRRO', 'DISTRITO', 'SUB_DISTRITO', 'ENDERECO',
          'COMPLEMENTO', 'CEP', 'TELEFONE1', 'FAX', 'EMAIL', 'HOME_PAGE',
          'DT_INATIVACAO', 'NOME_TITULAR', 'CPF_TITULAR', 'DT_INGRESSO_TITULAR',
          'DT_NOMEACAO_TITULAR', 'TIPO_TITULAR', 'FORMA_INGRESSO_TITULAR',
          'DT_ASSUNCAO_SERVENTIA_TITULAR', 'DT_COLACAO_GRAU_TITULAR',
          'BACHARELADO_TITULAR', 'NOME_SUBSTITUTO', 'CPF_SUBSTITUTO',
          'EMAIL_SUBSTITUTO', 'DAT_INCLUSAO_SUBSTITUTO', 'DAT_ALTERACAO_SUBSTITUTO'
        ];
        
        fields.forEach(field => {
          const regex = new RegExp(`<${field}>(.*?)<\/${field}>`, 's');
          const match = rowXml.match(regex);
          let value = match ? match[1].trim() : '';
          row[field] = value;
        });
        
        // Parse ATRIBUICAO (pode ter múltiplos ID_ATRIBUICAO)
        const atribuicaoMatch = rowXml.match(/<ATRIBUICAO>(.*?)<\/ATRIBUICAO>/s);
        if (atribuicaoMatch) {
          const atribuicaoXml = atribuicaoMatch[1];
          const idAtribuicoes = atribuicaoXml.match(/<ID_ATRIBUICAO>(\d+)<\/ID_ATRIBUICAO>/g);
          
          if (idAtribuicoes) {
            row.ATRIBUICOES = idAtribuicoes.map(match => {
              const idMatch = match.match(/<ID_ATRIBUICAO>(\d+)<\/ID_ATRIBUICAO>/);
              return idMatch ? parseInt(idMatch[1]) : null;
            }).filter(id => id !== null);
          } else {
            row.ATRIBUICOES = [];
          }
        } else {
          row.ATRIBUICOES = [];
        }
        
        rows.push(row);
        
      } catch (parseError) {
        log(`Erro ao fazer parse da ROW ${index + 1}: ${parseError.message}`);
      }
    });
    
    return rows;
    
  } catch (error) {
    log(`Erro no parse do XML: ${error.message}`);
    return [];
  }
};

/**
 * Busca serventias ativas do CNJ, tentando múltiplos períodos para contornar instabilidades.
 * @returns {Promise<Array>} Uma promessa que resolve para um array de objetos de serventia.
 */
const fetchActiveServentias = async () => {
  log('=== INICIANDO BUSCA DE SERVENTIAS (ESTRATÉGIA DE TENTATIVAS) ===');
  
  try {
    const client = await soap.createClientAsync(wsdlUrl, { 
      timeout: 45000,
      disableCache: true,
      endpoint: wsdlUrl.replace('?wsdl', '')
    });
    log('Cliente SOAP criado com sucesso.');

    // Prepara uma lista de períodos para tentar, começando do mais recente.
    const periodosParaTentar = [];
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;

    // Adiciona período atual e anteriores
    for (let a = anoAtual; a >= anoAtual - 5; a--) {
      const maxMes = (a === anoAtual) ? mesAtual : 12;
      for (let m = maxMes; m >= 1; m--) {
        periodosParaTentar.push({ mes: m, ano: a });
        if (periodosParaTentar.length >= 60) break; // Limita a 60 tentativas (5 anos, 12 meses * 5 anos = 60 tentativas) 
      }
      if (periodosParaTentar.length >= 60) break;
    }
    
    log(`Tentando até ${periodosParaTentar.length} períodos diferentes...`);
    
    // Itera sobre os períodos até encontrar um que retorne dados.
    for (const periodo of periodosParaTentar) {
      log(`Buscando serventias para ${periodo.mes.toString().padStart(2, '0')}/${periodo.ano}`);
      try {
        const [result] = await client.servicoAsync({
          mes: periodo.mes.toString(),
          ano: periodo.ano.toString()
        });
        
        // O CNJ às vezes retorna um XML dentro de uma string
        if (result && result.serventias && typeof result.serventias === 'string' && result.serventias.includes('<ROW>')) {
          log('Resposta veio como string XML, fazendo parse manual...');
          const serventias = parseXmlString(result.serventias);
          
          if (serventias.length > 0) {
              log(`SUCESSO! ${serventias.length} serventias encontradas para ${periodo.mes}/${periodo.ano}`);
              return serventias;
          }
        }
        // Outras vezes, a biblioteca soap consegue fazer o parse
        else if (result && result.serventias && result.serventias.serventia) {
          const serventias = Array.isArray(result.serventias.serventia) 
            ? result.serventias.serventia 
            : [result.serventias.serventia];
          log(`SUCESSO! ${serventias.length} serventias encontradas para ${periodo.mes}/${periodo.ano}`);
          return serventias;
        }

        log(`Período ${periodo.mes}/${periodo.ano} não retornou dados válidos.`);

      } catch (periodError) {
        log(`Erro na consulta para ${periodo.mes}/${periodo.ano}: ${periodError.message}. Tentando próximo período.`);
      }
    }
    
    log('NENHUMA serventia encontrada com o método "servico". A API do CNJ pode estar instável.');
    return [];

  } catch (error) {
    log(`ERRO CRÍTICO ao inicializar o cliente SOAP ou na comunicação com o CNJ: ${error.message}`);
    throw new Error(`Falha na comunicação com o serviço do CNJ: ${error.message}`);
  }
};

/**
 * Função que busca serventias e aplica limpeza de dados
 * Esta é a função que deve ser usada pelo sistema
 * @returns {Promise<Array>} Serventias com dados limpos
 */
const fetchCleanServentias = async () => {
  log('=== BUSCANDO E LIMPANDO DADOS DO XML CNJ ===');
  
  try {
    // 1. Busca os dados normalmente
    const rawServentias = await fetchActiveServentias();
    
    if (rawServentias.length === 0) {
      log('Nenhuma serventia encontrada');
      return [];
    }
    
    log(`Processando ${rawServentias.length} serventias do XML...`);
    
    // 2. Aplica limpeza nos dados que vêm do XML
    const cleanedServentias = rawServentias.map((serventia, index) => {
      const cleaned = { ...serventia };
      
      // Lista apenas dos campos de texto que precisam de limpeza
      const textFields = [
        'DENOMINACAO_SERVENTIA', 'UF', 'MUNICIPIO', 'BAIRRO', 
        'DISTRITO', 'SUB_DISTRITO', 'ENDERECO', 'COMPLEMENTO',
        'NOME_TITULAR', 'NOME_SUBSTITUTO', 'EMAIL', 'HOME_PAGE',
        'TIPO_TITULAR', 'FORMA_INGRESSO_TITULAR', 'BACHARELADO_TITULAR'
      ];
      
      // Aplica limpeza apenas nos campos de texto
      textFields.forEach(field => {
        if (cleaned[field] && typeof cleaned[field] === 'string') {
          // Remove caracteres corrompidos comuns
          let cleanValue = cleaned[field];
          cleanValue = cleanValue.replace(/�/g, '');
          cleanValue = cleanValue.replace(/\uFFFD/g, '');
          
          // Aplica remoção de acentos se desejado
          // cleanValue = removeAccents(cleanValue);
          
          cleaned[field] = cleanValue.trim();
        }
      });
      
      // Log de progresso a cada 100 registros
      if ((index + 1) % 100 === 0) {
        log(`Processados ${index + 1}/${rawServentias.length} registros...`);
      }
      
      return cleaned;
    });
    
    log(`✅ Limpeza concluída! ${cleanedServentias.length} serventias processadas`);
    
    // Mostra exemplo dos dados limpos
    if (cleanedServentias.length > 0) {
      const exemplo = cleanedServentias[0];
      log('📝 Exemplo de dados encontrados:');
      log(`   Denominação: ${exemplo.DENOMINACAO_SERVENTIA}`);
      log(`   Município: ${exemplo.MUNICIPIO}`);
      log(`   UF: ${exemplo.UF}`);
      log(`   Status: ${exemplo.STATUS_SERVENTIA}`);
      log(`   CNS: ${exemplo.CNS}`);
    }
    
    return cleanedServentias;
    
  } catch (error) {
    log(`❌ ERRO na busca e limpeza do XML: ${error.message}`);
    throw error;
  }
};

module.exports = {
  fetchActiveServentias, 
  fetchCleanServentias,  // ✅ Função principal para usar no sistema
  removeAccents,
  normalizeObject
};
