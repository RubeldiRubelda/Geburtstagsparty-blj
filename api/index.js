const express = require('express');
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
app.use('/songs', express.static('songs'));
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
    const readmeFile = path.join(folderPath, 'info.txt');
    console.log('Lyrics file:', lyricsFile);
    console.log('Readme file:', readmeFile);

    let lyrics = '';
    if (fs.existsSync(lyricsFile)) {
      lyrics = fs.readFileSync(lyricsFile, 'utf8');
    }

    let readme = '';
    if (fs.existsSync(readmeFile)) {
      readme = fs.readFileSync(readmeFile, 'utf8');
      console.log('Readme content:', readme);
    } else {
      console.log('Readme file does not exist');
    }

    let title = folder;
    let artist = 'Unbekannt';
    if (readme) {
      // Parse simple info.txt, e.g. Title: ..., Artist: ...
      const titleMatch = readme.match(/Title:\s*(.+)/i);
      const artistMatch = readme.match(/Artist:\s*(.+)/i);
      console.log('Title match:', titleMatch);
      console.log('Artist match:', artistMatch);
      if (titleMatch) title = titleMatch[1].trim();
      if (artistMatch) artist = artistMatch[1].trim();
      console.log('Parsed title:', title);
      console.log('Parsed artist:', artist);
    }

    if (audioFile) {
      songs.push({
        id: folder,
        title,
        artist,
        audio: `/songs/${folder}/${audioFile}`,
        lyrics,
        readme
      });
    }
  });
  console.log('Songs loaded:', songs);
  return songs;
}

// Routen
app.get('/', (req, res) => {
  const songs = loadSongs();
  res.render('index', { songs });
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