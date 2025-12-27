
import { Cl, ClarityType } from "@stacks/transactions";
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

  it("fails to create game with invalid range", () => {
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

  it("allows guessing and collects fees", () => {
      // Create new game (ID 1)
      const create = simnet.callPublicFn(
          "digiwin",
          "create-game",
          [Cl.uint(1), Cl.uint(100), Cl.uint(1000)],
          deployer
      );
      // Assuming ID 1 if state persists
      // Let's get the ID from result to be sure
      const gameId = (create.result as any).value; // Should be uint CV

      const guessResponse = simnet.callPublicFn(
          "digiwin",
          "guess",
          [gameId, Cl.uint(50)], 
          wallet1
      );

      expect(guessResponse.result.type).toBe(ClarityType.ResponseOk);
      
      const pool = simnet.callReadOnlyFn("digiwin", "get-prize-pool", [gameId], deployer);
      expect(pool.result).toBeUint(1000);
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
      const gameId = (createResponse.result as any).value; 

      const guessResponse = simnet.callPublicFn(
          "digiwin",
          "guess",
          [gameId, Cl.uint(42)],
          wallet1
      );

      expect(guessResponse.result).toBeOk(Cl.bool(true));

      const gameInfo = simnet.callReadOnlyFn("digiwin", "get-game-info", [gameId], deployer);
      // Ensure we access the optional correctly: (some (tuple ...))
      expect(gameInfo.result).toBeSome(expect.anything());
      
      const gameTuple = (gameInfo.result as any).value.data;
      expect(gameTuple.status).toBeAscii("won");
      expect(gameTuple.winner).toBeSome(Cl.principal(wallet1));
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

  it("prevents guessing out of range", () => {
      const createResponse = simnet.callPublicFn(
          "digiwin",
          "create-game",
          [Cl.uint(1), Cl.uint(10), Cl.uint(100)],
          deployer
      );
      const gameId = (createResponse.result as any).value;

      const response = simnet.callPublicFn(
          "digiwin",
          "guess",
          [gameId, Cl.uint(20)],
          wallet1
      );
      expect(response.result).toBeErr(Cl.uint(103)); // ERR_INVALID_GUESS
  });
});
