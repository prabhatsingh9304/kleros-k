const ethers = require("ethers");
const contractABI = require("./abi.json");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY;
const contractAddress = "0x6fAa06495E7F9D1C2123eD66E97F42E5C9Dc4A55"; // test
//const contractAddress = "0x7D3a625977bFD7445466439E60C495bdc2855367";
let lastProcessedBlockNumber = 0;
let deliverableBlockNumber = 0;
let count = 0;

async function initializeProvider() {
  try {
    const provider = new ethers.providers.WebSocketProvider(
      process.env.INFURA_URL
    );

    // Attach an error event listener to handle network errors
    provider.on("error", (error) => {
      console.error(`WebSocketProvider error: ${error.message}`);
    });

    await provider.getNetwork(); // Check if the connection is successful
    return provider;
  } catch (error) {
    console.error(`Error initializing WebSocket provider: ${error.message}`);
    return null; // Return null to indicate initialization failure
  }
}

async function getValidNonce(wallet) {
  try {
    let nonce = await wallet.getTransactionCount();

    // Check if there are pending transactions with the same nonce
    const pendingTxs = await wallet.provider.getTransactionCount(
      wallet.address,
      "pending"
    );

    while (pendingTxs > nonce) {
      nonce++;
    }

    return nonce;
  } catch (error) {
    console.error(`Error getting valid nonce: ${error.message}`);
    throw error; // Rethrow the error for the caller to handle
  }
}

async function submitPongTransaction(contract, wallet, txHash, nonce) {
  try {
    const tx = await contract.connect(wallet).pong(txHash, { nonce });
    const receipt = await tx.wait();
    //Store the block number for deliverable
    if (count < 1) {
      deliverableBlockNumber = receipt.blockNumber;
      count++;
    }
    console.log(`Pong transaction mined in block ${receipt.blockNumber}`);
  } catch (error) {
    console.error(`Error submitting pong transaction: ${error.message}`);
  }
}

async function processPingEvent(txHash, contract, wallet) {
  try {
    console.log(`Processing Ping event in transaction: ${txHash}`);

    // Call the pong() function with the hash of the transaction and correct nonce
    const nonce = await getValidNonce(wallet);
    await submitPongTransaction(contract, wallet, txHash, nonce);

    console.log(`Pong function called successfully for transaction: ${txHash}`);
  } catch (error) {
    console.error(`Error processing Ping event: ${error.message}`);
  }
}

async function main() {
  try {
    const provider = await initializeProvider();

    if (!provider) {
      // If initialization fails, wait and restart the server
      console.log("Restarting server in 5 seconds...");
      setTimeout(main, 5000);
      return;
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    // Rest of your main logic
    contract.on("Ping", async (tx) => {
      const newBlockNumber = tx.blockNumber;
      const txHash = tx.transactionHash;

      // Check if the event is from a block after the last processed block
      if (newBlockNumber > lastProcessedBlockNumber) {
        await processPingEvent(txHash, contract, wallet);
        lastProcessedBlockNumber = newBlockNumber;
      }
    });
  } catch (error) {
    console.error(`Main error: ${error.message}`);
    // Restart the server after a delay
    console.log("Restarting server in 5 seconds...");
    setTimeout(main, 5000); // Retry every 5 seconds
  }
}

main();
