const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data:;");
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Datenbank simulieren mit JSON-Datei
const dataFile = path.join(__dirname, '..', 'songs.json');
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Multer für Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Routen
app.get('/', (req, res) => {
  const songs = JSON.parse(fs.readFileSync(dataFile));
  res.render('index', { songs });
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.post('/admin/upload', upload.single('audio'), (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  const { title, artist, lyrics } = req.body;
  const audioFile = req.file ? req.file.filename : null;

  const songs = JSON.parse(fs.readFileSync(dataFile));
  songs.push({ id: Date.now(), title, artist, audio: audioFile, lyrics });
  fs.writeFileSync(dataFile, JSON.stringify(songs));

  res.redirect('/');
});

app.get('/song/:id', (req, res) => {
  const songs = JSON.parse(fs.readFileSync(dataFile));
  const song = songs.find(s => s.id == req.params.id);
  if (song) {
    res.render('song', { song });
  } else {
    res.status(404).send('Song not found');
  }
});

module.exports = app;