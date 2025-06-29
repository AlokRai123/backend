import asyncHandler from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens = async(userId) => {
        try {
            const user =await User.findById(userId)
            const accessToken =  user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            user.refreshtoken = refreshToken
            await user.save({ validateBeforeSave : false})

            return {accessToken, refreshToken}

        } catch (error) {
            throw new ApiError(500,"Some thing went wrong while generating refresh and access token")
        }

     }

const registerUser =  asyncHandler(async(req ,res) => {
    // res.status(200).json({
    //     message : "ok"
    // })
    // Get user derails from frontend 
    // validation - not empty
    // check if user already exists : username , email
    // check for images, check for avtar 
    // upload them to cloudinary ,avatar
    // create user object - create entry in db
    //remove password and refresh token field from response
    // check for response
    // return response

    const {fullname , username , email, password} = req.body

    // console.log("email" , email)

    if(
        [fullname , username , email, password].some((field) => field?.trim() === "")
    ){
       throw new ApiError(400 , " All Fields are required");
    }


    const existedUser =  User.findOne({
        $or : [
            {email},
            {username}
        ]
    })

    if(existedUser){
        throw new  ApiError(409, "User already exists");
    }

    const avatarLocalPath =req.files?.avatar[0]?.path;
   // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

   const user = await User.create({
        fullname,
        avatar : avatar.url,
        coverImage : coverImage.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500 , "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200 ,createdUser, "User registered successfully")
    )
})


const loginUser = asyncHandler(async(req,res) => {
    // req body _> data
    // check username and email
    //find the user 
    //password check
    //access token referesh token
    // send cookies

    const {username, email,password} = req.body

     if(!(username || email)){
        throw new ApiError(400 , "Username or email is required");
     }

     const user = await User.findOne({
        $or : [{username},{email}]
     })

     if(!user){
        throw new ApiError(404, "User does not exist");
     }

     const isPasswordValid = await user.isPasswordValid(password)

     if(!isPasswordValid){
        throw new ApiError(401, "Invalid password");
     }

     const {accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
              

     const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

     const options = {
        httpOnly : true,
        secure : true,
     }

     return res.status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken",refreshToken,options)
     .json(
        new ApiResponse(
            200,{
                user : loggedInUser , accessToken,refreshToken
            },
            "User logged in successfully"
        )
     )

})

const logoutUser = asyncHandler(async(req,res) =>{

    await User.findByIdAndUpdate(req.user._id ,{
        $set : {
            refreshToken : undefined
        }
    },
{
    new : true
})

  const options  = {
    httpOnly : true,
    secure : true
  }

  return res.status(200)
  .clearCookies("accesstoken", options)
  .clearCookies("refreshToken", options)
   .json(new ApiResponse(200, {}, "User logged Out"))
})


const refreshAccessToken = asyncHandler(async (req,res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

   try {
     const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
 
     const user = await User.findById(decodedToken?._id)
 
     if(!user ){
         throw new ApiError(401, "invalid refresh token")
     }
 
     if( incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401, "Refresh token is expired or used");
     }
 
     options = {
         httpOnly : true,
         secure : true
     }
 
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
 
     return res.status(200)
     .cookie("accessToken",accessToken, options)
     .cookie("refreshToken",newRefreshToken,options)
 
    .json(
     new ApiResponse(
         200,
         {accessToken,refreshAccessToken: newRefreshToken},
         "Access token refreshed"
     )
    )
   } catch (error) {
      throw new ApiError(401,error?.message || "Invalid refresh token");
   }

})


const changeCurrentPassword = asyncHandler(async(req,res) => {

    const {oldPassword, newPassword , confPassword} = req.body

    if(!(newPassword === confPassword)){
        throw new ApiError(400, "New password and confirm password does not match");
    }

    const user = await User.findOne(req.user._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res.status(200)
    .json(
        new ApiResponse(200,req.user,"current user fetched successfully")
    )
})


const updateAccountdetails = asyncHandler(async(req,res) => {

    const {fullName , email } = req.body

    if(!fullName, !email){
    throw new ApiError(400, "All fields are required");
    }

     const user = User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set : {
                fullName ,
                email
            }
        },
        {
            new : true
        }
    ).select("-fullName ")

    return res.status(200)
    .json(new ApiError(200,user, "Account details updated successfully"))
})


const updateUserAvtar = asyncHandler(async(req,res) => {

    const avatarLocalPath = req.file?.path
    
    if(!avatarLocalPath) {
        throw  new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uplaoding on avatar cloudinary")
    }
 

    const user =   await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
              avatar :  avatar.url
            }
        },
        {new : true}
      ).select("-password")

      return res
      .status(200)
      .json(
        new ApiResponse(
            200, user,"Avatar image updated successfully"
        )
      )

})

const updateUserCoverImage = asyncHandler(async(req,res) => {

    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on cover Image cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set : {
                coverImage : coverImage.url
            }
        },
        {
            new : true
        }
    )

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,user, "Cover image updated successfully"
        )
    )
})

// Aggrigation pipeline

const getUserChannelProfile = asyncHandler(async(req,res) =>{

    const {username} = req.params

    if(!username.trim()){
        throw new ApiError(400, "username is missing")
    }
 
    const channel = await User.aggregate([
        {
            $match : {
                username : username?.toLowercase()
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignfield : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if: {$in : [req.user?._id, "$subscribers.subscriner"]}
                    }
                },
                 $project : {
                    fullName : 1,
                    username : 1,
                    subscribersCount : 1,
                    channelsSubscribedCount : 1,
                    isSubscribed : 1,
                    avatar : 1,
                    coverImage : 1,
                    email : 1
                 }
            }
        }
    ])

     if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
     }
    
     return res 
     .status(200)
     .json(
        new ApiResponse(200, channel[0], "User channel profile fetched successfully")
     )
})

const getWatchHistory = asyncHandler(async(req, res) => {

    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                pipeline : [
                    {
                       $lookup : {
                        from : "users",
                        localField : "owner",
                        foreignField : "_id",
                        as : "owner",
                        pipline : [
                            {
                                $project : {
                                    fullname : 1,
                                    username : 1,
                                    avatar :1
                                }
                            }
                        ]
                       } 
                    },
                    {
                        $addFields : {
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountdetails,
    updateUserAvtar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}