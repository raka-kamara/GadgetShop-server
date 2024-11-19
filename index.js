const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 4000;

// middleware
app.use(cors({
  origin: "http://localhost:5173",
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lentaxi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const userCollection = client.db("gadgetShop").collection("users");
const productCollection = client.db("gadgetShop").collection("products");

// connect to database
const dbConnect = async () => {
  try {
    await client.connect();
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

// insert user route
app.post("/users", async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const existingUser = await userCollection.findOne(query);

  if (existingUser) {
    return res.send({ message: "User already exists" });
  }

  const result = await userCollection.insertOne(user);
  res.send(result);
});
// get user

app.get("/user/:emial", async(req, res)=>{
  const query = {email: req.params.email}
  const user = await userCollection.findOne(query)  
  res.send(user)
});


// api
app.get("/", (req, res) => {
  res.send("Server is running");
});

// jwt
app.post("/authentication", async (req, res) => {
  const userEmail = req.body;
  const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, {
    expiresIn: "10d",
  });
  res.send({ token });
});

// start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
