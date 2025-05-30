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
  const { orderId, assetIndex } = req.body;

  if (orderId === undefined || assetIndex === undefined) {
    return res.status(400).json({ error: 'Missing orderId or assetIndex' });
  }

  try {
    console.log("Received request to execute order");
    console.log("orderId:", orderId);
    console.log("assetIndex:", assetIndex);

    const proofResponse = await fetch('https://proof-production.up.railway.app/get-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: assetIndex })
    });

    const proofData = await proofResponse.json();

    if (!proofData.proof_bytes) {
      console.error("Invalid proof response from oracle:", proofData);
      return res.status(500).json({ error: 'Invalid proof response', data: proofData });
    }

    const proof = proofData.proof_bytes;

    console.log("Proof length:", proof.length);
    console.log("Proof preview:", proof.slice(0, 80));

    const tx = await contract.executePendingOrder(orderId, proof);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();

    res.json({ status: 'success', txHash: tx.hash });
  } catch (error) {
    console.error("Error during transaction:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
