import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Events, Message, TextChannel } from 'discord.js';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { initializeDatabase, addMessage, getHistory } from './database';

// Initialize the database when the bot starts
initializeDatabase();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

const commands = new Collection<string, any>();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    commands.set(command.data.name, command);
}

client.once(Events.ClientReady, () => {
    if (client.user) {
        console.log(`Logged in as ${client.user.tag}`);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user!.id)) return;

    const userPrompt = message.content.replace(/<@!?\d+>/, '').trim();
    const userId = message.author.id;

    if (!userPrompt) {
        await message.reply({ content: "You need to say something to me!" });
        return;
    }
    
    if (!process.env.GOOGLE_API_KEY) {
        await message.reply({ content: 'The AI is not configured on this bot. Missing API Key.' });
        return;
    }

    try {
        if (message.channel instanceof TextChannel) {
            await message.channel.sendTyping();
        }
        console.log('Chat request:', userPrompt.substring(0, 200) + '...');

        // Save user's message to the database
        await addMessage(userId, 'user', userPrompt);
        
        // Retrieve conversation history from the database
        const history = await getHistory(userId);

        const systemInstruction = {
            role: "user",
            parts: [{
              text: `You are FSON — a friendly, upbeat, and kind chatbot. 
          You speak with a warm, lively tone that feels natural and human. 
          CRITICAL: Keep your replies VERY SHORT — maximum 1-2 sentences. Be concise and to the point. 
          You listen actively, respond thoughtfully, and keep the conversation light and fun. 
          You're curious, supportive, and have a great sense of humor, but never sarcastic or over-the-top. 
          DO NOT use emojis. Never use emojis in your responses. Communicate warmth through your words only.
          Always stay cheerful, safe, and respectful while making the user feel good and understood.`
            }]
          };
          
          const modelGreeting = {
            role: "model",
            parts: [{
              text: "Hey there! I'm FSON. What's up?"
            }]
          };
          

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-goog-api-key": process.env.GOOGLE_API_KEY,
                },
                method: "POST",
                body: JSON.stringify({
                    contents: [
                        systemInstruction,
                        modelGreeting,
                        ...history
                    ],
                    generationConfig: {
                        temperature: 0.8,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 100,
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            throw new Error(`Gemini API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{
                        text?: string;
                    }>;
                };
                finishReason?: string;
            }>;
            error?: {
                code: number;
                message: string;
            };
        };

        if (data.error) {
            console.error('Gemini API error:', data.error);
            throw new Error(`Gemini API error: ${data.error.message}`);
        }
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response generated from Gemini API');
        }

        const candidate = data.candidates[0];
        if (candidate.finishReason === 'SAFETY') {
            await message.reply({ content: "I'm sorry, but I can't respond to that. It seems to have triggered my safety filters. Let's talk about something else!" });
            return;
        }

        const text = candidate.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Empty response from Gemini API');
        }

        // Save bot's response to the database
        await addMessage(userId, 'model', text);

        await message.reply({ content: text });

    } catch (error) {
        console.error('Error executing chat command:', error);
        await message.reply({ content: 'Something went wrong while talking to the AI. Please try again later.' });
    }
});

// Setup Express server for healthcheck
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        discord: client.isReady() ? 'connected' : 'disconnected'
    });
});

app.listen(PORT, () => {
    console.log(`Healthcheck server running on port ${PORT}`);
});

client.login(process.env.TOKEN);