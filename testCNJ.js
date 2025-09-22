// arquivo: testCNJ.js
require('dotenv').config();
const { fetchAndSaveXML } = require('./src/utils/cnjSoapClient.js');

console.log('🚀 Iniciando teste de fetch do CNJ...');
console.log('==================================');

fetchAndSaveXML()
  .then(() => {
    console.log('==================================');
    console.log('✅ Teste concluído!');
    console.log('Verifique os arquivos gerados na raiz do projeto:');
    console.log('  - cnj-response-complete.json (resposta completa)');
    console.log('  - cnj-data-raw.xml (XML bruto)');
    console.log('  - cnj-first-row-example.xml (exemplo do primeiro registro)');
    process.exit(0);
  })
  .catch((error) => {
    console.log('==================================');
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  });