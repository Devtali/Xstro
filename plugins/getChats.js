import { bot } from '#lib';
import {
	getChatSummary,
	getGroupMembersMessageCount,
	getGroupMetadata,
	getInactiveGroupMembers,
} from '#sql';

bot(
	{
		pattern: 'chatsdm',
		public: false,
		desc: 'Get direct messages summary',
		type: 'user',
	},
	async message => {
		const allChats = await getChatSummary();
		const dmChats = allChats.filter(
			chat =>
				!chat.jid.endsWith('@g.us') &&
				!chat.jid.endsWith('@newsletter') &&
				chat.jid !== 'status@broadcast' &&
				chat.jid !== message.user,
		);

		if (dmChats.length === 0) {
			return message.send('```No direct messages found.```');
		}

		const mentionJids = dmChats.map(chat => chat.jid);
		const formattedChats = dmChats.map(
			(chat, index) =>
				`${index + 1}. FROM: @${chat.jid.split('@')[0]}
Messages: ${chat.messageCount}
Last Message: ${new Date(chat.lastMessageTimestamp).toLocaleString()}`,
		);

		message.send(
			`\`\`\`DM Chats:\n\n${formattedChats.join('\n\n')}\`\`\``,
			{ mentions: mentionJids },
		);
	},
);

bot(
	{
		pattern: 'chatsgc',
		public: false,
		desc: 'Get group chats summary',
		type: 'user',
	},
	async message => {
		const allChats = await getChatSummary();
		const groupChats = allChats.filter(chat =>
			chat.jid.endsWith('@g.us'),
		);

		if (groupChats.length === 0) {
			return message.send('```No group chats found.```');
		}

		const formattedChats = await Promise.all(
			groupChats.map(async (chat, index) => {
				try {
					const groupMetadata = await getGroupMetadata(chat.jid);
					return `GROUP: ${
						groupMetadata?.subject || 'Unknown Group'
					}
Messages: ${chat.messageCount}
Last Message: ${new Date(chat.lastMessageTimestamp).toLocaleString()}`;
				} catch (error) {
					return `GROUP: Unknown Group
Messages: ${chat.messageCount}
Last Message: ${new Date(chat.lastMessageTimestamp).toLocaleString()}`;
				}
			}),
		);

		message.send(
			`\`\`\`Group Chats:\n\n${formattedChats.join('\n\n')}\`\`\``,
		);
	},
);
bot(
	{
		pattern: 'gactive',
		public: true,
		isGroup: true,
		desc: 'Return the Active Group Members from when the bot started running',
		type: 'user',
	},
	async message => {
		const groupData = await getGroupMembersMessageCount(message.jid);
		if (groupData.length === 0)
			return await message.send('No active members found.');
		let responseMessage = '🏆 Most Active Group Members\n\n';
		groupData.forEach((member, index) => {
			responseMessage += `${index + 1}. ${member.name}\n`;
			responseMessage += `   • Messages: ${member.messageCount}\n`;
		});

		await message.send(`\`\`\`${responseMessage}\`\`\``);
	},
);

bot(
	{
		pattern: 'inactive',
		public: true,
		isGroup: true,
		desc: 'Get the inactive group members from a group',
		type: 'user',
	},
	async message => {
		const groupData = await getInactiveGroupMembers(message.jid);
		if (groupData.length === 0)
			return await message.reply(
				'*📊 Inactive Members:* No inactive members found.',
			);
		let responseMessage = '📊 Inactive Members:\n\n';
		responseMessage += `Total Inactive: ${groupData.length}\n\n`;
		groupData.forEach((jid, index) => {
			responseMessage += `${index + 1}. @${jid.split('@')[0]}\n`;
		});
		await message.send(`\`\`\`${responseMessage}\`\`\``, {
			mentions: groupData,
		});
	},
);
