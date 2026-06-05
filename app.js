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

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    walletBalance: { type: Number, default: 0 },
    referralCode: { type: String, unique: true },
    referredBy: { type: String, default: null }
});
const User = mongoose.model("User", userSchema);

// Login Page
app.get("/", (req, res) => {
    res.render("login", { ref: req.query.ref || '' });
});

// Signup Route
app.post("/signup", async (req, res) => {
    const { username, password, refCode } = req.body;
    
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.send("Username already exists. Please try another.");
        }

        // Generate a random 6-character referral code
        const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        let initialBalance = 0;
        let referredBy = null;

        if (refCode && refCode.trim() !== '') {
            const referrer = await User.findOne({ referralCode: refCode.trim() });
            if (referrer) {
                // Referrer gets 50 bonus
                referrer.walletBalance += 50;
                await referrer.save();
                
                // New user gets 150 bonus
                initialBalance = 150;
                referredBy = referrer.username;
            }
        }

        const newUser = new User({
            username,
            password, // Plain text for now as per current setup, though normally should be hashed
            walletBalance: initialBalance,
            referralCode: newRefCode,
            referredBy
        });

        await newUser.save();
        req.session.user = username; // auto login
        res.redirect("/profile");

    } catch (err) {
        console.error(err);
        res.send("Error during signup.");
    }
});

// Login Check
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    // Hardcoded Admin
    if (username === "admin" && password === "1234") {
        req.session.user = username;
        return res.redirect("/form");
    }

    try {
        const user = await User.findOne({ username, password });
        if (user) {
            req.session.user = username;
            res.redirect("/profile");
        } else {
            res.send("Wrong Username or Password");
        }
    } catch (err) {
        res.send("An error occurred during login.");
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
app.get('/profile', async (req, res) => {
  if(!req.session.user){
    return res.redirect('/');
  }
  
  if (req.session.user === 'admin') {
      return res.render('profile', { user: { username: 'admin', walletBalance: 0, referralCode: 'ADMIN' } });
  }

  try {
      const user = await User.findOne({ username: req.session.user });
      res.render('profile', { user });
  } catch (err) {
      res.send("Error loading profile");
  }
});

// Refer & Earn Page
app.get('/refer-earn', async (req, res) => {
  if(!req.session.user){
    return res.redirect('/');
  }

  if (req.session.user === 'admin') {
      return res.render('refer-earn', { user: { username: 'admin', walletBalance: 0, referralCode: 'ADMIN' } });
  }

  try {
      const user = await User.findOne({ username: req.session.user });
      res.render('refer-earn', { user, host: req.get('host') });
  } catch (err) {
      res.send("Error loading refer page");
  }
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
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  
  if (text.trim() || image) {
    chatMessages.push({ id, text, image, sender, time, isEdited: false });
  }
  res.redirect('/chat');
});

// Edit message API
app.post('/chat/edit', express.json(), (req, res) => {
  const { id, newText } = req.body;
  const isAdmin = req.session.user === 'admin';
  const sender = isAdmin ? 'admin' : 'user';

  const msg = chatMessages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
  
  if (msg.sender !== sender && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  if (newText && newText.trim()) {
    msg.text = newText.trim();
    msg.isEdited = true;
    return res.json({ success: true, message: msg });
  }
  res.status(400).json({ success: false, error: 'Invalid text' });
});

// Delete message API
app.post('/chat/delete', express.json(), (req, res) => {
  const { id } = req.body;
  const isAdmin = req.session.user === 'admin';
  const sender = isAdmin ? 'admin' : 'user';

  const msgIndex = chatMessages.findIndex(m => m.id === id);
  if (msgIndex === -1) return res.status(404).json({ success: false, error: 'Message not found' });

  if (chatMessages[msgIndex].sender !== sender && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  chatMessages.splice(msgIndex, 1);
  res.json({ success: true });
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