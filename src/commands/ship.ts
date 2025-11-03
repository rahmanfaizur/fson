import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';

function getQuote(percentage: number): string {
    if (percentage < 10) return "Not a great match, it seems... 😬";
    if (percentage < 30) return "There might be a small spark! ✨";
    if (percentage < 50) return "Hmm, possibilities are brewing. 🤔";
    if (percentage < 70) return "A pretty good match! 😊";
    if (percentage < 90) return "Wow, things are heating up! 🔥";
    return "It's a perfect match! ❤️";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Calculates a ship percentage between two users.')
        .addUserOption(option =>
            option.setName('user1')
                .setDescription('The first user')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user2')
                .setDescription('The second user')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        if (!interaction.isChatInputCommand()) return;

        await interaction.deferReply();

        const user1 = interaction.options.getUser('user1')!;
        const user2 = interaction.options.getUser('user2')!;

        const percentage = Math.floor(Math.random() * 101);
        const quote = getQuote(percentage);

        const canvas = createCanvas(700, 250);
        const ctx = canvas.getContext('2d');

        // Cute gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#ff9a9e');
        gradient.addColorStop(1, '#fad0c4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw circular avatars with borders
        const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(125, 125, 75, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.drawImage(avatar1, 50, 50, 150, 150);
        ctx.restore();

        const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(575, 125, 80, 0, Math.PI * 2, true);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(575, 125, 75, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.drawImage(avatar2, 500, 50, 150, 150);
        ctx.restore();
        
        // Heart
        ctx.font = '100px sans-serif';
        ctx.fillStyle = '#E83F3F';
        ctx.textAlign = 'center';
        ctx.fillText('❤', canvas.width / 2, 155);

        // Percentage text with shadow
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 40px sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(`${percentage}%`, canvas.width / 2, 145);
        ctx.shadowColor = 'transparent'; // Reset shadow

        // Quote text
        ctx.font = '20px sans-serif';
        ctx.fillText(quote, canvas.width / 2, 220);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'ship-image.png' });
        const shipMessage = `${user1} 💕 ${user2}`;

        await interaction.editReply({ content: shipMessage, files: [attachment] });
    },
};
