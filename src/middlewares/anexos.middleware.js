// Salve em: src/middlewares/anexos.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = path.parse(file.originalname).name.replace(/\s/g, '-');
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}-${originalName}${extension}`);
  },
});

// Middleware para upload de múltiplos arquivos do cliente
const uploadAnexos = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // Limite de 10MB
}).array('anexosCliente', 5); // 'anexosCliente' é o nome do campo no form-data, até 5 arquivos

module.exports = uploadAnexos;