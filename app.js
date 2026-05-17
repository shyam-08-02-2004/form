const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");

const app = express();

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/studentDB")
.then(() => {
    console.log("MongoDB Connected");
})
.catch((err) => {
    console.log(err);
});

// Middleware
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: true
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
app.listen(3000, () => {
    console.log("Server Started on Port 3000");
});