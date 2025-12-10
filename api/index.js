const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');

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

// Multer für Uploads (in Memory speichern)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routen
app.get('/', (req, res) => {
  const songs = JSON.parse(fs.readFileSync(dataFile));
  res.render('index', { songs });
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.post('/admin/upload', upload.single('audio'), async (req, res) => {
  console.log('Upload request received');
  console.log('req.body:', req.body);
  console.log('req.file:', req.file ? 'File present' : 'No file');
  const { title, artist, lyrics } = req.body;
  let audioUrl = null;

  if (req.file) {
    console.log('Uploading to Vercel Blob...');
    try {
      const blob = await put(`uploads/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
        access: 'public',
      });
      audioUrl = blob.url;
      console.log('Upload successful, URL:', audioUrl);
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).send('Upload failed: ' + error.message);
    }
  }

  console.log('Saving to database...');
  const songs = JSON.parse(fs.readFileSync(dataFile));
  songs.push({ id: Date.now(), title, artist, audio: audioUrl, lyrics });
  fs.writeFileSync(dataFile, JSON.stringify(songs));
  console.log('Song saved, redirecting...');

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