const mongoose=require('mongoose');

const settingsSchema=new mongoose.Schema({
 guildId:{type:String,unique:true,required:true},
 prefix:{type:String,default:'!'},
 welcomeChannel:{type:String,default:''},
 welcomeMessage:{type:String,default:'Welcome {user} to {server}!'},
 logsChannel:{type:String,default:''},
 antiSpam:{type:Boolean,default:true},
 ticketCategory:{type:String,default:''},
 ticketSupportRole:{type:String,default:''},
 ticketPanelChannel:{type:String,default:''},
 ticketLogChannel:{type:String,default:''},
 ticketCounter:{type:Number,default:0},
 ticketPanelTitle:{type:String,default:'Ayrexx Support'},
 ticketPanelDescription:{type:String,default:'محتاج مساعدة؟ افتح تذكرة وسيتواصل معك فريق الدعم.'},
 ticketPanelFooter:{type:String,default:'Ayrexx • ISANO'},
 ticketButtonLabel:{type:String,default:'فتح تذكرة'},
 ticketButtonEmoji:{type:String,default:'🎫'},
 ticketButtonColor:{type:String,enum:['Danger','Primary','Success','Secondary'],default:'Danger'},
 ticketTypes:{type:mongoose.Schema.Types.Mixed,default:[]},
 logMessageDelete:{type:String,default:''},
 logMember:{type:String,default:''},
 logModeration:{type:String,default:''},
 logChannel:{type:String,default:''},
 logRole:{type:String,default:''}
},{timestamps:true});

const walletSchema=new mongoose.Schema({guildId:{type:String,required:true},userId:{type:String,required:true},balance:{type:Number,default:0,min:0}},{timestamps:true});
walletSchema.index({guildId:1,userId:1},{unique:true});
const ledgerSchema=new mongoose.Schema({guildId:{type:String,required:true},userId:{type:String,required:true},actorId:{type:String,required:true},action:{type:String,enum:['add','remove','set'],required:true},amount:{type:Number,required:true},before:{type:Number,required:true},after:{type:Number,required:true},note:{type:String,default:''}},{timestamps:true});

const ticketSchema=new mongoose.Schema({
 guildId:{type:String,required:true,index:true},
 userId:{type:String,required:true,index:true},
 channelId:{type:String,required:true,unique:true},
 ticketNumber:{type:Number,default:0},
 status:{type:String,enum:['open','closed'],default:'open',index:true},
 claimedBy:{type:String,default:''},
 ticketType:{type:String,default:'support'},
 closedBy:{type:String,default:''},
 closedAt:{type:Date,default:null},
 transcriptAt:{type:Date,default:null}
},{timestamps:true});
ticketSchema.index({guildId:1,userId:1,status:1});
ticketSchema.index({guildId:1,userId:1},{unique:true,partialFilterExpression:{status:'open'},name:'one_open_ticket_per_user'});
const Ticket=mongoose.models.AyrexxTicket||mongoose.model('AyrexxTicket',ticketSchema);
const Settings=mongoose.models.GuildSettings||mongoose.model('GuildSettings',settingsSchema);
const Wallet=mongoose.models.AyrexxWallet||mongoose.model('AyrexxWallet',walletSchema);
const Ledger=mongoose.models.AyrexxWalletLedger||mongoose.model('AyrexxWalletLedger',ledgerSchema);

