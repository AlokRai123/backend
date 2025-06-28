import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
     
    subscriber : {
        type : Schema.Types.ObjectId, // one who is subcriber
        ref : "users",
        required : true
    },
    channel : {
        type : Schema.Types.ObjectId, // one whom is subcriber is subscribing
        ref : "users",
        required : true
    }

}, {timestamps : true});

export const Subscription = mongoose.model("subscription" , subscriptionSchema)