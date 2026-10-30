const mongoose = require('mongoose');
const schema = new mongoose.Schema({ guildId:{type:String,unique:true,required:true}, welcomeChannel:{type:String,default:''}, welcomeMessage:{type:String,default:'Welcome {user} to {server}!'}, logsChannel:{type:String,default:''}, antiSpam:{type:Boolean,default:true} },{timestamps:true});
const Settings = mongoose.models.GuildSettings || mongoose.model('GuildSettings',schema);
async function connect(){ if(!process.env.MONGODB_URI){console.warn('MONGODB_URI missing; database features are unavailable.');return false;} await mongoose.connect(process.env.MONGODB_URI);console.log('MongoDB connected');return true; }
async function get(id){return await Settings.findOne({guildId:id}).lean() || {guildId:id,welcomeChannel:'',welcomeMessage:'Welcome {user} to {server}!',logsChannel:'',antiSpam:true};}
async function set(id,value){return await Settings.findOneAndUpdate({guildId:id},{$set:value,$setOnInsert:{guildId:id}},{new:true,upsert:true,runValidators:true}).lean();}
module.exports={connect,get,set};
