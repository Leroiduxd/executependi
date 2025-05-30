require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const abi = JSON.parse(fs.readFileSync('abi.json'));

// Connect with custom chainId for Pharos (686000)
const customNetwork = {
  chainId: 688688,
  name: 'pharos-testnet'
};

const provider = new ethers.providers.JsonRpcProvider({
  url: RPC_URL,
  skipFetchSetup: true
}, customNetwork);

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

app.get('/execute-all', async (req, res) => {
  try {
    const result = await contract.getAllPendingOrders();
    const orderIds = result[0];
    const assetIndexes = result[2];

    const executions = [];

    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i];
      const assetIndex = assetIndexes[i].toNumber();

      const response = await axios.post('https://proof-production.up.railway.app/get-proof', {
        index: assetIndex
      });

      const proof = response.data.proof_bytes;

      const tx = await contract.executePendingOrder(orderId, proof);
      await tx.wait();

      executions.push({
        orderId: orderId.toString(),
        txHash: tx.hash
      });
    }

    res.json({ status: 'success', executed: executions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Execution failed', message: err.message });
  }
});

app.listen(port, () => {
  console.log(`Executor server running on port ${port}`);
});
