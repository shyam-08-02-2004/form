const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const cookieSession = require("cookie-session");

const app = express();

// Serve static assets
app.use(express.static(path.join(__dirname, "public")));

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  }
});
const upload = multer({ storage: storage });

// In‑memory chat messages (for demo purposes)
let chatMessages = [];

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/studentDB";
mongoose.connect(MONGODB_URI)
.then(() => {
    console.log("MongoDB Connected to " + (process.env.MONGODB_URI ? "Cloud" : "Local"));
})
.catch((err) => {
    console.log(err);
});

// Middleware
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
    name: 'session',
    keys: ['secretkey'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Schema
const studentSchema = new mongoose.Schema({
    name: String,
    age: Number,
    studyYear: String,
    education: String,
    parentName: String,
    mobile: String,
    whatsapp: String
});

const Student = mongoose.model("Student", studentSchema);

// Login Page
app.get("/", (req, res) => {
    res.render("login");
});

// Login Check
app.post("/login", (req, res) => {

    const { username, password } = req.body;

    // Username & Password
    if(username === "admin" && password === "1234"){

        req.session.user = username;

        res.redirect("/form");

    } else {

        res.send("Wrong Username or Password");

    }

});

// Form Page
app.get("/form", (req, res) => {

    // Login Check
    if(!req.session.user){
        return res.redirect("/");
    }

    res.render("form");

});

// Profile Page
app.get('/profile', (req, res) => {
  if(!req.session.user){
    return res.redirect('/');
  }
  res.render('profile');
});

// Refer & Earn Page
app.get('/refer-earn', (req, res) => {
  if(!req.session.user){
    return res.redirect('/');
  }
  res.render('refer-earn');
});

// Chat UI routes
app.get('/chat', (req, res) => {
  const isAdmin = req.session.user === 'admin';
  // User can send only if: no messages yet, OR last message is from admin
  // Admin can always send
  let canSend = true;
  if (!isAdmin && chatMessages.length > 0) {
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.sender === 'user') {
      canSend = false; // user must wait for admin reply
    }
  }
  res.render('chat', { messages: chatMessages, isAdmin: isAdmin, canSend: canSend, session: req.session });
});

// API: fetch messages as JSON (for auto-refresh)
app.get('/chat/messages', (req, res) => {
  const isAdmin = req.session.user === 'admin';
  let canSend = true;
  if (!isAdmin && chatMessages.length > 0) {
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.sender === 'user') {
      canSend = false;
    }
  }
  res.json({ messages: chatMessages, isAdmin, canSend });
});

app.post('/chat', upload.single('image'), (req, res) => {
  const text = req.body.message || '';
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const sender = req.session.user === 'admin' ? 'admin' : 'user';

  // Server-side check: block user if last message is already from user
  if (sender === 'user' && chatMessages.length > 0) {
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.sender === 'user') {
      return res.redirect('/chat');
    }
  }

  const now = new Date();
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (text.trim() || image) {
    chatMessages.push({ text, image, sender, time });
  }
  res.redirect('/chat');
});

// Save Form Data
app.post("/submit", async (req, res) => {

    try{

        const newStudent = new Student({
            name: req.body.name,
            age: req.body.age,
            studyYear: req.body.studyYear,
            education: req.body.education,
            parentName: req.body.parentName,
            mobile: req.body.mobile,
            whatsapp: req.body.whatsapp
        });

        await newStudent.save();

        res.send("Form Submitted Successfully");

    } catch(err){

        console.log(err);

        res.send("Error Saving Data");

    }

});

// Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => {
        console.log("Server Started on Port 3000");
    });
}

// Export for Vercel
module.exports = app;