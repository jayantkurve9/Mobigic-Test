const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Connect to MongoDB (Make sure MongoDB is running)
mongoose.connect('mongodb://localhost/fileUploader', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// Define User Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  files: [{ filename: String, code: String }]
});

const User = mongoose.model('User', userSchema);

// Routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = new User({ username, password: hashedPassword, files: [] });
  await user.save();

  res.status(201).send('User registered successfully');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Find user by username
  const user = await User.findOne({ username });

  // Verify password
  if (user && await bcrypt.compare(password, user.password)) {
    res.status(200).send('Login successful');
  } else {
    res.status(401).send('Invalid credentials');
  }
});

app.post('/upload', async (req, res) => {
  const { username } = req.body;
  const file = req.files.file;

  // Generate a unique 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Save the file to the server
  const fileName = `${code}_${file.name}`;
  file.mv(path.join(__dirname, 'uploads', fileName));

  // Update user's files
  await User.updateOne({ username }, { $push: { files: { filename: fileName, code } } });

  res.status(200).send('File uploaded successfully');
});

app.get('/files/:username', async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });

  if (!user) {
    return res.status(404).send('User not found');
  }

  res.status(200).json(user.files);
});

app.delete('/remove/:username/:code', async (req, res) => {
  const { username, code } = req.params;

  // Remove file from server
  const user = await User.findOne({ username });
  const file = user.files.find(f => f.code === code);

  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(__dirname, 'uploads', file.filename);
  fs.unlinkSync(filePath);

  // Remove file from user's profile
  await User.updateOne({ username }, { $pull: { files: { code } } });

  res.status(200).send('File removed successfully');
});

// Serve files
app.use('/uploads', express.static('uploads'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
