const {SlashCommandBuilder,PermissionFlagsBits,ChannelType,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle}=require('discord.js');
const store=require('./store');
const commands=[
 new SlashCommandBuilder().setName('ticket-panel').setDescription('Post the support ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('close').setDescription('Close the current support ticket')
].map(x=>x.toJSON());
async function handleTicketInteraction(i){
 if(i.isChatInputCommand()&&i.commandName==='ticket-panel'){
  const cfg=await store.get(i.guildId);
  const panelChannel=cfg.ticketPanelChannel?await i.guild.channels.fetch(cfg.ticketPanelChannel).catch(()=>null):i.channel;
  if(!panelChannel?.isTextBased())return i.reply({content:'حدد قناة نصية صالحة للوحة التذاكر من إعدادات البوت أو استخدم الأمر داخل قناة نصية.',ephemeral:true});
  const embed=new EmbedBuilder().setColor(0xC62828).setTitle('Ayrexx Support').setDescription('اضغط الزر بالأسفل لفتح تذكرة خاصة مع فريق الدعم.').setFooter({text:'Ayrexx • ISANO'});
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ayrexx:ticket:create').setLabel('فتح تذكرة').setStyle(ButtonStyle.Danger).setEmoji('🎫'));
  await panelChannel.send({embeds:[embed],components:[row]});
  return i.reply({content:'تم نشر لوحة التذاكر في '+panelChannel+'.',ephemeral:true});
 }
 if(i.isChatInputCommand()&&i.commandName==='close'){
  const ticket=await store.closeTicket(i.channelId,i.user.id);
  if(!ticket)return i.reply({content:'القناة دي مش تذكرة مفتوحة.',ephemeral:true});
  await i.reply({content:'تم إغلاق التذكرة. سيتم حذف القناة بعد 10 ثوانٍ.'});
  const cfg=await store.get(i.guildId);
  const log=cfg.ticketLogChannel||cfg.logsChannel;
  if(log){const ch=await i.guild.channels.fetch(log).catch(()=>null);if(ch?.isTextBased())await ch.send('🎫 تم إغلاق تذكرة <#'+i.channelId+'> بواسطة <@'+i.user.id+'>.').catch(()=>{});}
  setTimeout(()=>i.channel?.delete('Ayrexx ticket closed').catch(()=>{}),10000);
  return true;
 }
 if(i.isButton()&&i.customId==='ayrexx:ticket:create'){
  const existing=await store.findOpenTicket(i.guildId,i.user.id);
  if(existing){const ch=await i.guild.channels.fetch(existing.channelId).catch(()=>null);if(ch)return i.reply({content:'عندك تذكرة مفتوحة بالفعل: '+ch,ephemeral:true});}
  const cfg=await store.get(i.guildId);
  const overwrites=[{id:i.guild.roles.everyone.id,deny:['ViewChannel']},{id:i.user.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','AttachFiles']},{id:i.client.user.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','ManageChannels']}];
  if(cfg.ticketSupportRole)overwrites.push({id:cfg.ticketSupportRole,allow:['ViewChannel','SendMessages','ReadMessageHistory']});
  const channel=await i.guild.channels.create({name:'ticket-'+i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,18),type:ChannelType.GuildText,parent:cfg.ticketCategory||undefined,permissionOverwrites:overwrites,topic:'Ayrexx ticket | user:'+i.user.id});
  try{await store.createTicket({guildId:i.guildId,userId:i.user.id,channelId:channel.id});}
  catch(e){await channel.delete('Ticket record failed').catch(()=>{});throw e;}
  const closeRow=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ayrexx:ticket:close').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Secondary).setEmoji('🔒'));
  const support=cfg.ticketSupportRole?'<@&'+cfg.ticketSupportRole+'>':'فريق الدعم';
  await channel.send({content:'أهلًا '+i.user+'، اكتب تفاصيل المشكلة وسيصلك فريق الدعم.\n'+support,components:[closeRow]});
  if(cfg.ticketLogChannel){const log=await i.guild.channels.fetch(cfg.ticketLogChannel).catch(()=>null);if(log?.isTextBased())await log.send('🎫 تذكرة جديدة: '+channel+' بواسطة '+i.user+'.').catch(()=>{});}
  return i.reply({content:'تم فتح تذكرتك: '+channel,ephemeral:true});
 }
 if(i.isButton()&&i.customId==='ayrexx:ticket:close'){
  const ticket=await store.closeTicket(i.channelId,i.user.id);
  if(!ticket)return i.reply({content:'التذكرة مغلقة بالفعل أو غير مسجلة.',ephemeral:true});
  await i.reply({content:'تم إغلاق التذكرة. سيتم حذف القناة بعد 10 ثوانٍ.'});
  setTimeout(()=>i.channel?.delete('Ayrexx ticket closed').catch(()=>{}),10000);
  return true;
 }
 return false;
}
module.exports={commands,handleTicketInteraction};
