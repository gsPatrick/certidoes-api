const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define o diretório de uploads
const uploadDir = path.resolve(__dirname, '..', '..', 'uploads');

// Garante que o diretório de uploads exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração de armazenamento do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Onde salvar o arquivo
  },
  filename: (req, file, cb) => {
    // Cria um nome de arquivo único para evitar sobreposição
    // Ex: 1678886400000-pedido-15-certidao-de-imovel.pdf
    const uniqueSuffix = Date.now() + '-pedido-' + req.params.id;
    const originalName = path.parse(file.originalname).name.replace(/\s/g, '-');
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}-${originalName}${extension}`);
  },
});

// Filtro para aceitar apenas certos tipos de arquivos (ex: PDF)
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado! Apenas PDFs são permitidos.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 10 // Limite de 10MB por arquivo
  }
});

module.exports = upload;