async function connect(){
 if(!process.env.MONGODB_URI){console.warn('MONGODB_URI missing; database features are unavailable.');return false;}
 await mongoose.connect(process.env.MONGODB_URI);console.log('MongoDB connected');return true;
}
async function get(id){return await Settings.findOne({guildId:id}).lean()||{guildId:id,prefix:'!',welcomeChannel:'',welcomeMessage:'Welcome {user} to {server}!',logsChannel:'',antiSpam:true,ticketCategory:'',ticketSupportRole:'',ticketPanelChannel:'',ticketLogChannel:'',ticketPanelTitle:'Ayrexx Support',ticketPanelDescription:'محتاج مساعدة؟ افتح تذكرة وسيتواصل معك فريق الدعم.',ticketPanelFooter:'Ayrexx • ISANO',ticketButtonLabel:'فتح تذكرة',ticketButtonEmoji:'🎫',ticketButtonColor:'Danger',ticketTypes:[]};}
async function set(id,value){return await Settings.findOneAndUpdate({guildId:id},{$set:value,$setOnInsert:{guildId:id}},{new:true,upsert:true,runValidators:true}).lean();}
async function findOpenTicket(guildId,userId){return Ticket.findOne({guildId,userId,status:'open'}).lean();}
async function nextTicketNumber(guildId){const doc=await Settings.findOneAndUpdate({guildId},{$inc:{ticketCounter:1},$setOnInsert:{guildId}},{new:true,upsert:true});return doc.ticketCounter||1;}
async function getTicketByChannel(channelId){return Ticket.findOne({channelId}).lean();}
async function createTicket(data){try{return await Ticket.create(data);}catch(e){if(e?.code===11000)throw new Error('OPEN_TICKET_EXISTS');throw e;}}
async function updateTicket(channelId,updates){return Ticket.findOneAndUpdate({channelId},{$set:updates},{new:true,runValidators:true}).lean();}
async function closeTicket(channelId,closedBy){return updateTicket(channelId,{status:'closed',closedBy,closedAt:new Date()});}
async function reopenTicket(channelId){return updateTicket(channelId,{status:'open',closedBy:'',closedAt:null});}
async function deleteTicket(channelId){return Ticket.findOneAndDelete({channelId}).lean();}
async function getWallet(guildId,userId){return await Wallet.findOne({guildId,userId}).lean()||{guildId,userId,balance:0};}
async function adjustWallet({guildId,userId,actorId,action,amount,note=''}){if(!mongoose.connection.readyState)throw new Error('Database is not connected');if(!/^\d{17,20}$/.test(guildId)||!/^\d{17,20}$/.test(userId))throw new Error('Invalid Discord ID');if(!['add','remove','set'].includes(action)||!Number.isSafeInteger(amount)||amount<0||amount>1000000000000)throw new Error('Invalid currency operation');let wallet=await Wallet.findOne({guildId,userId});if(!wallet)wallet=await Wallet.create({guildId,userId,balance:0});const before=wallet.balance;const after=action==='add'?before+amount:action==='remove'?Math.max(0,before-amount):amount;if(!Number.isSafeInteger(after))throw new Error('Balance limit exceeded');wallet.balance=after;await wallet.save();await Ledger.create({guildId,userId,actorId,action,amount,before,after,note:String(note).slice(0,250)});return {before,after};}
async function walletHistory(guildId,userId){return Ledger.find({guildId,userId}).sort({createdAt:-1}).limit(20).lean();}

module.exports={connect,get,set,nextTicketNumber,findOpenTicket,getTicketByChannel,createTicket,updateTicket,closeTicket,reopenTicket,deleteTicket,getWallet,adjustWallet,walletHistory,setBotStats,getBotStats};

const botStatsSchema=new mongoose.Schema({key:{type:String,unique:true,required:true},guildCount:{type:Number,default:0},updatedAt:{type:Date,default:Date.now}});
const BotStats=mongoose.models.AyrexxBotStats||mongoose.model('AyrexxBotStats',botStatsSchema);
async function setBotStats(guildCount){return BotStats.findOneAndUpdate({key:'global'},{$set:{guildCount:Math.max(0,Number(guildCount)||0),updatedAt:new Date()} ,$setOnInsert:{key:'global'}},{upsert:true,new:true}).lean();}
async function getBotStats(){return await BotStats.findOne({key:'global'}).lean()||{guildCount:null,updatedAt:null};}
