import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, AttachmentBuilder } from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('generate-image')
        .setDescription('Generates an image using AI based on a prompt.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The text prompt for the image generation')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        if (!interaction.isChatInputCommand()) return;

        await interaction.deferReply();

        const prompt = interaction.options.getString('prompt')!;

        if (!process.env.GOOGLE_API_KEY) {
            await interaction.editReply({ content: 'The AI is not configured on this bot. Missing API Key.' });
            return;
        }

        try {
            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-goog-api-key": process.env.GOOGLE_API_KEY,
                    },
                    method: "POST",
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            responseMimeType: "application/json",
                        }
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini API error:', errorText);
                throw new Error(`Gemini API error: ${response.status} ${errorText}`);
            }

            const data = await response.json() as any;

            if (data.error) {
                console.error('Gemini API error:', data.error);
                throw new Error(`Gemini API error: ${data.error.message}`);
            }
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('No response generated from Gemini API');
            }

            const candidate = data.candidates[0];
            if (candidate.finishReason === 'SAFETY') {
                await interaction.editReply({ content: "I'm so sorry, but I can't generate that. It seems to have triggered my safety filters. Let's try something else! 😊" });
                return;
            }

            const imagePart = candidate.content?.parts?.[0];

            if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
                throw new Error('Empty or invalid image response from Gemini API');
            }

            const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'generated-image.png' });

            await interaction.editReply({ content: `Here is the generated image for: "${prompt}"`, files: [attachment] });

        } catch (error) {
            console.error('Error executing image generation command:', error);
            await interaction.editReply({ content: 'Oh no! Something went wrong while generating the image. Please try again later. 😿' });
        }
    },
};
