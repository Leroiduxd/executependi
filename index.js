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
  }
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

app.post('/run', async (req, res) => {
  const { orderId, index } = req.body;

  if (orderId === undefined || index === undefined) {
    return res.status(400).json({ error: 'Missing orderId or index' });
  }

  try {
    const response = await fetch('https://proof-production.up.railway.app/get-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index })
    });

    const data = await response.json();

    if (!data.proof_bytes) {
      return res.status(500).json({ error: 'Failed to fetch proof from external API' });
    }

    const proof = data.proof_bytes;
    const tx = await contract.executePendingOrder(orderId, proof);
    await tx.wait();

    res.json({ status: 'success', txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
