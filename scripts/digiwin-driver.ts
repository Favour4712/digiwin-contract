
/**
 * DigiWin driver script
 *      -- run the script with --
 *  npx tsx scripts/digiwin-driver.ts
 *
 * or with options:
 *
 *  npx tsx scripts/digiwin-driver.ts --fast (ignores the delay time set)
 *  npx tsx scripts/digiwin-driver.ts --mode=create (create new games random intervals)
 *  npx tsx scripts/digiwin-driver.ts --mode=guess (guess on latest game random intervals)
 *  npx tsx scripts/digiwin-driver.ts --mode=info (check contract info)
 *  npx tsx scripts/digiwin-driver.ts --mode=full (alternating create and guess)
 *
 * - Reads the deployer "mnemonic" from settings/Mainnet.toml
 * - Derives the account private key
 * - Interacts with the deployed mainnet contract:
 *     SP1WEKNK5SGNTYM0J8M34FMBM7PTRJSYRWY9C1CGR.digiwin
 * - Modes:
 *     create: Continuously creates random games with random delays
 *     guess: Continuously guesses on valid active games with random delays
 *     info: Checks number of games and last game info
 *     full: Runs creating games and guessing
 * - Waits a random interval between each call:
 *     40s, 60s, 120s
 *
 * Usage:
 *   - Ensure you have installed dependencies: npm install
 *   - Run with tsx
 *   - By default, this script resolves settings/Mainnet.toml relative to this file
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createNetwork, TransactionVersion } from "@stacks/network";
import {
  AnchorMode,
  PostConditionMode,
  makeContractCall,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  cvToString,
  uintCV,
  principalCV,
} from "@stacks/transactions";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import * as TOML from "toml";

type NetworkSettings = {
  network?: {
    name?: string;
    stacks_node_rpc_address?: string;
    deployment_fee_rate?: number;
  };
  accounts?: {
    deployer?: {
      mnemonic?: string;
    };
  };
};

const CONTRACT_ADDRESS = "SP1WEKNK5SGNTYM0J8M34FMBM7PTRJSYRWY9C1CGR";
const CONTRACT_NAME = "digiwin"; 

// Function names in digiwin.clar
const FN_CREATE_GAME = "create-game";
const FN_GUESS = "guess";
const FN_GET_TOTAL_GAMES = "get-total-games";
const FN_GET_GAME_INFO = "get-game-info";

// Reasonable default fee in microstacks for contract-call
const DEFAULT_FEE_USTX = 50000; // slightly higher for robust inclusion

// Parse command-line arguments
const FAST = process.argv.includes("--fast");
const MODE =
  process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ||
  "info";

// Random delay choices (milliseconds)
let DELAY_CHOICES_MS = [
  40_000, // 40 sec
  60_000, // 1 min
  120_000, // 2 min
];
if (FAST) {
  // Shorten delays for a quick smoke run
  DELAY_CHOICES_MS = [1_000, 2_000, 5_000];
}

// Helper to get current file dir (ESM-compatible)
function thisDirname(): string {
  const __filename = fileURLToPath(import.meta.url);
  return path.dirname(__filename);
}

async function readMainnetMnemonic(): Promise<string> {
  const baseDir = thisDirname();
  // Resolve ../settings/Mainnet.toml relative to scripts/ folder
  const settingsPath = path.resolve(baseDir, "../settings/Mainnet.toml");

  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = TOML.parse(raw) as NetworkSettings;

    const mnemonic = parsed?.accounts?.deployer?.mnemonic;
    if (!mnemonic || mnemonic.includes("<YOUR PRIVATE MAINNET MNEMONIC HERE>")) {
      throw new Error(
        `Mnemonic not found in ${settingsPath}. Please set [accounts.deployer].mnemonic.`
      );
    }
    return mnemonic.trim();
  } catch (e) {
      console.warn("Could not read settings/Mainnet.toml, trying env var MNEMONIC...");
      if (process.env.MNEMONIC) return process.env.MNEMONIC;
      throw e;
  }
}

async function deriveSenderFromMnemonic(mnemonic: string) {
  // Note: generateWallet accepts the 12/24-word secret phrase via "secretKey"
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });
  const account = wallet.accounts[0];

  function normalizeSenderKey(key: string): string {
    let k = (key || "").trim();
    if (k.startsWith("0x") || k.startsWith("0X")) k = k.slice(2);
    return k;
  }

  const rawKey = account.stxPrivateKey || "";
  const senderKey = normalizeSenderKey(rawKey); // hex private key string, no 0x prefix

  const senderAddress = getStxAddress({
    account,
    transactionVersion: TransactionVersion.Mainnet,
  });

  // Debug: key length (do not print full key)
  console.log(
    `Derived sender key length: ${senderKey.length} hex chars (address: ${senderAddress})`
  );

  return { senderKey, senderAddress };
}

function pickRandomDelayMs(): number {
  const i = Math.floor(Math.random() * DELAY_CHOICES_MS.length);
  return DELAY_CHOICES_MS[i];
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) {
      clearTimeout(timer);
      return reject(new Error("aborted"));
    }
    signal?.addEventListener("abort", onAbort);
  });
}

async function readTotalGames(network: any, senderAddress: string): Promise<number> {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
      try {
          const res = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: FN_GET_TOTAL_GAMES,
            functionArgs: [],
            network,
            senderAddress,
          });
          if (res.type === 1) { // UInt
               return Number(res.value);
          }
          return 0; 
      } catch (e) {
          console.warn(`readTotalGames attempt ${i+1}/${maxRetries} failed: ${(e as Error).message}`);
          if (i < maxRetries - 1) await delay(2000);
      }
  }
  throw new Error("Failed to read total games after multiple attempts");
}

async function readGameInfo(
  network: any,
  senderAddress: string,
  gameId: number
) {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
      try {
          const res = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: FN_GET_GAME_INFO,
            functionArgs: [uintCV(gameId)],
            network,
            senderAddress,
          });
          return cvToString(res);
      } catch (e) {
           console.warn(`readGameInfo attempt ${i+1}/${maxRetries} failed: ${(e as Error).message}`);
           if (i < maxRetries - 1) await delay(2000);
      }
  }
  return "Error: failed to read game info";
}


async function contractCall(
  network: any,
  senderKey: string,
  functionName: string,
  functionArgs: any[] = []
) {
  console.log(
    `Preparing contract-call tx for: ${functionName}${
      functionArgs.length > 0 ? " with args" : ""
    }`
  );

  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
        try {
            const tx = await makeContractCall({
                contractAddress: CONTRACT_ADDRESS,
                contractName: CONTRACT_NAME,
                functionName,
                functionArgs,
                network,
                senderKey,
                fee: DEFAULT_FEE_USTX,
                anchorMode: AnchorMode.Any,
                postConditionMode: PostConditionMode.Allow,
            });

            const resp = await broadcastTransaction({ transaction: tx, network });
            const txid =
              typeof resp === "string"
                ? resp
                : (resp as any).txid ||
                  (resp as any).transactionId ||
                  (resp as any).txId ||
                  (resp as any).tx_id ||
                  "unknown-txid";
            
            if ((resp as any).error) { 
                throw new Error((resp as any).error + " - " + (resp as any).reason);
            }
            
            console.log(`Broadcast response for ${functionName}: ${txid}`);
            return txid;
        } catch (e: any) {
             const reason =
              e?.message ||
              e?.response?.error ||
              e?.response?.reason ||
              e?.responseText ||
              "unknown-error";
            console.warn(`Attempt ${i+1}/${maxRetries} failed for ${functionName}: ${reason}`);
            if (i < maxRetries - 1) await delay(2000);
        }
  }
  throw new Error(`Broadcast failed for ${functionName} after ${maxRetries} attempts`);
}

async function runCreateMode(
  network: any,
  senderKey: string,
  stopSignal: AbortSignal
) {
  console.log("Running in CREATE mode: will create games continuously");
  let keepRunning = true;
  let iteration = 0;

  

  stopSignal.addEventListener("abort", () => {
    keepRunning = false;
  });

  while (keepRunning) {
    iteration++;
    const functionName = FN_CREATE_GAME;

    const waitMs = pickRandomDelayMs();
    const seconds = Math.round(waitMs / 1000);
    console.log(`Waiting ~${seconds}s before next call (${functionName})...`);
    try {
      await delay(waitMs, stopSignal);
    } catch {
      break;
    }

    // Settings: 1 to 100, Fee 0.1 STX (100000 uSTX)
    const min = 1;
    const max = 100;
    const fee = 100000;
    
    console.log(`Calling ${functionName} (#${iteration})...`);
    
    try {
        await contractCall(network, senderKey, functionName, [
            uintCV(min), uintCV(max), uintCV(fee)
        ]);
        // contractCall logs success
    } catch (err) {
        console.warn(`Failed to broadcast ${functionName}:`, err);
    }
  }
}

async function runGuessMode(
  network: any,
  senderKey: string,
  senderAddress: string,
  stopSignal: AbortSignal
) {
  console.log("Running in GUESS mode: will guess on latest game continuously");
  let keepRunning = true;
  
  stopSignal.addEventListener("abort", () => {
    keepRunning = false;
  });

  while (keepRunning) {
    const waitMs = pickRandomDelayMs();
    console.log(`Waiting ~${Math.round(waitMs / 1000)}s before next guess...`);
    try {
        await delay(waitMs, stopSignal);
    } catch {
        break;
    }

    // Get latest game ID
    try {
        const total = await readTotalGames(network, senderAddress);
        if (total === 0) {
            console.log("No games found yet. Waiting...");
            continue;
        }
        
        const gameId = total - 1; 
        
        // Random guess between 1 and 100
        const guessNum = Math.floor(Math.random() * 100) + 1;
        
        console.log(`Guessing ${guessNum} on Game ID ${gameId}...`);
        
        await contractCall(network, senderKey, FN_GUESS, [
            uintCV(gameId), uintCV(guessNum)
        ]);
        
    } catch (e) {
        console.warn("Error in guess loop:", e);
    }
  }
}

async function runInfoMode(network: any, senderAddress: string) {
    console.log("Running in INFO mode...");
    try {
        const total = await readTotalGames(network, senderAddress);
        console.log(`Total Games: ${total}`);
        
        if (total > 0) {
            const lastId = total - 1;
            const info = await readGameInfo(network, senderAddress, lastId);
            console.log(`Game Info for ID ${lastId}: ${info}`);
        }
    } catch(e) {
        console.warn("Error reading info:", e);
    }
}

async function runFullMode(network: any, senderKey: string, senderAddress: string, stopSignal: AbortSignal) { 
      console.log("Running in FULL mode (randomly creating or guessing)...");
      let keepRunning = true;
      stopSignal.addEventListener("abort", () => { keepRunning = false; });
      
      while(keepRunning) {
          const waitMs = pickRandomDelayMs();
          console.log(`Waiting ~${Math.round(waitMs / 1000)}s...`);
          try { await delay(waitMs, stopSignal); } catch { break; }
          
          const action = Math.random() > 0.5 ? "create" : "guess";
          console.log(`>> Checkpoint: Chose action '${action}'`);
          
          if (action === "create") {
             const min = 1; const max = 100; const fee = 100000;
             try {
                await contractCall(network, senderKey, FN_CREATE_GAME, [uintCV(min), uintCV(max), uintCV(fee)]);
             } catch(e) { console.warn("Create failed, continuing loop...", e); }
          } else {
             try {
                 const total = await readTotalGames(network, senderAddress);
                 if (total > 0) {
                     console.log(`Found ${total} games. Guessing on ID ${total - 1}...`);
                     const guessNum = Math.floor(Math.random() * 100) + 1;
                     await contractCall(network, senderKey, FN_GUESS, [uintCV(total - 1), uintCV(guessNum)]);
                 } else {
                     console.log(">> No games found (total=0). Skipping guess.");
                 }
             } catch(e) {
                 console.warn("Guess flow failed (read check or call), continuing loop...", e);
             }
          }
      }
}

async function main() {
  console.log("DigiWin driver starting...");
  if (FAST) console.log("FAST mode enabled: shortened delays");
  console.log(`Mode: ${MODE}`);

  // 1) Network
  const network = createNetwork("mainnet");

  // 2) Load mnemonic and derive sender
  let mnemonic = "";
  try {
      mnemonic = await readMainnetMnemonic();
  } catch(e) {
      console.error("Please ensure settings/Mainnet.toml exists with mnemonic");
      process.exit(1);
  }
  
  const { senderKey, senderAddress } = await deriveSenderFromMnemonic(mnemonic);

  console.log(`Using sender address: ${senderAddress}`);
  console.log(
    `Target contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME} (mainnet)`
  );

  // 3) Continuous run based on mode
  const stopController = new AbortController();
  const stopSignal = stopController.signal;
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT. Stopping now...");
    stopController.abort();
  });

  try {
    if (MODE === "create") {
      await runCreateMode(network, senderKey, stopSignal);
    } else if (MODE === "guess") {
      await runGuessMode(network, senderKey, senderAddress, stopSignal);
    } else if (MODE === "info") {
      await runInfoMode(network, senderAddress);
    } else if (MODE === "full") {
      await runFullMode(network, senderKey, senderAddress, stopSignal);
    } else {
      throw new Error(
        `Unknown mode: ${MODE}. Use --mode=create, --mode=guess, --mode=info, or --mode=full`
      );
    }
  } catch (e) {
    if ((e as Error).message !== "aborted") {
      throw e;
    }
  }

  console.log("DigiWin driver stopped.");
}

// Run
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
