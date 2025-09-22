// ATENÇÃO: Adicione o 'axios' para fazer chamadas de API
const axios = require('axios'); 
const { sequelize } = require("sequelize"); 
const { Cartorio } = require("../../models");
// As duas linhas abaixo são para a sincronização, podem ser mantidas para uso futuro
const { fetchCleanServentias } = require("../../utils/cnjSoapClient");
const GeminiCorrectionService = require("../../utils/geminiCorrectionService");

const geminiService = new GeminiCorrectionService();

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[CartorioService] ${timestamp}: ${message}`);
};

// Função para formatar o nome do cartório, igual à do WordPress
const formatarNomeCartorio = (nome) => {
    if (typeof nome !== 'string') return '';
    let nomeFormatado = nome.trim().toLowerCase();
    
    // Converte para Title Case, mas mantém preposições em minúsculo
    return nomeFormatado.replace(/\b\w/g, (char, index) => {
        const palavra = nomeFormatado.slice(index).split(' ')[0];
        const palavrasPequenas = ['de', 'e', 'das', 'dos', 'da', 'do', 'a', 'o', 'em', 'para', 'com'];
        if (index > 0 && palavrasPequenas.includes(palavra)) {
            return char.toLowerCase();
        }
        return char.toUpperCase();
    });
};

/**
 * NOVO: Mapeamento de IDs de atribuição para palavras-chave nos nomes.
 * Isso ajuda a capturar cartórios genéricos que não listam IDs, conforme sua regra.
 */
const atribuicaoKeywords = {
    '1': ['NOTAS', 'NOTARIAL', 'TABELIONATO'], // Notas
    '2': ['PROTESTO'], // Protesto de Títulos
    '3': ['REGISTRO CIVIL', 'PESSOAS NATURAIS'], // Registro Civil
    '4': ['REGISTRO DE IMOVEIS', 'IMÓVEIS', 'IMOVEL'], // Registro de Imóveis
};

// --- FUNÇÃO DE SINCRONIZAÇÃO (Mantida para uso administrativo, mas não para as buscas do site) ---
const syncCartoriosService = async () => {
  // Este código complexo de sincronização permanece o mesmo para uso futuro pelo admin...
  log("Iniciando processo completo de sincronização de cartórios...");
  try {
    log("Passo 1/4: Buscando dados do webservice do CNJ...");
    const serventiasFromCnj = await fetchCleanServentias();
    if (!serventiasFromCnj || serventiasFromCnj.length === 0) {
      log("Nenhuma serventia retornada do CNJ. Sincronização abortada.");
      return { message: "Nenhuma serventia encontrada no serviço do CNJ.", total: 0 };
    }
    log(`Encontrados ${serventiasFromCnj.length} registros no CNJ.`);
    log("Passo 2/4: Corrigindo dados com IA (Gemini)...");
    const BATCH_SIZE = 50;
    const CONCURRENCY_LIMIT = 1;
    const DELAY_BETWEEN_BATCH_GROUPS_MS = 5000;
    let correctedServentias = [];
    const batches = [];
    for (let i = 0; i < serventiasFromCnj.length; i += BATCH_SIZE) {
      batches.push(serventiasFromCnj.slice(i, i + BATCH_SIZE));
    }
    log(`Total de ${batches.length} lotes para processar.`);
    for (let i = 0; i < batches.length; i++) {
        log(`Processando lote ${i + 1}/${batches.length}...`);
        try {
            const batch = batches[i];
            const correctedBatch = await geminiService.correctCartoriosBatchWithRetry(batch);
            correctedServentias.push(...correctedBatch);
            if ((i + 1) % CONCURRENCY_LIMIT === 0 && i < batches.length - 1) {
                log(`Aguardando ${DELAY_BETWEEN_BATCH_GROUPS_MS / 1000} segundos...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCH_GROUPS_MS));
            }
        } catch (error) {
            log(`❌ Erro ao processar o lote ${i + 1}: ${error.message}. Pulando este lote.`);
        }
    }
    log("Correção com IA finalizada.");
    log("Passo 3/4: Mapeando dados para o formato do banco de dados...");
    const cartoriosParaSalvar = correctedServentias.map(s => ({
        cns: s.CNS, nome: (s.DENOMINACAO_SERVENTIA || "").toUpperCase().trim(), estado: (s.UF || "").toUpperCase().trim(),
        cidade: (s.MUNICIPIO || "").toUpperCase().trim(), atribuicoes: (Array.isArray(s.ATRIBUICOES) ? s.ATRIBUICOES.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b).join(",") : ""),
        status: s.STATUS_SERVENTIA === "1",
    })).filter(c => c.cns);
    log(`${cartoriosParaSalvar.length} cartórios mapeados e prontos para salvar.`);
    log("Passo 4/4: Salvando dados no banco de dados...");
    const transaction = await sequelize.transaction();
    try {
      await Cartorio.destroy({ where: {}, cascade: true, transaction });
      log("Tabela de cartórios limpa.");
      await Cartorio.bulkCreate(cartoriosParaSalvar, { transaction, validate: true });
      await transaction.commit();
      log(`✅ SUCESSO! ${cartoriosParaSalvar.length} cartórios foram sincronizados.`);
      return { message: "Sincronização concluída com sucesso!", total: cartoriosParaSalvar.length };
    } catch (dbError) {
      await transaction.rollback();
      log(`❌ Erro no banco de dados: ${dbError.message}`);
      throw dbError;
    }
  } catch (error) {
    log(`❌ Erro fatal no processo de sincronização: ${error.message}`);
    throw error;
  }
};


