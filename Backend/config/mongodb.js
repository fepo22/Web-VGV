import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "vgv";

let client;
let databasePromise;

export const isMongoConfigured = Boolean(uri);

export const getDatabase = async () => {
  if (!uri) {
    throw new Error("MONGODB_URI no esta configurada");
  }

  if (!databasePromise) {
    client = client || new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    databasePromise = client.connect()
      .then(() => client.db(databaseName))
      .catch(error => {
        databasePromise = undefined;
        throw error;
      });
  }

  return databasePromise;
};
