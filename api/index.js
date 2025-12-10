const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');
const { kv } = require('@vercel/kv');

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

// Funktion zum Laden der Songs aus Ordnern
function loadSongs() {
  const songsDir = path.join(__dirname, '..', 'songs');
  console.log('Songs dir:', songsDir);
  console.log('Songs dir exists:', fs.existsSync(songsDir));
  if (!fs.existsSync(songsDir)) {
    return [];
  }
  const folders = fs.readdirSync(songsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  console.log('Folders found:', folders);
  const songs = [];
  folders.forEach(folder => {
    console.log('Processing folder:', folder);
    const folderPath = path.join(songsDir, folder);
    const audioFile = fs.readdirSync(folderPath).find(file => file.endsWith('.mp3') || file.endsWith('.wav'));
    console.log('Audio file:', audioFile);
    const lyricsFile = path.join(folderPath, 'lyrics.txt');
    const readmeFile = path.join(folderPath, 'README.md');

    let lyrics = '';
    if (fs.existsSync(lyricsFile)) {
      lyrics = fs.readFileSync(lyricsFile, 'utf8');
    }

    let title = folder;
    let artist = 'Unbekannt';
    if (fs.existsSync(readmeFile)) {
      const readme = fs.readFileSync(readmeFile, 'utf8');
      // Parse simple README, e.g. Title: ..., Artist: ...
      const titleMatch = readme.match(/Title:\s*(.+)/i);
      const artistMatch = readme.match(/Artist:\s*(.+)/i);
      if (titleMatch) title = titleMatch[1].trim();
      if (artistMatch) artist = artistMatch[1].trim();
    }

    if (audioFile) {
      songs.push({
        id: folder,
        title,
        artist,
        audio: `/songs/${folder}/${audioFile}`,
        lyrics
      });
    }
  });
  console.log('Songs loaded:', songs);
  return songs;
}

async function saveSongs(songs) {
  console.log('Saving songs to KV:', songs);
  await kv.set('songs', songs);
  console.log('Songs saved to KV');
}

// Multer für Uploads (in Memory speichern)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routen
app.get('/', (req, res) => {
  const songs = loadSongs();
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
  const songs = await loadSongs();
  songs.push({ id: Date.now(), title, artist, audio: audioUrl, lyrics });
  await saveSongs(songs);
  console.log('Song saved, redirecting...');

  res.redirect('/');
});

app.get('/song/:id', (req, res) => {
  const songs = loadSongs();
  const song = songs.find(s => s.id === req.params.id);
  if (song) {
    res.render('song', { song });
  } else {
    res.status(404).send('Song not found');
  }
});

module.exports = app;