// --- NOVAS FUNÇÕES PARA CONSULTAS EM TEMPO REAL (IGUAL AO WORDPRESS) ---

// NOVO: Busca a lista de estados (hardcoded, igual ao WordPress)
const getEstadosService = async () => {
  log("Buscando lista de estados.");
  return [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
};

// NOVO: Busca cidades pela API do IBGE (igual ao WordPress)
const getCidadesPorUFService = async (uf) => {
  if (!uf) throw new Error("UF é obrigatória.");
  log(`Buscando cidades para o estado: ${uf}`);
  
  const codigoUF = {
    AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52, MA: 21,
    MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41, PE: 26, PI: 22, RJ: 33, RN: 24,
    RS: 43, RO: 11, RR: 14, SC: 42, SP: 35, SE: 28, TO: 17
  }[uf.toUpperCase()];

  if (!codigoUF) throw new Error("UF inválida.");

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${codigoUF}/municipios?orderBy=nome`;
  try {
    const response = await axios.get(url);
    const cidades = response.data.map(cidade => cidade.nome);
    log(`Encontradas ${cidades.length} cidades para ${uf}.`);
    return cidades;
  } catch (error) {
    log(`Erro ao buscar cidades do IBGE: ${error.message}`);
    throw new Error('Não foi possível buscar as cidades do IBGE.');
  }
};

// NOVO: Busca cartórios pela API do Infosimples (igual ao WordPress)
// MODIFICADO: Busca cartórios pela API do Infosimples com filtro de atribuição
const getCartoriosService = async (filters) => {
  const { estado, cidade, atribuicaoId } = filters; // MODIFICADO: adicionado atribuicaoId

  if (!estado || !cidade) {
    const error = new Error("Os filtros de estado e cidade são obrigatórios.");
    error.statusCode = 400;
    throw error;
  }
  log(`Buscando cartórios para ${cidade}/${estado}` + (atribuicaoId ? ` com atribuição ID: ${atribuicaoId}` : ''));

  const api_url = 'https://api.infosimples.com/api/v2/consultas/cnj/serventias-extrajud-lista';
  const token = process.env.INFOSIMPLES_TOKEN;
  
  if (!token) {
      throw new Error("Token da Infosimples não configurado no servidor.");
  }

  const params = {
      token: token,
      uf: estado.toUpperCase(),
      municipio: cidade.toUpperCase(),
      timeout: 300
  };

  try {
    const response = await axios.post(api_url, params, { timeout: 30000 });
    const body = response.data;
    
    if (body.code === 200 && body.data && body.data[0] && body.data[0].resultados) {
        let resultados = body.data[0].resultados;

        // --- INÍCIO DA LÓGICA DE FILTRAGEM ---
        if (atribuicaoId) {
            const keywords = atribuicaoKeywords[atribuicaoId] || [];

            resultados = resultados.filter(cartorio => {
                // Regra 1: Verifica se a atribuição está na lista de IDs do cartório (se houver)
                // Assumindo que a API retorna um campo 'atribuicoes' como "1,4,2"
                const atribuicoesDoCartorio = (cartorio.atribuicoes || '').split(',');
                if (atribuicoesDoCartorio.includes(atribuicaoId)) {
                    return true;
                }

                // Regra 2: Verifica se o nome do cartório contém palavras-chave (para cartórios genéricos)
                const nomeCartorio = cartorio.denominacao.toUpperCase();
                if (keywords.some(keyword => nomeCartorio.includes(keyword))) {
                    return true;
                }
                
                // Regra 3 (Obs. c): Se o cartório não tem especialidade no nome, ele é "genérico".
                // Se nenhuma palavra-chave de NENHUMA categoria for encontrada, ele pode servir para várias coisas.
                // Esta regra é complexa e pode gerar falsos positivos, mas incluímos para abranger tudo.
                const todasKeywords = Object.values(atribuicaoKeywords).flat();
                if (!todasKeywords.some(keyword => nomeCartorio.includes(keyword))) {
                    return true; // É um cartório genérico (ex: "1º Tabelionato de Cidade Tal")
                }

                return false;
            });
        }
        // --- FIM DA LÓGICA DE FILTRAGEM ---

        const cartoriosFormatados = resultados.map(c => ({
            value: c.cns, // ALTERADO: Usar o CNS como valor único
            label: formatarNomeCartorio(c.denominacao)
        }));

        log(`Encontrados ${cartoriosFormatados.length} cartórios em ${cidade}/${estado} após filtragem.`);
        return cartoriosFormatados;

    } else {
        const errorMessage = body.code_message || 'Resposta inválida da API Infosimples.';
        log(`Erro da API Infosimples: ${errorMessage}`);
        throw new Error(errorMessage);
    }
  } catch (error) {
      log(`Erro na chamada para a API Infosimples: ${error.message}`);
      throw new Error('Falha na comunicação com o serviço de busca de cartórios.');
  }
};

module.exports = {
  syncCartoriosService,
  getCartoriosService,
  getEstadosService,
  getCidadesPorUFService,
};