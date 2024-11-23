const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 4000;

// middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://e-commerce-3105b.web.app",
    "https://e-commerce-3105b.firebaseapp.com",
  ],
  credentials: true,
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

 // Role verification
 const verifyRole = (role) => async (req, res, next) => {
  const email = req.decoded.email;
  const user = await userCollection.findOne({ email });
  if (user?.role !== role) return res.status(403).json({ message: "Forbidden access" });
  next();
};

 // JWT middleware
 const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).json({ message: "Unauthorized access" });

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid Token" });
    req.decoded = decoded;
    next();
  });
};

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

// users related api
app.get("/users", verifyJWT, async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

// Update user role
app.patch("/users/role/:id", verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; // Expected body: { role: "admin" / "buyer" / "seller" }

  const filter = { _id: new ObjectId(id) };
  const updateDoc = { $set: { role } };

  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
});

// Update user status
app.patch("/users/status/:id", verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Expected body: { status: "approved" / "pending" }

  const filter = { _id: new ObjectId(id) };
  const updateDoc = { $set: { status } };

  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
});

// Delete user
app.delete("/users/:id", verifyJWT, async (req, res) => {
  const { id } = req.params;

  const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});



// get user
app.get("/user/:email", async(req, res)=>{
  const query = {email: req.params.email};
  const user = await userCollection.findOne(query);  
  res.send(user)
});



// Product routes
app.post("/add-products", verifyJWT, verifyRole("seller"), async (req, res) => {
  const product = req.body;
  const result = await productCollection.insertOne(product);
  res.status(201).json(result);
});

//delete products
app.delete("/product/:id",  async (req, res) => {
  const { id } = req.params;

  try {
    const result = await productCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Product deleted successfully" });
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});


// update products
app.patch("/products/:id",  async (req, res) => {
  const { id } = req.params;
  const { title, price, description } = req.body;

  try {
    const updatedData = { $set: { title, price, description } };

    const result = await productCollection.updateOne(
      { _id: new ObjectId(id) },
      updatedData
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "Product updated successfully" });
    } else {
      res.status(404).json({ message: "Product not found or no changes made" });
    }
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Failed to update product" });
  }
});


// featured product
app.get("/products", async (req, res) => {
  try {
    const products = await productCollection.find({}).limit(6).toArray();
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Backend: Fetch products based on sellerEmail
app.get("/seller-products", async (req, res) => {
  try {
    const products = await productCollection.find({}).toArray();
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});


app.get("/all-products", async (req, res) => {
  const { title, sort, category, brand, page = 1, limit = 9 } = req.query;

  const query = {};
  if (title) query.title = { $regex: title, $options: "i" };
  if (category) query.category = { $regex: category, $options: "i" };
  if (brand) query.brand = brand;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const sortOption = sort === "asc" ? 1 : -1;

  const products = await productCollection
    .find(query)
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber)
    .sort({ price: sortOption })
    .toArray();

  const totalProducts = await productCollection.countDocuments(query);
  const brands = [...new Set(products.map((product) => product.brand))];
  const categories = [...new Set(products.map((product) => product.category))];

  res.json({ products, brands, categories, totalProducts });
});


// cart routes
app.patch("/cart",  async (req, res) => {
  const { userEmail, productId } = req.body;
  const result = await userCollection.updateOne(
    { email: userEmail },
    { $addToSet: { cart: new ObjectId(String(productId)) } }
  );
  res.json(result);
});


app.get("/cart/:userId",  async (req, res) => {
  const user = await userCollection.findOne({ _id: new ObjectId(req.params.userId) });
  if (!user) return res.status(404).json({ message: "User not found" });

  const cart = await productCollection
    .find({ _id: { $in: user.cart || [] } })
    .toArray();
  res.json(cart);
});

app.patch("/cart/remove",  async (req, res) => {
  const { userId, productId } = req.body;
  const result = await userCollection.updateOne(
    { _id: new ObjectId(String(userId)) },
    { $pull: { cart: new ObjectId(String(productId) )} }
  );
  res.json(result);
});


// Wishlist routes
app.patch("/wishlist/add",  async (req, res) => {
  const { userEmail, productId } = req.body;
  const result = await userCollection.updateOne(
    { email: userEmail },
    { $addToSet: { wishlist: new ObjectId(productId) } }
  );
  res.json(result);
});

app.get("/wishlist/:userId",  async (req, res) => {
  const user = await userCollection.findOne({ _id: new ObjectId(req.params.userId) });
  if (!user) return res.status(404).json({ message: "User not found" });

  const wishlist = await productCollection
    .find({ _id: { $in: user.wishlist || [] } })
    .toArray();
  res.json(wishlist);
});

app.patch("/wishlist/remove",  async (req, res) => {
  const { userId, productId } = req.body;
  const result = await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $pull: { wishlist: new ObjectId(productId) } }
  );
  res.json(result);
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
