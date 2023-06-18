const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mwemohb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const allClass = client.db("language-club").collection("allClass");
    const usersCollection = client.db("language-club").collection("users");
    const ordersCollection = client.db("language-club").collection("orderCourse");

    // JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // admim verify 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // creat user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // users related apis
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

  
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
        return;
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role === "admin") {
        res.send("admin");
      } else if (user?.role === "instructor") {
        res.send("instructor");
      } else if (user?.role === "student") {
         res.send("student");
      }
    });

    // create admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // create Instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // delete api user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // get active all classes
    app.get("/activeAllClass", async (req, res) => {
      const activeClass = { status: "active" };
      const result = await allClass
        .find(activeClass)
        .sort({
          availableSeats: 1,
        })
        .toArray();
      res.send(result);
    });

    // get all classes
    app.get("/allClass", async (req, res) => {
      const result = await allClass
        .find()
        .sort({
          availableSeats: 1,
        })
        .toArray();
      res.send(result);
    });

    // all classes get api
    app.post("/allClass", async (req, res) => {
      const newClass = req.body;
      const result = await allClass.insertOne(newClass);
      res.send(result);
    });

    // delete class by id
    app.delete("/allClass/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allClass.deleteOne(query);
      res.send(result);
    });

    // update seates 
    app.patch("/updateSates/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { availableSeats: -1 } };
      const result = await allClass.updateOne(query, update);
      res.send(result);
    });

    // update status active
    app.patch("/activeStatus/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { status: "active" } };
      const result = await allClass.updateOne(query, update);
      res.send(result);
    });

    // update status pending
    app.patch("/pendingStatus/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { status: "pending" } };
      const result = await allClass.updateOne(query, update);
      res.send(result);
    });

    // update feedback
    app.patch("/classFeedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body?.text;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const update = { $set: { feedBack: feedback} }; 
      const result = await allClass.updateOne(query, update, options);
      res.send(result);
    });

    
    // get data instructor all classes
    app.get("/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await allClass.find(query).toArray();
      res.send(result);
    });

    // get data all instructor
    app.get("/allInstructor",  async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // post order api
    app.post("/orderCourse",  async (req, res) => {
      const newClass = req.body;
      const result = await ordersCollection.insertOne(newClass);
      res.send(result);
    });

    // post order unpaid api
    app.get("/orderCourse/:email", verifyJWT,  async (req, res) => {
      const email = req.params.email;
      const query = { email: email, money:'unPaid' };
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    });

    // post order paid api
    app.get("/orderPaid/:email", verifyJWT,  async (req, res) => {
      const email = req.params.email;
      const query = { email: email, money:'paid' };
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    });

     // delete selected class by id
     app.delete("/orderCourse/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

     // delete selected class by id
     app.patch("/orderCourse/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { money: "paid" } };
      const result = await ordersCollection.updateOne(query, update);
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`language clube is runing prot:${port}`);
});
