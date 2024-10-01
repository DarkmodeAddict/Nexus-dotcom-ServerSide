import { User } from '../models/user.model.js'
import cloudinary from '../utils/cloudinary.js'
import getDataUri from '../utils/dataUri.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const register = async (req, res) => {
    try {
        const {username, email, password} = req.body
        if (!username || !email || !password) {
            return res.status(401).json({
                message: 'Information is missing',
                success: false
            })
        }
        const user = await User.findOne({email})
        if (user) {
            return res.status(401).json({
                message: 'User with this email already exists',
                success: false
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        await User.create({
            username,
            email,
            password: hashedPassword
        })
        return res.status(201).json({
            message: 'Account has been created successfully',
            success: true
        })
    } catch (error) {
        console.log(error)
    }
}

export const login = async (req, res) => {
    try {
        const {email, password} = req.body
        if (!email || !password) {
            return res.status(401).json({
                message: 'Information is missing',
                success: false
            })
        }
        const user = User.findOne({email})
        if (!user) {
            return res.status(401).json({
                message: 'Incorrect Email',
                success: false
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password)
        if (!isPasswordMatch) {
            return res.status(401).json({
                message: 'Incorrect Password',
                success: false
            })
        }
        user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            bio: user.bio,
            followers: user.followers,
            following: user.following,
            posts: user.posts
        }
        const token = await jwt.sign({userID: user._id}, process.env.SECRET_KEY, {expiresIn: '1d'})
        return res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 1 * 24 * 60 * 60 * 1000
        }).json({
            message: `Welcome back ${user.username}`,
            success: true,
            user
        })
    } catch (error) {
        console.log(error)
    }
}

export const logout = async (_, res) => {
    try {
        return res.cookie('token', '', {
            maxAge: 0
        }).json({
            message: 'Logged out successfully',
            success: true
        })
    } catch (error) {
        console.log(error)
    }
}

export const getProfile = async (req, res) => {
    try {
        const userID = req.params.id
        let user = await User.findById(userID)
        return res.status(200).json({
            user,
            success: true
        })
    } catch (error) {
        console.log(error)
    }
}

export const editProfile = async (req, res) => {
    try {
        const userID = req.id
        const {bio, gender} = req.body
        const profilePicture = req.file
        let cloudResponse 
        if (profilePicture) {
            const fileUri = getDataUri(profilePicture)
            cloudResponse = await cloudinary.uploader.upload(fileUri)
        }
        const user = await User.findById(userID)
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                success: false
            })
        }
        if (bio) {
            user.bio = bio
        }
        if (gender) {
            user.gender = gender
        }
        if (profilePicture) {
            user.profilePicture = cloudResponse.secure_url
        }
        await user.save()
        return res.status(200).json({
            message: 'Profile has been updated',
            success: true,
            user
        }) 
    } catch (error) {
        console.log(error)
    }
}

export const getSuggestedUsers = async (req, res) => {
    try {
        const suggestedUsers = await User.find({_id:{$ne:req.id}}).select('-password')
        if (!suggestedUsers) {
            return res.status(400).json({
                message: 'No users so far currently'
            })
        }
        return res.status(200).json({
            success: true,
            users: suggestedUsers
        })
    } catch (error) {
        console.log(error)
    }
}

export const followOrUnfollow = async (req, res) => {
    try {
        const follower = req.id
        const willFollow = req.params.id
        if (follower === willFollow) {
            return res.status(400).json({
                message: 'You cannot follow/unfollow yourself',
                success: false
            })
        }
        const user = await User.findById(follower)
        const targetUser = await User.findById(willFollow)
        if (!user || !targetUser) {
            return res.status(400).json({
                message: 'You not found',
                success: false
            })
        }
        const isFollowing = user.following.includes(willFollow)
        if (isFollowing) {
            await Promise.all([
                User.updateOne({_id: follower}, {$pull: {following: willFollow}}),
                User.updateOne({_id: willFollow}, {$pull: {following: follower}})
            ])
            return res.status(200).json({
                message: 'Unfollowed',
                success: true
            })
        } else {
            await Promise.all([
                User.updateOne({_id: follower}, {$push: {following: willFollow}}),
                User.updateOne({_id: willFollow}, {$push: {following: follower}})
            ])
            return res.status(200).json({
                message: 'Unfollowed',
                success: true
            })
        }
    } catch (error) {
        console.log(error)
    }
}