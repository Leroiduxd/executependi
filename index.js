import express from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const abi = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "orderId", "type": "uint256" },
      { "internalType": "bytes", "name": "proof", "type": "bytes" }
    ],
    "name": "executePendingOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "orderId", "type": "uint256" }
    ],
    "name": "getPendingOrder",
    "outputs": [
      { "internalType": "uint256", "name": "orderId", "type": "uint256" },
      { "internalType": "uint256", "name": "assetIndex", "type": "uint256" },
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

app.post('/run', async (req, res) => {
  const { orderId, index } = req.body;

  if (orderId === undefined || index === undefined) {
    return res.status(400).json({ error: 'Missing orderId or index' });
  }

  try {
    console.log('🔍 Vérification de l’ordre avec orderId:', orderId);
    let orderInfo;
    try {
      orderInfo = await contract.getPendingOrder(orderId);
      console.log('✅ Ordre trouvé pour l’utilisateur :', orderInfo.user);
    } catch (err) {
      console.error('❌ Impossible de récupérer l’ordre :', err.message);
      return res.status(404).json({ error: 'Order not found or not accessible' });
    }

    console.log('📡 Récupération de la preuve pour index:', index);
    const response = await fetch('https://proof-production.up.railway.app/get-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index })
    });

    const data = await response.json();

    if (!data.proof_bytes) {
      console.error('❌ Preuve invalide ou absente');
      return res.status(502).json({ error: 'Invalid proof data returned from oracle' });
    }

    const proof = data.proof_bytes;
    console.log('📦 Preuve récupérée. Taille :', proof.length);

    console.log('🚀 Envoi de la transaction executePendingOrder...');
    const tx = await contract.executePendingOrder(orderId, proof);
    await tx.wait();

    console.log('✅ Transaction confirmée :', tx.hash);
    res.json({ status: 'success', txHash: tx.hash });
  } catch (error) {
    console.error('🔥 Erreur pendant l’exécution :', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));

