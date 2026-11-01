const {SlashCommandBuilder,PermissionFlagsBits,ChannelType,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder,StringSelectMenuBuilder}=require('discord.js');
const store=require('./store');
const commands=[
 new SlashCommandBuilder().setName('ticket-panel').setDescription('Post support panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName('close').setDescription('Close this ticket'),
 new SlashCommandBuilder().setName('ticket-reopen').setDescription('Reopen this ticket'),
 new SlashCommandBuilder().setName('ticket-claim').setDescription('Claim this ticket'),
 new SlashCommandBuilder().setName('ticket-unclaim').setDescription('Unclaim this ticket'),
 new SlashCommandBuilder().setName('ticket-transcript').setDescription('Export ticket transcript'),
 new SlashCommandBuilder().setName('ticket-info').setDescription('Show ticket details'),
 new SlashCommandBuilder().setName('ticket-add').setDescription('Add member').addUserOption(o=>o.setName('member').setDescription('Member').setRequired(true)),
 new SlashCommandBuilder().setName('ticket-remove').setDescription('Remove member').addUserOption(o=>o.setName('member').setDescription('Member').setRequired(true)),
 new SlashCommandBuilder().setName('ticket-rename').setDescription('Rename ticket').addStringOption(o=>o.setName('name').setDescription('New name').setRequired(true).setMaxLength(90)),
 new SlashCommandBuilder().setName('ticket-delete').setDescription('Delete a closed ticket after transcript')
].map(x=>x.toJSON());
const staff=(i,c)=>Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageChannels)||i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)||(c.ticketSupportRole&&i.member?.roles?.cache?.has(c.ticketSupportRole)));
async function ctx(i){const t=await store.getTicketByChannel(i.channelId);if(!t)return {error:'❌ القناة دي مش تذكرة مسجلة.'};const c=await store.get(i.guildId);return {t,c,type:(c.ticketTypes||[]).find(x=>x.key===t.ticketType)||{},admin:staff(i,c),owner:t.userId===i.user.id};}
function btn(id,label,emoji,style){const b=new ButtonBuilder().setCustomId('ayrexx:ticket:'+id).setLabel(label).setStyle(style);if(emoji)b.setEmoji(emoji);return b;}
function ticketRows(t,admin=true){
 if(t.status==='closed'){
  const row=new ActionRowBuilder().addComponents(btn('reopen','إعادة فتح','🔓',ButtonStyle.Success),btn('transcript','Transcript','📄',ButtonStyle.Secondary));
  if(admin)row.addComponents(btn('delete','حذف التذكرة','🗑️',ButtonStyle.Danger));
  return [row];
 }
 const row=new ActionRowBuilder().addComponents(btn('close','إغلاق','🔒',ButtonStyle.Danger));
 row.addComponents(t.claimedBy?btn('unclaim','إلغاء الاستلام','↩️',ButtonStyle.Secondary):btn('claim','استلام التذكرة','🙋',ButtonStyle.Primary),btn('transcript','Transcript','📄',ButtonStyle.Secondary));
 return [row];
}
const escapeHtml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function syncTicketMessage(channel,t,actor,admin=true){
 const messages=await channel.messages.fetch({limit:100}).catch(()=>null);
 const panel=messages?.find(m=>m.author.id===channel.client.user.id&&m.components.some(r=>r.components.some(b=>b.customId?.startsWith('ayrexx:ticket:'))));
 if(!panel)return;
 const closed=t.status==='closed';
 const embed=new EmbedBuilder().setColor(closed?0x777777:0xC8102E).setTitle(closed?'🔒 تم إغلاق التذكرة':'🎫 تذكرة دعم').setDescription((closed?'أُغلقت التذكرة بواسطة ':'آخر تحديث بواسطة ')+(actor?'<@'+actor+'>':'فريق الدعم')+'\nرقم التذكرة: **#'+String(t.ticketNumber||0).padStart(4,'0')+'**').setFooter({text:'Ayrexx • ISANO'}).setTimestamp();
 await panel.edit({embeds:[embed],components:ticketRows(t,admin)});
}
async function saveTranscript(i,destination){
 const channel=i.channel;let rows=[],before;
 for(let n=0;n<20;n++){const p=await channel.messages.fetch({limit:100,before}).catch(()=>null);if(!p?.size)break;rows.push(...p.values());before=p.last().id;if(p.size<100)break;}
 rows.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
 const body='<!doctype html><html lang="ar"><meta charset="utf-8"><title>Ayrexx Transcript</title><style>body{font:15px Arial;background:#0b0d12;color:#eee;padding:24px}.m{padding:12px;border-bottom:1px solid #333}.muted{color:#aaa}a{color:#ff5268}</style><h1>Ayrexx • Ticket Transcript</h1><p>Server: '+escapeHtml(i.guild.name)+' | Channel: '+escapeHtml(channel.name)+'</p>'+rows.map(m=>'<div class="m"><b>'+escapeHtml(m.author.tag)+'</b> <span class="muted">'+new Date(m.createdTimestamp).toLocaleString('en-GB')+'</span><p>'+escapeHtml(m.content||'[بدون نص]').replace(/\n/g,'<br>')+'</p>'+m.attachments.map(a=>'<p><a href="'+escapeHtml(a.url)+'">'+escapeHtml(a.name||'Attachment')+'</a></p>').join('')+'</div>').join('')+'</html>';
 const file=new AttachmentBuilder(Buffer.from(body,'utf8'),{name:'ayrexx-ticket-'+(i.channelId)+'.html'});
 await destination.send({content:'📄 **Transcript محفوظ** • '+i.guild.name+' • '+channel.name,files:[file]});
 await store.updateTicket(i.channelId,{transcriptAt:new Date()});
}
async function handleTicketInteraction(i){
 if(i.isChatInputCommand()&&i.commandName==='ticket-panel'){
  const c=await store.get(i.guildId),target=c.ticketPanelChannel?await i.guild.channels.fetch(c.ticketPanelChannel).catch(()=>null):i.channel;
  if(!target?.isTextBased())return i.reply({content:'حدد قناة نصية للوحة التذاكر من لوحة التحكم.',ephemeral:true});
  const e=new EmbedBuilder().setColor(0xC8102E).setTitle(c.ticketPanelTitle||'Ayrexx Support').setDescription(c.ticketPanelDescription||'محتاج مساعدة؟ افتح تذكرة وسيتواصل معك فريق الدعم.').setFooter({text:c.ticketPanelFooter||'Ayrexx • ISANO'});
  const styles={Danger:ButtonStyle.Danger,Primary:ButtonStyle.Primary,Success:ButtonStyle.Success,Secondary:ButtonStyle.Secondary};
  const types=Array.isArray(c.ticketTypes)?c.ticketTypes.filter(t=>t?.key&&t?.name):[];
  const components=types.length>1?[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ayrexx:ticket:type').setPlaceholder('اختر نوع التذكرة').addOptions(types.slice(0,25).map(t=>({label:t.name.slice(0,100),value:t.key,description:(t.description||t.name).slice(0,100),emoji:t.emoji||'🎫'}))))]:[new ActionRowBuilder().addComponents((()=>{const b=new ButtonBuilder().setCustomId('ayrexx:ticket:create').setLabel((c.ticketButtonLabel||'فتح تذكرة').slice(0,80)).setStyle(styles[c.ticketButtonColor]||ButtonStyle.Danger);if(c.ticketButtonEmoji)b.setEmoji(c.ticketButtonEmoji);return b;})())];
  await target.send({embeds:[e],components});
  return i.reply({content:'✅ تم نشر بانل التذاكر في '+target.toString(),ephemeral:true});
 }
 if((i.isButton()&&i.customId==='ayrexx:ticket:create')||(i.isStringSelectMenu()&&i.customId==='ayrexx:ticket:type')){
  const cfg=await store.get(i.guildId);
  const selected=i.isStringSelectMenu()?i.values[0]:'';
  const types=Array.isArray(cfg.ticketTypes)?cfg.ticketTypes:[];
  const type=types.find(t=>t.key===selected)||(types.length===1?types[0]:null);
  if(i.isStringSelectMenu()&&!type)return i.reply({content:'نوع التذكرة غير موجود؛ حدّث البانل.',ephemeral:true});
  const member=await i.guild.members.fetch(i.user.id);if(type?.blockedRoleIds?.some(id=>member.roles.cache.has(id)))return i.reply({content:'⛔ لا يمكنك فتح هذا النوع من التذاكر بسبب رتبتك.',ephemeral:true});if(type?.allowedRoleIds?.length&&!type.allowedRoleIds.some(id=>member.roles.cache.has(id)))return i.reply({content:'⛔ هذا النوع متاح لرتب محددة فقط.',ephemeral:true});const old=await store.findOpenTicket(i.guildId,i.user.id);if(old){const oldCh=await i.guild.channels.fetch(old.channelId).catch(()=>null);if(oldCh)return i.reply({content:'⚠️ عندك تذكرة مفتوحة بالفعل: **'+oldCh.name+'**',ephemeral:true});}
  await i.deferReply({ephemeral:true});
  const number=await store.nextTicketNumber(i.guildId),slug=String(number).padStart(4,'0');
  const category=type?.categoryId||cfg.ticketCategory||'',supportRole=type?.supportRoleId||cfg.ticketSupportRole||'';const rawName=(type?.namePattern||'ticket-{{ticket.number}}').replaceAll('{{ticket.number}}',slug).replaceAll('{{user.username}}',i.user.username.toLowerCase()).replaceAll('{{user.id}}',i.user.id).replaceAll('{{category.name}}',(type?.key||'support')).replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,90)||'ticket-'+slug;
  const perms=[{id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},{id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.AttachFiles]}];
  if(supportRole)perms.push({id:supportRole,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
  const ch=await i.guild.channels.create({name:rawName,type:ChannelType.GuildText,parent:category||undefined,permissionOverwrites:perms,topic:'Ayrexx ticket #'+slug+' | type:'+(type?.key||'support')+' | user:'+i.user.id});
  try{await store.createTicket({guildId:i.guildId,userId:i.user.id,channelId:ch.id,ticketNumber:number,ticketType:type?.key||'support'});}catch(e){await ch.delete().catch(()=>{});if(e.message==='OPEN_TICKET_EXISTS')return i.editReply('⚠️ عندك تذكرة مفتوحة بالفعل. حدّث القنوات وحاول تدخل تذكرتك الحالية.');throw e;}
  const intro=(type?.introMessage||'أهلًا {user}، {description}').replaceAll('{user}',i.user.toString()).replaceAll('{description}',type?.description||'اكتب تفاصيل طلبك هنا وسيقوم فريق الدعم بمساعدتك.').replaceAll('{ticket}',slug);const embed=new EmbedBuilder().setColor(0xC8102E).setTitle((type?.emoji||'🎫')+' '+(type?.name||'تذكرة دعم')).setDescription(intro).addFields({name:'رقم التذكرة',value:'#'+slug,inline:true},{name:'الحالة',value:'🟢 مفتوحة',inline:true}).setFooter({text:'Ayrexx Support • ISANO'}).setTimestamp();
  await ch.send({content:i.user.toString()+(supportRole?' <@&'+supportRole+'>':''),embeds:[embed],components:ticketRows({status:'open',claimedBy:''},true)});
  return i.editReply('✅ تم فتح تذكرتك بنجاح: **#'+slug+'** — ادخل قناة **'+ch.name+'** من قائمة القنوات.');
 }
 if(i.isButton()&&i.customId.startsWith('ayrexx:ticket:')){
  const x=await ctx(i);if(x.error)return i.reply({content:x.error,ephemeral:true});const {t,c,type,admin,owner}=x,action=i.customId.split(':').pop();
  if(action==='close'){
   if(!admin&&!owner)return i.reply({content:'⛔ صاحب التذكرة أو فريق الدعم فقط يمكنه إغلاقها.',ephemeral:true});
   if(t.status==='closed')return i.reply({content:'ℹ️ التذكرة مغلقة بالفعل.',ephemeral:true});
   await i.deferReply({ephemeral:true});
   const updated=await store.closeTicket(i.channelId,i.user.id);
   await i.channel.permissionOverwrites.edit(t.userId,{ViewChannel:true,SendMessages:false,ReadMessageHistory:true,AttachFiles:false});if(type?.closedCategoryId)await i.channel.setParent(type.closedCategoryId,{lockPermissions:false}).catch(e=>console.error('Closed category move failed:',e.message));
   const embed=new EmbedBuilder().setColor(0x777777).setTitle('🔒 تم إغلاق التذكرة').setDescription('أُغلقت التذكرة بواسطة '+i.user.toString()+'\\nيمكن لفريق الدعم إعادة فتحها أو حذفها بعد حفظ المحادثة.').setFooter({text:'Ayrexx • ISANO'}).setTimestamp();
   await i.message.edit({embeds:[embed],components:ticketRows(updated||{...t,status:'closed'},admin)});
   const log=c.ticketLogChannel?await i.guild.channels.fetch(c.ticketLogChannel).catch(()=>null):null;
   let transcript=' لم يتم حفظ Transcript تلقائيًا؛ استخدم زر Transcript بعد ضبط قناة السجلات.';
   if(log?.isTextBased()){try{await saveTranscript(i,log);transcript=' وتم حفظ Transcript تلقائيًا في قناة السجلات.';}catch(e){console.error('Button close transcript failed:',e.message);transcript=' لكن فشل حفظ Transcript تلقائيًا؛ راجع صلاحيات قناة السجلات.';}}
   return i.editReply('🔒 تم إغلاق التذكرة وتحديث أزرارها.'+transcript);
  }
  if(action==='reopen'){
   if(!admin)return i.reply({content:'⛔ إعادة الفتح متاحة لفريق الدعم والإدارة فقط.',ephemeral:true});
   if(t.status==='open')return i.reply({content:'ℹ️ التذكرة مفتوحة بالفعل.',ephemeral:true});
   await store.reopenTicket(i.channelId);await i.channel.permissionOverwrites.edit(t.userId,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,AttachFiles:true});if(type?.categoryId)await i.channel.setParent(type.categoryId,{lockPermissions:false}).catch(e=>console.error('Reopen category move failed:',e.message));
   const embed=new EmbedBuilder().setColor(0xC8102E).setTitle('🔓 تمت إعادة فتح التذكرة').setDescription('تمت إعادة فتحها بواسطة '+i.user.toString()+' ويمكن متابعة المحادثة.').setFooter({text:'Ayrexx • ISANO'}).setTimestamp();
   await i.message.edit({embeds:[embed],components:ticketRows({...t,status:'open'},admin)});
   return i.reply({content:'✅ تم إعادة فتح التذكرة.',ephemeral:true});
  }
  if(action==='claim'){
   if(!admin)return i.reply({content:'⛔ لفريق الدعم فقط.',ephemeral:true});
   if(t.status==='closed')return i.reply({content:'لا يمكن استلام تذكرة مغلقة.',ephemeral:true});
   if(t.claimedBy)return i.reply({content:'التذكرة مستلمة بالفعل بواسطة <@'+t.claimedBy+'>.',ephemeral:true});
   await store.updateTicket(i.channelId,{claimedBy:i.user.id});
   await i.message.edit({components:ticketRows({...t,claimedBy:i.user.id},admin)});
   return i.reply({content:'🙋 تم استلام التذكرة بواسطة '+i.user.toString()+'.'});
  }
  if(action==='unclaim'){
   if(!admin)return i.reply({content:'⛔ لفريق الدعم فقط.',ephemeral:true});
   if(t.claimedBy&&t.claimedBy!==i.user.id&&!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:'فقط مستلم التذكرة أو الإدارة يمكنه إلغاء الاستلام.',ephemeral:true});
   await store.updateTicket(i.channelId,{claimedBy:''});await i.message.edit({components:ticketRows({...t,claimedBy:''},admin)});
   return i.reply({content:'↩️ تم إلغاء استلام التذكرة.'});
  }
  if(action==='transcript'){
   if(!admin)return i.reply({content:'⛔ تصدير المحادثة لفريق الدعم فقط.',ephemeral:true});
   const log=c.ticketLogChannel?await i.guild.channels.fetch(c.ticketLogChannel).catch(()=>null):null;
   if(!log?.isTextBased())return i.reply({content:'⚠️ حدد قناة سجلات التذاكر من لوحة التحكم أولًا.',ephemeral:true});
   await i.deferReply({ephemeral:true});await saveTranscript(i,log);return i.editReply('📄 تم حفظ ملف Transcript في قناة السجلات.');
  }
  if(action==='delete'){
   if(!admin)return i.reply({content:'⛔ الحذف لفريق الدعم والإدارة فقط.',ephemeral:true});
   if(t.status!=='closed')return i.reply({content:'اقفل التذكرة أولًا قبل حذفها.',ephemeral:true});
   const log=c.ticketLogChannel?await i.guild.channels.fetch(c.ticketLogChannel).catch(()=>null):null;
   if(!log?.isTextBased())return i.reply({content:'⚠️ حدد قناة سجلات التذاكر أولًا لحفظ المحادثة قبل الحذف.',ephemeral:true});
   await i.deferReply({ephemeral:true});await saveTranscript(i,log);await log.send('🗑️ تم حذف **'+i.channel.name+'** بواسطة '+i.user.toString()+'.');await i.editReply('📄 تم حفظ Transcript. جارٍ حذف القناة...');await i.channel.delete('Ayrexx ticket deleted after transcript');await store.deleteTicket(i.channelId);return true;
  }
 }
 if(i.isChatInputCommand()&&['close','ticket-reopen','ticket-claim','ticket-unclaim','ticket-transcript','ticket-info','ticket-add','ticket-remove','ticket-rename','ticket-delete'].includes(i.commandName)){
  const x=await ctx(i);if(x.error)return i.reply({content:x.error,ephemeral:true});const {t,c,type,admin,owner}=x,cmd=i.commandName;
  if(cmd==='close'){if(!admin&&!owner)return i.reply({content:'⛔ صاحب التذكرة أو الدعم فقط.',ephemeral:true});if(t.status==='closed')return i.reply({content:'مغلقة بالفعل.',ephemeral:true});await i.deferReply({ephemeral:true});const updated=await store.closeTicket(i.channelId,i.user.id);await i.channel.permissionOverwrites.edit(t.userId,{ViewChannel:true,SendMessages:false,ReadMessageHistory:true,AttachFiles:false});await syncTicketMessage(i.channel,updated||{...t,status:'closed'},i.user.id,admin);const log=c.ticketLogChannel?await i.guild.channels.fetch(c.ticketLogChannel).catch(()=>null):null;let transcript='';if(log?.isTextBased()){try{await saveTranscript(i,log);transcript=' وتم حفظ Transcript في السجلات.';}catch(e){console.error('Auto transcript failed:',e.message);transcript=' لكن تعذر حفظ Transcript؛ راجع صلاحيات قناة السجلات.';}}return i.editReply('🔒 تم إغلاق التذكرة وتحديث أزرارها.'+transcript);}
  if(cmd==='ticket-info'){if(!admin&&!owner)return i.reply({content:'صاحب التذكرة أو فريق الدعم فقط.',ephemeral:true});const info=new EmbedBuilder().setColor(0xC8102E).setTitle('معلومات التذكرة').addFields({name:'الرقم',value:'#'+String(t.ticketNumber||0).padStart(4,'0'),inline:true},{name:'الحالة',value:t.status==='open'?'مفتوحة':'مغلقة',inline:true},{name:'صاحب التذكرة',value:'<@'+t.userId+'>',inline:true},{name:'المستلم',value:t.claimedBy?'<@'+t.claimedBy+'>':'غير مستلمة',inline:true},{name:'تاريخ الإنشاء',value:t.createdAt?'<t:'+Math.floor(new Date(t.createdAt).getTime()/1000)+':F>':'غير متاح',inline:false});return i.reply({embeds:[info],ephemeral:true});}
  if(!admin)return i.reply({content:'الأمر لفريق الدعم والإدارة فقط.',ephemeral:true});
  if(cmd==='ticket-claim'||cmd==='ticket-unclaim'){if(t.status!=='open')return i.reply({content:'لا يمكن تغيير الاستلام والتذكرة مغلقة.',ephemeral:true});if(cmd==='ticket-unclaim'&&t.claimedBy&&t.claimedBy!==i.user.id&&!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:'فقط المستلم أو الإدارة يمكنه إلغاء الاستلام.',ephemeral:true});if(cmd==='ticket-claim'&&t.claimedBy)return i.reply({content:'التذكرة مستلمة بالفعل.',ephemeral:true});const claimedBy=cmd==='ticket-claim'?i.user.id:'';const updated=await store.updateTicket(i.channelId,{claimedBy});await syncTicketMessage(i.channel,updated||{...t,claimedBy},i.user.id);return i.reply(cmd==='ticket-claim'?'🙋 تم استلام التذكرة وتحديث الزر.':'↩️ تم إلغاء الاستلام وتحديث الزر.');}
  if(cmd==='ticket-reopen'){if(t.status!=='closed')return i.reply({content:'التذكرة مفتوحة بالفعل.',ephemeral:true});const updated=await store.reopenTicket(i.channelId);await i.channel.permissionOverwrites.edit(t.userId,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,AttachFiles:true});await syncTicketMessage(i.channel,updated||{...t,status:'open'},i.user.id);return i.reply('🔓 تمت إعادة فتح التذكرة وتحديث الأزرار.');}
  if(cmd==='ticket-transcript'){const log=c.ticketLogChannel?await i.guild.channels.fetch(c.ticketLogChannel).catch(()=>null):null;if(!log?.isTextBased())return i.reply({content:'حدد قناة السجلات أولًا.',ephemeral:true});await i.deferReply({ephemeral:true});await saveTranscript(i,log);return i.editReply('📄 تم إرسال Transcript إلى قناة السجلات.');}
  if(cmd==='ticket-add'||cmd==='ticket-remove'){const m=i.options.getMember('member');if(!m)return i.reply({content:'العضو غير موجود.',ephemeral:true});await i.channel.permissionOverwrites.edit(m.id,cmd==='ticket-add'?{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}:{ViewChannel:false});return i.reply(cmd==='ticket-add'?'✅ تمت إضافة العضو.':'✅ تمت إزالة العضو.');}
  if(cmd==='ticket-rename'){const name=i.options.getString('name').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,90);if(!name)return i.reply({content:'اسم غير صالح.',ephemeral:true});await i.channel.setName(name);return i.reply('✅ تم تغيير اسم التذكرة.');}
  if(cmd==='ticket-delete'){if(t.status!=='closed')return i.reply({content:'اقفل التذكرة أولًا قبل حذفها.',ephemeral:true});const log=c.ticketLogChannel?await i.guild.channels.fetch(c.ticketLogChannel).catch(()=>null):null;if(!log?.isTextBased())return i.reply({content:'حدد قناة السجلات أولًا.',ephemeral:true});await i.deferReply({ephemeral:true});await saveTranscript(i,log);await log.send('🗑️ تم حذف **'+i.channel.name+'** بواسطة '+i.user.toString()+'.');await i.editReply('📄 تم حفظ Transcript. جارٍ حذف القناة...');await i.channel.delete('Ayrexx ticket deleted');await store.deleteTicket(i.channelId);return true;}
 }
 return false;
}
module.exports={commands,handleTicketInteraction};
