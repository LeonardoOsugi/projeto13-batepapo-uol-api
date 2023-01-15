import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const participantesSchema = joi.object({
    name: joi.string().min(3).required()
});

const messagesSchema = joi.object({
    to: joi.string().min(3).required(),
    text: joi.string().min(3).required(),
    type: joi.string().valid("message", "private_message").required()
})

const mongoClient = new MongoClient(process.env.DATABASE_URL);

let db;

try{
    await mongoClient.connect()
    db = mongoClient.db();
    console.log("conectou");
}catch(err){
    console.log(`${err}`);
};

const participantesCollection = db.collection("participants");
const mensagensCollection = db.collection("messages");

const app = express();
app.use(express.json());
app.use(cors());

const date = dayjs().locale("pt").format("HH:mm:ss");

app.post("/participants", async (req, res)=>{
    const {name} = req.body;

    const participanteExiste = await participantesCollection.findOne({name});

    const validation = participantesSchema.validate({name}, { abortEarly: false });

    if(validation.error){
        const erros = validation.error.details.map((detail) => detail.message);
        res.status(422).send(erros);
        return;
    };

    if(participanteExiste){
        res.sendStatus(409);
        return;
    }

    try{
       await participantesCollection.insertOne({
        name,
        lastStatus: Date.now()
       });

       await mensagensCollection.insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: date
       });

       res.sendStatus(201);
    }catch(err){
        res.status(500).send(err);
    }
});

app.get("/participants", async (req, res)=>{
    try{
        const participa = await participantesCollection.find().toArray();
        res.send(participa);
    }catch(err){
        res.status(500).send(err); 
    }
});

app.post("/messages", async (req, res)=>{
    const {to, text, type} = req.body;
    const from = req.headers.user;

    const userExiste = await participantesCollection.findOne({name: from})

    const validation = messagesSchema.validate({to, text, type}, {abortEarly: false});

    if(validation.error){
        const erros = validation.error.details.map((detail) => detail.message);

        res.status(422).send(erros);
        return;
    }

    if(!userExiste){
        res.sendStatus(422);
        return;
    }

    try{
        await mensagensCollection.insertOne({
            from: from,
            to,
            text,
            type,
            time: date
        });
        res.sendStatus(201);
    }catch(err){
        res.status(500).send(err);
    }
});

app.get("/messages", async (req, res) => {
    const from = req.headers.user;
    const {limit} = req.query;

    const listarMessages = await mensagensCollection.find({$or: [{from: from}, {to: {$in: [from, "Todos"]}},{type: "message"}],}).toArray();

    if(limit){
        const numeroLimit = Number(limit);

        if(numeroLimit <= 0 || isNaN(numeroLimit) ){
                res.sendStatus(422);
                return;
        }
        res.send(listarMessages.slice(-numeroLimit).reverse());
        return;
    }

    try{
        res.send(listarMessages.reverse());
    }catch(err){
        res.status(500).send(err);
    }
});

app.post("/status", async (req, res) => {
    const from = req.headers.user;
    
    const consta = await participantesCollection.findOne({name: from});

    if(!consta){
        res.sendStatus(404);
    }

    try{
        await participantesCollection.updateOne({name: from},{$set: {lastStatus: Date.now()}});
        res.sendStatus(200);
    }catch(err){
        res.status(500).send(err);
    }
});

setInterval(async() => {
    const array = await participantesCollection.find().toArray();

    try{
        array.forEach(async usuario =>{
            const diferenca =  (Date.now()-usuario.lastStatus)/1000;
            
            if(diferenca > 10){
            
                    await participantesCollection.deleteOne({_id: usuario.id});
                    await mensagensCollection.insertOne({
                        from: usuario.from,
                        to: "Todos",
                        text: "sai da sala...",
                        type: "status",
                        time: date
                    });
                
            }
        })
    }catch(err){console.log(err);}
},15000);

app.listen(5000, console.log(`app rodando na porta ${5000}`));