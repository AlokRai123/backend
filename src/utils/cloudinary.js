import cloudinary from "cloudinary";
import fs from "fs";

cloudinary.config({ 
        cloud_name: process.env.CLOUDIANARY_CLOUD_NAME, 
        api_key: process.env.CLOUDIANARY_API_KEY, 
        api_secret: process.env.CLOUDIANARY_API_SECRET 
    });

 const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;

     const response = await cloudinary.uploader
       .upload(
           'localFilePath', {
               resource_type : "auto",
           }
       )
       //file has been uploaded successfully
       console.log("file has been uploaded successfully",response.url)
       return response

    } catch (error) {

    fs.unlink(localFilePath) // remove the locally saved temporary file as the upload operation got failed
    return null;        
        
    }
 }
    
 export default uploadOnCloudinary 
