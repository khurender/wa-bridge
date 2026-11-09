const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true // Render logs me QR code print hoga
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- SCAN THIS QR CODE IN WHATSAPP ---');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp Connected Successfully!');
        }
    });
}

connectToWhatsApp();

// Message send karne ka API endpoint
app.post('/send-message', async (req, res) => {
    try {
        const { groupInviteCode, message } = req.body;
        if (!sock) {
            return res.status(500).json({ error: 'WhatsApp socket not ready' });
        }

        // Invite code se group JID nikalna
        const groupInfo = await sock.groupGetInviteInfo(groupInviteCode);
        if (!groupInfo || !groupInfo.id) {
            return res.status(400).json({ error: 'Invalid group invite code' });
        }

        // Group me message bhejna
        await sock.sendMessage(groupInfo.id, { text: message });
        res.json({ success: true, groupId: groupInfo.id });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('WhatsApp Gateway is Running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
