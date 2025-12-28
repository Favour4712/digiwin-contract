
import { Cl, ClarityType, cvToString, cvToValue } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("DigiWin Game Functions", () => {
  it("allows creating a new game", () => {
    const min = 1;
    const max = 100;
    const fee = 100000;

    const response = simnet.callPublicFn(
      "digiwin",
      "create-game",
      [Cl.uint(min), Cl.uint(max), Cl.uint(fee)],
      deployer
    );

    expect(response.result).toBeOk(Cl.uint(0));
  });

  it("fails to create game with invalid range (min > max)", () => {
    const min = 100;
    const max = 10;
    const fee = 100000;

    const response = simnet.callPublicFn(
      "digiwin",
      "create-game",
      [Cl.uint(min), Cl.uint(max), Cl.uint(fee)],
      deployer
    );

    expect(response.result).toBeErr(Cl.uint(105)); // ERR_INVALID_PARAMS
  });

  // NEW TEST 1
  it("fails to create game with min equal to max", () => {
    // min == max should trigger ERR_INVALID_PARAMS (u105)
    const createResponse = simnet.callPublicFn(
        "digiwin", 
        "create-game", 
        [Cl.uint(100), Cl.uint(100), Cl.uint(100000)], 
        deployer
    );
    expect(createResponse.result).toBeErr(Cl.uint(105)); 
  });

  // NEW TEST 2
  it("fails to guess number out of range", () => {
    // Create a specific game for this test to be isolated
    const createResponse = simnet.callPublicFn(
        "digiwin", 
        "create-game", 
        [Cl.uint(10), Cl.uint(20), Cl.uint(50)], 
        deployer
    );
    // Get the ID (unwrap OK result)
    const gameId = (createResponse.result as any).value;

    // Guess 21 (max is 20)
    const response = simnet.callPublicFn(
        "digiwin", 
        "guess", 
        [gameId, Cl.uint(21)], 
        wallet1
    );
    expect(response.result).toBeErr(Cl.uint(103)); // ERR_INVALID_GUESS
  });

  it("allows guessing and collects fees", () => {
      const create = simnet.callPublicFn(
          "digiwin",
          "create-game",
          [Cl.uint(1), Cl.uint(100), Cl.uint(1000)],
          deployer
      );
      expect(create.result).toBeOk(expect.anything());

      // Hardcode ID 0 to avoid persistence issues in test env
      const gameId = Cl.uint(0); 

      const guessResponse = simnet.callPublicFn(
          "digiwin",
          "guess",
          [gameId, Cl.uint(50)], 
          wallet1
      );

      expect(guessResponse.result.type).toBe(ClarityType.ResponseOk);
      
      const pool = simnet.callReadOnlyFn("digiwin", "get-prize-pool", [gameId], deployer);
      expect(pool.result).toBeSome(Cl.uint(1000));
  });

  it("handles winning deterministic game", () => {
      const min = 42;
      const max = 42;
      const fee = 1000000;

      const createResponse = simnet.callPublicFn(
          "digiwin",
          "create-game",
          [Cl.uint(min), Cl.uint(max), Cl.uint(fee)],
          deployer
      );
      
      expect(createResponse.result).toBeOk(expect.anything());
      const gameId = (createResponse.result as any).value; 

      const guessResponse = simnet.callPublicFn(
          "digiwin",
          "guess",
          [gameId, Cl.uint(42)],
          wallet1
      );

      expect(guessResponse.result).toBeOk(Cl.bool(true));

      const gameInfo = simnet.callReadOnlyFn("digiwin", "get-game-info", [gameId], deployer);
      
      
      // Use toMatchObject on the JSON structure for robust partial matching
      const gameInfoVal = JSON.parse(JSON.stringify(gameInfo.result));
      const gameTuple = gameInfoVal.value.data;

      expect(gameTuple).toEqual(expect.objectContaining({
          "creator": expect.objectContaining({ value: deployer }),
          "status": expect.objectContaining({ value: "won" }),
          "winner": expect.objectContaining({ type: "some" })
      }));
      
      expect(gameTuple.winner.value).toEqual(expect.objectContaining({ value: wallet1 }));
  });

  it("prevents guessing on non-existent game", () => {
      const response = simnet.callPublicFn(
          "digiwin",
          "guess",
          [Cl.uint(9999), Cl.uint(50)],
          wallet1
      );
      expect(response.result).toBeErr(Cl.uint(101)); // ERR_GAME_NOT_FOUND
  });

});
