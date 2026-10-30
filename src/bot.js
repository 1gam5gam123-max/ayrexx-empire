const {Client,GatewayIntentBits,REST,Routes,SlashCommandBuilder,PermissionFlagsBits}=require('discord.js');
const store=require('./store');
const commands=[
 new SlashCommandBuilder().setName('ping').setDescription('Check Ayrexx status'),
 new SlashCommandBuilder().setName('server').setDescription('Show server info'),
 new SlashCommandBuilder().setName('warn').setDescription('Warn a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o=>o.setName('member').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')),
 new SlashCommandBuilder().setName('clear').setDescription('Delete 1-100 recent messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setMinValue(1).setMaxValue(100).setRequired(true))
].map(x=>x.toJSON());
async function sendLog(client,guildId,text){try{const cfg=await store.get(guildId);if(!cfg.logsChannel)return;const ch=await client.channels.fetch(cfg.logsChannel).catch(()=>null);if(ch?.isTextBased())await ch.send({content:text}).catch(()=>{});}catch(e){console.error('Log error:',e.message);}}
async function startBot(){
 if(!process.env.DISCORD_TOKEN){console.warn('DISCORD_TOKEN missing; skipping bot login.');return;}
 const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMembers,GatewayIntentBits.MessageContent]});
 const recent=new Map();
 client.once('ready',async()=>{console.log('Ayrexx online as '+client.user.tag);if(process.env.DISCORD_CLIENT_ID){try{await new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),{body:commands});}catch(e){console.error('Command registration failed:',e.message);}}});
 client.on('guildMemberAdd',async member=>{try{const cfg=await store.get(member.guild.id);if(cfg.welcomeChannel){const ch=await client.channels.fetch(cfg.welcomeChannel).catch(()=>null);if(ch?.isTextBased()){const msg=(cfg.welcomeMessage||'Welcome {user} to {server}!').replaceAll('{user}',member.toString()).replaceAll('{server}',member.guild.name);await ch.send({content:msg});}}await sendLog(client,member.guild.id,'➕ دخل العضو '+member.user.tag+' إلى السيرفر.');}catch(e){console.error('Welcome error:',e.message);}});
 client.on('guildMemberRemove',m=>sendLog(client,m.guild.id,'➖ غادر العضو '+m.user.tag+' السيرفر.'));
 client.on('messageDelete',m=>{if(m.guild&&!m.author?.bot)sendLog(client,m.guild.id,'🗑️ تم حذف رسالة من '+(m.author?.tag||'عضو مجهول')+' في '+(m.channel?.name||'قناة غير معروفة')+'.');});
 client.on('messageCreate',async m=>{if(!m.guild||m.author.bot)return;try{const cfg=await store.get(m.guild.id);if(!cfg.antiSpam)return;const key=m.guild.id+':'+m.author.id,now=Date.now(),arr=(recent.get(key)||[]).filter(t=>now-t<8000);arr.push(now);recent.set(key,arr);if(arr.length>=6){if(m.member?.moderatable)await m.member.timeout(60000,'Ayrexx anti-spam: message flood').catch(()=>{});const recentMessages=await m.channel.messages.fetch({limit:30}).catch(()=>null);if(recentMessages){const own=recentMessages.filter(x=>x.author.id===m.author.id&&now-x.createdTimestamp<10000);if(own.size>1)await m.channel.bulkDelete(own,true).catch(()=>{});}await sendLog(client,m.guild.id,'🛡️ مكافحة السبام: تم رصد رسائل متكررة من '+m.author.tag+'.');recent.delete(key);}}catch(e){console.error('Anti-spam error:',e.message);}});
 client.on('interactionCreate',async i=>{if(!i.isChatInputCommand())return;try{
  if(i.commandName==='ping')return i.reply({content:'Pong! '+client.ws.ping+'ms',ephemeral:true});
  if(i.commandName==='server')return i.reply({content:i.guild.name+'\\nMembers: '+i.guild.memberCount,ephemeral:true});
  if(i.commandName==='warn'){const u=i.options.getUser('member',true),r=i.options.getString('reason')||'No reason provided';const member=await i.guild.members.fetch(u.id).catch(()=>null);if(member)await member.send('تم تحذيرك في '+i.guild.name+'. السبب: '+r).catch(()=>{});await sendLog(client,i.guild.id,'⚠️ تحذير '+u.tag+' — '+r);return i.reply({content:'تم تسجيل التحذير لـ '+u.tag+'.',ephemeral:true});}
  if(i.commandName==='clear'){if(!i.channel?.bulkDelete)return i.reply({content:'Unsupported channel.',ephemeral:true});const n=i.options.getInteger('amount',true),d=await i.channel.bulkDelete(n,true);await sendLog(client,i.guild.id,'🧹 تم حذف '+d.size+' رسالة بواسطة '+i.user.tag+'.');return i.reply({content:'Deleted '+d.size+' messages.',ephemeral:true});}
 }catch(e){console.error(e);const p={content:'Command failed. Check permissions.',ephemeral:true};if(i.replied||i.deferred)await i.followUp(p).catch(()=>{});else await i.reply(p).catch(()=>{});}});
 await client.login(process.env.DISCORD_TOKEN);
}
module.exports={startBot};
