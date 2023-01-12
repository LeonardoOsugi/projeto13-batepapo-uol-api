import express from "express";
import cors from "cors";
import { MongoClient} from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const participantesSchema = joi.object({
    name: joi.string().min(3).required()
});

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

app.post("/messages", (req, res)=>{

});

app.get("/messages", (req, res) => {

});

app.post("/status", (req, res) => {

});



app.listen(process.env.PORT, console.log(`app rodando na porta ${process.env.PORT}`));