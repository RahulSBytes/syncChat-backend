import mongoose from "mongoose";

export default async function connectDB(uri) {
  try {
    const connection = await mongoose.connect(uri);
    console.log("connection established");
    return connection;
  } catch (error) {
    console.log("failed connecting database :: " + error);
    process.exit(1);
  }
}
