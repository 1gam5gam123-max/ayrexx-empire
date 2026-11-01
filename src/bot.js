const {Client,GatewayIntentBits,REST,Routes,SlashCommandBuilder,PermissionFlagsBits,EmbedBuilder,ChannelType}=require('discord.js');
const store=require('./store');
const tickets=require('./tickets');
const commands=[
 new SlashCommandBuilder().setName('ping').setDescription('Check Ayrexx status'),
 new SlashCommandBuilder().setName('server').setDescription('Show detailed server information'),
 new SlashCommandBuilder().setName('warn').setDescription('Warn a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o=>o.setName('member').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')),
 new SlashCommandBuilder().setName('clear').setDescription('Delete 1-100 recent messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setMinValue(1).setMaxValue(100).setRequired(true))
].map(x=>x.toJSON()).concat(tickets.commands);
async function sendLog(client,guildId,text){try{const cfg=await store.get(guildId);if(!cfg.logsChannel)return;const ch=await client.channels.fetch(cfg.logsChannel).catch(()=>null);if(ch?.isTextBased())await ch.send({content:text}).catch(()=>{});}catch(e){console.error('Log error:',e.message);}}
async function serverEmbed(guild){
 await guild.fetch();
 const owner=await guild.fetchOwner().catch(()=>null);
 const roles=guild.roles.cache;
 const channels=guild.channels.cache;
 const count=t=>channels.filter(c=>c.type===t).size;
 const created=Math.floor(guild.createdTimestamp/1000);
 const verification=['لا يوجد','منخفض','متوسط','مرتفع','الأعلى'][guild.verificationLevel]||'غير معروف';
 return new EmbedBuilder().setColor(0xC62828).setTitle('معلومات السيرفر • '+guild.name).setThumbnail(guild.iconURL({size:256})||null).setDescription(guild.description||'لا يوجد وصف للسيرفر.').addFields(
 {name:'👑 المالك',value:owner?owner.user.tag+'\n<@'+owner.id+'>':'غير متاح',inline:true},
 {name:'🆔 Server ID',value:guild.id,inline:true},
 {name:'📅 تاريخ الإنشاء',value:'<t:'+created+':F>\n<t:'+created+':R>',inline:true},
 {name:'👥 الأعضاء',value:'الإجمالي: **'+guild.memberCount+'**',inline:true},
 {name:'💬 القنوات',value:'الإجمالي: **'+channels.size+'**\nنصية: '+count(ChannelType.GuildText)+' • صوتية: '+count(ChannelType.GuildVoice)+'\nمنتديات: '+count(ChannelType.GuildForum)+' • إعلانات: '+count(ChannelType.GuildAnnouncement),inline:true},
 {name:'🎭 الرتب',value:'**'+Math.max(0,roles.size-1)+'** رتبة',inline:true},
 {name:'😀 الإيموجي والملصقات',value:'إيموجي: **'+guild.emojis.cache.size+'**\nملصقات: **'+guild.stickers.cache.size+'**',inline:true},
 {name:'🚀 Boost',value:'المستوى: **'+guild.premiumTier+'**\nالعدد: **'+guild.premiumSubscriptionCount+'**',inline:true},
 {name:'🛡️ مستوى التحقق',value:verification,inline:true},
 {name:'🌐 اللغة والمنطقة',value:(guild.preferredLocale||'غير محدد')+' • '+(guild.region||'تلقائي'),inline:true}
 ).setFooter({text:'Ayrexx • ISANO'}).setTimestamp();
}
async function sendServerInfo(target,guild){const embed=await serverEmbed(guild);return target.reply(target.isChatInputCommand()?{embeds:[embed],ephemeral:true}:{embeds:[embed]});}
async function runPrefix(m,client,cfg){
 const content=m.content.slice(String(cfg.prefix||'!').length).trim();
 const [name,...args]=content.split(/\s+/);if(!name)return;
 const cmd=name.toLowerCase();
 if(cmd==='ping')return m.reply('Pong! '+client.ws.ping+'ms');
 if(['server','serverinfo','info'].includes(cmd))return sendServerInfo(m,m.guild);
 if(cmd==='warn'){
  if(!m.member.permissions.has(PermissionFlagsBits.ModerateMembers))return m.reply('محتاج صلاحية Moderate Members.');
  const u=m.mentions.users.first();if(!u)return m.reply('الاستخدام: '+cfg.prefix+'warn @member [reason]');
  const reason=args.slice(1).join(' ')||'No reason provided';
  const member=await m.guild.members.fetch(u.id).catch(()=>null);
  if(member)await member.send('تم تحذيرك في '+m.guild.name+'. السبب: '+reason).catch(()=>{});
  await sendLog(client,m.guild.id,'⚠️ تحذير '+u.tag+' — '+reason);
  return m.reply('تم تسجيل التحذير لـ '+u.tag+'.');
 }
 if(cmd==='clear'){
  if(!m.member.permissions.has(PermissionFlagsBits.ManageMessages))return m.reply('محتاج صلاحية Manage Messages.');
  const n=Number(args[0]);if(!Number.isInteger(n)||n<1||n>100)return m.reply('الاستخدام: '+cfg.prefix+'clear 1-100');
  const d=await m.channel.bulkDelete(n,true);
  await sendLog(client,m.guild.id,'🧹 تم حذف '+d.size+' رسالة بواسطة '+m.author.tag+'.');
  return m.reply('Deleted '+d.size+' messages.').then(x=>setTimeout(()=>x.delete().catch(()=>{}),4000));
 }
}
async function startBot(){
 if(!process.env.DISCORD_TOKEN){console.warn('DISCORD_TOKEN missing; skipping bot login.');return;}
 const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMembers,GatewayIntentBits.MessageContent]});
 const recent=new Map();
 const updateGlobalGuildCount=()=>store.setBotStats(client.guilds.cache.size).catch(e=>console.error('Bot stats update failed:',e.message));client.once('ready',async()=>{console.log('Ayrexx online as '+client.user.tag);await updateGlobalGuildCount();if(process.env.DISCORD_CLIENT_ID){try{await new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),{body:commands});console.log('Slash commands registered');}catch(e){console.error('Command registration failed:',e.message);}}});
 client.on('guildCreate',()=>updateGlobalGuildCount());client.on('guildDelete',()=>updateGlobalGuildCount());
 client.on('guildMemberAdd',async member=>{try{const cfg=await store.get(member.guild.id);if(cfg.welcomeChannel){const ch=await client.channels.fetch(cfg.welcomeChannel).catch(()=>null);if(ch?.isTextBased()){const msg=(cfg.welcomeMessage||'Welcome {user} to {server}!').replaceAll('{user}',member.toString()).replaceAll('{server}',member.guild.name);await ch.send({content:msg});}}await sendLog(client,member.guild.id,'➕ دخل العضو '+member.user.tag+' إلى السيرفر.');}catch(e){console.error('Welcome error:',e.message);}});
 client.on('guildMemberRemove',m=>sendLog(client,m.guild.id,'➖ غادر العضو '+m.user.tag+' السيرفر.'));
 client.on('messageDelete',m=>{if(m.guild&&!m.author?.bot)sendLog(client,m.guild.id,'🗑️ تم حذف رسالة من '+(m.author?.tag||'عضو مجهول')+' في '+(m.channel?.name||'قناة غير معروفة')+'.');});
 client.on('messageCreate',async m=>{if(!m.guild||m.author.bot)return;try{const cfg=await store.get(m.guild.id);if(m.content.startsWith(cfg.prefix)){await runPrefix(m,client,cfg);return;}if(!cfg.antiSpam)return;const key=m.guild.id+':'+m.author.id,now=Date.now(),arr=(recent.get(key)||[]).filter(t=>now-t<8000);arr.push(now);recent.set(key,arr);if(arr.length>=6){if(m.member?.moderatable)await m.member.timeout(60000,'Ayrexx anti-spam: message flood').catch(()=>{});const msgs=await m.channel.messages.fetch({limit:30}).catch(()=>null);if(msgs){const own=msgs.filter(x=>x.author.id===m.author.id&&now-x.createdTimestamp<10000);if(own.size>1)await m.channel.bulkDelete(own,true).catch(()=>{});}await sendLog(client,m.guild.id,'🛡️ مكافحة السبام: تم رصد رسائل متكررة من '+m.author.tag+'.');recent.delete(key);}}catch(e){console.error('Message handler error:',e.message);}});
 client.on('interactionCreate',async i=>{try{if(await tickets.handleTicketInteraction(i))return;if(!i.isChatInputCommand())return;
  if(i.commandName==='ping')return i.reply({content:'Pong! '+client.ws.ping+'ms',ephemeral:true});
  if(i.commandName==='server')return sendServerInfo(i,i.guild);
  if(i.commandName==='warn'){if(!i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers))return i.reply({content:'محتاج صلاحية Moderate Members.',ephemeral:true});const u=i.options.getUser('member',true),reason=i.options.getString('reason')||'No reason provided';const member=await i.guild.members.fetch(u.id).catch(()=>null);if(member)await member.send('تم تحذيرك في '+i.guild.name+'. السبب: '+reason).catch(()=>{});await sendLog(client,i.guild.id,'⚠️ تحذير '+u.tag+' — '+reason);return i.reply({content:'تم تسجيل التحذير لـ '+u.tag+'.',ephemeral:true});}
  if(i.commandName==='clear'){if(!i.memberPermissions?.has(PermissionFlagsBits.ManageMessages))return i.reply({content:'محتاج صلاحية Manage Messages.',ephemeral:true});const n=i.options.getInteger('amount',true),d=await i.channel.bulkDelete(n,true);await sendLog(client,i.guild.id,'🧹 تم حذف '+d.size+' رسالة بواسطة '+i.user.tag+'.');return i.reply({content:'Deleted '+d.size+' messages.',ephemeral:true});}
 }catch(e){console.error(e);const p={content:'Command failed. Check bot permissions and logs.',ephemeral:true};if(i.replied||i.deferred)await i.followUp(p).catch(()=>{});else await i.reply(p).catch(()=>{});}});
 await client.login(process.env.DISCORD_TOKEN);
}
module.exports={startBot};
