require('dotenv').config()
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 9000;
const jwt = require('jsonwebtoken')
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
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
        const AnnouncementCollection = db.collection('Announcements')
        const reportedsCollection = db.collection('reporteds')
        const tagsCollection = db.collection('tags')
        

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

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            console.log(email);
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden' });
            }
            next()
        }
        // Generate jwt token
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res.send({ token })
        })
        //ap rel \\

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result)
        })




        // Update user badge
        app.patch('/users/badge/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.updateOne(
                { email },
                { $set: { Badge: 'Gold' } }
            );
            
            res.send(result)
        });



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

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {

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



        app.get('/posts/popularity', async (req, res) => {
                const { search = "", sortByPopularity = "false" } = req.query;
                const page = parseInt(req.query.page) || 0; 
                const size = parseInt(req.query.size) || 5; 

                console.log('Pagination:', { page, size, search, sortByPopularity });

               
                const query = search ? { tag: { $regex: search, $options: 'i' } } : {};

                let result;
                if (sortByPopularity === "true") {
                   
                    result = await postsCollection.aggregate([
                        {
                            $addFields: {
                                voteDifference: { $subtract: ["$upVote", "$downVote"] },
                            },
                        },
                        { $match: query },
                        { $sort: { voteDifference: -1 } }, 
                        { $skip: page * size },         
                        { $limit: size },                 
                    ]).toArray();
                } else {
                    
                    result = await postsCollection.find(query)
                        .sort({ carentTime: 1 })           
                        .skip(page * size)                
                        .limit(size)                  
                        .toArray();
                }

                   const totalPosts = await postsCollection.countDocuments(query);

                res.send({
                    posts: result,
                    totalPosts,
                });
            
        });
        //get the single data 

        app.get('/posts', async(req, res)=>{
            const result = await postsCollection.find().toArray();
            res.send(result)
        })
        app.get('/posts/id/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postsCollection.findOne(query);
            res.send(result)
        })
        app.get('/posts/email/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const result = await postsCollection.find(query).sort({ time: -1 }).toArray();
            res.send(result)
        })

        // Fetch post count for a specific user
        app.get('/posts/count/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const count = await postsCollection.countDocuments(query);
            res.send({ count });


        });
        // post the data
        app.post('/posts', async (req, res) => {
            const query = req.body;
            const result = await postsCollection.insertOne(query);
            res.send(result)
        })
        // Increment upVote by 1
        app.patch('/posts/upvote/:id', async (req, res) => {
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
        //delete the api single id
        app.delete('/posts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.deleteOne(query);
            res.send(result)
        })


        //comment related api 

        app.get('/comments', verifyToken, async (req, res) => {
            const result = await commentsCollection.find().toArray();
            res.send(result)
        })
        app.get('/reported', verifyToken, async (req, res) => {
            const result = await reportedsCollection.find().toArray();
            res.send(result)
        })

        app.post('/reported', async (req, res) => {
            const query = req.body;
            const result = await reportedsCollection.insertOne(query)
            res.send(result)
        })

        app.post('/comments', async (req, res) => {
            const query = req.body
            const result = await commentsCollection.insertOne(query);
            res.send(result)
        })




        //comment end

        //AnnouncementCollection api 

        app.post('/Announcements', async (req, res) => {
            const query = req.body;
            const result = await AnnouncementCollection.insertOne(query)
            res.send(result)
        })

        app.get('/Announcements', async (req, res) => {
            const result = await AnnouncementCollection.find().toArray();
            res.send(result)
        });




        //PAYMENT RELATED API

        app.post('/payment', async (req, res) => {
            const { price } = req.body;
            const Amount = parseInt(price * 100);


            const paymentIntent = await stripe.paymentIntents.create({
                amount: Amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })

        })

        //pagination 
        app.get('/pagination', async (req, res) => {
            const TotalPost = await postsCollection.estimatedDocumentCount();
            res.send({ TotalPost })
        })


        // tag 
        app.get('/tags', async(req, res)=>{
            const result = await tagsCollection.find().toArray()
            res.send(result)
        })

    app.post('/tags', async(req, res)=>{
        const query = req.body;
        const result = await tagsCollection.insertOne(query);
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