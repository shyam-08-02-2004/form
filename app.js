const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cookieSession = require("cookie-session");

const app = express();

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