const {SlashCommandBuilder,PermissionFlagsBits,ChannelType,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder}=require('discord.js');
const store=require('./store');
const commands=[
 new SlashCommandBuilder().setName('ticket-panel').setDescription('Post support panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('close').setDescription('Close this ticket'),
 new SlashCommandBuilder().setName('ticket-reopen').setDescription('Reopen this ticket').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
 new SlashCommandBuilder().setName('ticket-claim').setDescription('Claim this ticket'),
 new SlashCommandBuilder().setName('ticket-unclaim').setDescription('Unclaim this ticket').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
 new SlashCommandBuilder().setName('ticket-transcript').setDescription('Export ticket transcript'),
 new SlashCommandBuilder().setName('ticket-add').setDescription('Add member').addUserOption(o=>o.setName('member').setDescription('Member').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
 new SlashCommandBuilder().setName('ticket-remove').setDescription('Remove member').addUserOption(o=>o.setName('member').setDescription('Member').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
 new SlashCommandBuilder().setName('ticket-rename').setDescription('Rename ticket').addStringOption(o=>o.setName('name').setDescription('New name').setRequired(true).setMaxLength(90)).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
].map(x=>x.toJSON());
const staff=(i,c)=>Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageChannels)||i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)||(c.ticketSupportRole&&i.member?.roles?.cache?.has(c.ticketSupportRole)));
async function ctx(i){const t=await store.getTicketByChannel(i.channelId);if(!t)return {error:'القناة دي مش تذكرة مسجلة.'};const c=await store.get(i.guildId);return {t,c,admin:staff(i,c),owner:t.userId===i.user.id};}
async function saveTranscript(i){let rows=[],before;for(let n=0;n<10;n++){const p=await i.channel.messages.fetch({limit:100,before}).catch(()=>null);if(!p?.size)break;rows.push(...p.values());before=p.last().id;if(p.size<100)break;}rows.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);const body=rows.map(m=>'['+new Date(m.createdTimestamp).toISOString()+'] '+m.author.tag+': '+(m.content||'[بدون نص]')).join('\n').slice(0,1800000)||'لا توجد رسائل';const file=new AttachmentBuilder(Buffer.from(body,'utf8'),{name:'ticket-'+i.channelId+'.txt'});await i.channel.send({content:'Ayrexx Transcript',files:[file]});await store.updateTicket(i.channelId,{transcriptAt:new Date()});}
async function handleTicketInteraction(i){
 if(i.isChatInputCommand()&&i.commandName==='ticket-panel'){
  const c=await store.get(i.guildId),target=c.ticketPanelChannel?await i.guild.channels.fetch(c.ticketPanelChannel).catch(()=>null):i.channel;
  if(!target?.isTextBased())return i.reply({content:'حدد قناة نصية للوحة التذاكر.',ephemeral:true});
  const e=new EmbedBuilder().setColor(0xC62828).setTitle('Ayrexx Support').setDescription('اضغط لفتح تذكرة خاصة مع فريق الدعم.').setFooter({text:'Ayrexx • ISANO'});
  const r=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ayrexx:ticket:create').setLabel('فتح تذكرة').setStyle(ButtonStyle.Danger));
  await target.send({embeds:[e],components:[r]});return i.reply({content:'تم نشر اللوحة في '+target,ephemeral:true});
 }
 if(i.isButton()&&i.customId==='ayrexx:ticket:create'){
  const old=await store.findOpenTicket(i.guildId,i.user.id);if(old){const c=await i.guild.channels.fetch(old.channelId).catch(()=>null);if(c)return i.reply({content:'عندك تذكرة مفتوحة: '+c,ephemeral:true});}
  const cfg=await store.get(i.guildId),perms=[{id:i.guild.roles.everyone.id,deny:['ViewChannel']},{id:i.user.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','AttachFiles']},{id:i.client.user.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','ManageChannels']}];
  if(cfg.ticketSupportRole)perms.push({id:cfg.ticketSupportRole,allow:['ViewChannel','SendMessages','ReadMessageHistory']});
  const ch=await i.guild.channels.create({name:'ticket-'+i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,18),type:ChannelType.GuildText,parent:cfg.ticketCategory||undefined,permissionOverwrites:perms,topic:'Ayrexx ticket | user:'+i.user.id});
  try{await store.createTicket({guildId:i.guildId,userId:i.user.id,channelId:ch.id});}catch(e){await ch.delete().catch(()=>{});throw e;}
  const r=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ayrexx:ticket:close').setLabel('إغلاق').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('ayrexx:ticket:claim').setLabel('استلام').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('ayrexx:ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary));
  await ch.send({content:'أهلًا '+i.user+'، اكتب تفاصيل المشكلة وسيصلك فريق الدعم.',components:[r]});return i.reply({content:'تم فتح تذكرتك: '+ch,ephemeral:true});
 }
 if(i.isButton()&&i.customId.startsWith('ayrexx:ticket:')){
  const x=await ctx(i);if(x.error)return i.reply({content:x.error,ephemeral:true});const {t,admin,owner}=x;
  if(i.customId.endsWith(':close')){if(!admin&&!owner)return i.reply({content:'صاحب التذكرة أو الدعم فقط.',ephemeral:true});if(t.status==='closed')return i.reply({content:'مغلقة بالفعل.',ephemeral:true});await store.closeTicket(i.channelId,i.user.id);return i.reply('تم إغلاق التذكرة.');}
  if(!admin)return i.reply({content:'لفريق الدعم فقط.',ephemeral:true});
  if(i.customId.endsWith(':claim')){if(t.claimedBy)return i.reply({content:'مستلمة بواسطة <@'+t.claimedBy+'>.',ephemeral:true});await store.updateTicket(i.channelId,{claimedBy:i.user.id});return i.reply('تم استلام التذكرة.');}
  if(i.customId.endsWith(':transcript')){await i.deferReply({ephemeral:true});await saveTranscript(i);return i.editReply('تم إرسال ملف المحادثة.');}
 }
 if(i.isChatInputCommand()&&['close','ticket-reopen','ticket-claim','ticket-unclaim','ticket-transcript','ticket-add','ticket-remove','ticket-rename'].includes(i.commandName)){
  const x=await ctx(i);if(x.error)return i.reply({content:x.error,ephemeral:true});const {t,admin,owner}=x,cmd=i.commandName;
  if(cmd==='close'){if(!admin&&!owner)return i.reply({content:'صاحب التذكرة أو الدعم فقط.',ephemeral:true});if(t.status==='closed')return i.reply({content:'مغلقة بالفعل.',ephemeral:true});await store.closeTicket(i.channelId,i.user.id);return i.reply('تم إغلاق التذكرة.');}
  if(!admin)return i.reply({content:'الأمر لفريق الدعم والإدارة فقط.',ephemeral:true});
  if(cmd==='ticket-claim'){if(t.claimedBy)return i.reply({content:'مستلمة بواسطة <@'+t.claimedBy+'>.',ephemeral:true});await store.updateTicket(i.channelId,{claimedBy:i.user.id});return i.reply('تم استلام التذكرة.');}
  if(cmd==='ticket-unclaim'){await store.updateTicket(i.channelId,{claimedBy:''});return i.reply('تم إلغاء الاستلام.');}
  if(cmd==='ticket-reopen'){await store.reopenTicket(i.channelId);return i.reply('تم إعادة فتح التذكرة.');}
  if(cmd==='ticket-transcript'){await i.deferReply({ephemeral:true});await saveTranscript(i);return i.editReply('تم إرسال ملف المحادثة.');}
  if(cmd==='ticket-add'||cmd==='ticket-remove'){const m=i.options.getMember('member');if(!m)return i.reply({content:'العضو غير موجود.',ephemeral:true});await i.channel.permissionOverwrites.edit(m.id,cmd==='ticket-add'?{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}:{ViewChannel:false});return i.reply(cmd==='ticket-add'?'تمت إضافة العضو.':'تمت إزالة العضو.');}
  if(cmd==='ticket-rename'){const name=i.options.getString('name').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,90);if(!name)return i.reply({content:'اسم غير صالح.',ephemeral:true});await i.channel.setName(name);return i.reply('تم تغيير اسم التذكرة.');}
 }
 return false;
}
module.exports={commands,handleTicketInteraction};
