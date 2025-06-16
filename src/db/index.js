import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionIntance = await mongoose.connect(`${process.env.MONGOOSE_URI}/${DB_NAME}`)
        console.log(`In mongoDB connected !! DB_HOST : ${connectionIntance.Connection.error}`)
        process.exit(1);
        
    } catch (error) {

        console.log("MongoDB connection error ! ",error)
        process.exit(1)
        
    }
}

export default connectDB;