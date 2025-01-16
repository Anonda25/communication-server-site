require('dotenv').config()
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 9000;
const jwt = require('jsonwebtoken')
const app = express();
// const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId, } = require('mongodb');

//middlewere
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}))
app.use(express.json())
// app.use(cookieParser())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ls3lx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {


    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('ComonicationDB')
        const postsCollection = db.collection('posts')
        const commentsCollection = db.collection('comments')
        const usersCollection = db.collection('users')


        // user related api 
        const verifyToken = (req, res, next) => {
            // console.log(req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded
                next()
            })
         
        }
        // Generate jwt token
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res.send({token})
        })

       
        app.get('/users', verifyToken, async (req, res) => {
            
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.patch('/users/admin/:id',  async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result)
        })
        
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(401).send({ message: 'unathureze access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);

            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })
        })
        // save or update a user in db
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user?.email }

            // check if user exists in db
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                return res.send({ message: 'user allreaduy', insertedId: null })
            }
            const result = await usersCollection.insertOne({
                ...user,
                Badge: 'Bronze',
            })
            res.send(result)
        })

        app.get('/users/:email',  async(req,res)=>{
            const email = req.params.email;

            const query = { email }
            const result = await usersCollection.findOne(query)
            res.send(result)
        })
        //post relatied api
        app.get('/posts', async (req, res) => {
            const { sherchprams } = req.query;
            let option = {}
            if (sherchprams) {
                option = { tag: { $regex: sherchprams, $options: 'i' } }
            }
            const result = await postsCollection.find(option).sort({ time: -1 }).toArray();
            res.send(result)
        })
        //get the single data 
        app.get('/posts/id/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postsCollection.findOne(query);
            res.send(result)
        })
        app.get('/posts/email/:email',  async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const result = await postsCollection.find(query).sort({ time: -1 }).toArray();
            res.send(result)
        })

        // Fetch post count for a specific user
        app.get('/posts/count/:email',  async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const count = await postsCollection.countDocuments(query);
            res.send({ count });


        });

        app.post('/posts', async (req, res) => {
            const query = req.body;
            const result = await postsCollection.insertOne(query);
            res.send(result)
        })
        // Increment upVote by 1
        app.patch('/posts/upvote/:id',  async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const update = { $inc: { upVote: 1 } };
            const result = await postsCollection.findOneAndUpdate(query, update);
            res.send(result); // Send the updated post
        });

        app.patch('/posts/downvote/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const update = { $inc: { downVote: 1 } };
            const result = await postsCollection.findOneAndUpdate(query, update);
            res.send(result);
        });


        //comment related api 

        app.get('/comments', async (req, res) => {
            const result = await commentsCollection.find().toArray();
            res.send(result)
        })

        app.post('/comments',  async (req, res) => {
            const query = req.body;
            const result = await commentsCollection.insertOne(query);
            res.send(result)
        })







        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Comonication Server..')
})

app.listen(port, () => {
    console.log(`Comonication is running on port ${port}`)
})